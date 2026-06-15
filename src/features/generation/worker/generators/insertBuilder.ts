/**
 * Insert cavity builder for Gridfinity bins.
 *
 * Generates insert cuts (circular, rounded-rect, slot, rectangle)
 * that are boolean-subtracted from the bin interior.
 */

import {
  drawRoundedRectangle,
  drawRectangle,
  drawCircle,
  unwrap,
  fuseAll,
  translate,
  withScope,
  clone,
} from 'brepjs';
import type { Shape3D, ValidSolid, Drawing, DisposalScope } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { rectStraddlesTiltedDivider } from '@/shared/types/bin';
import { sketch } from './meshUtils';
/**
 * Build the 2D insert profile (Drawing) for a given insert shape.
 * All profiles are centered at the origin.
 */
function makeInsertProfile(
  shape: string,
  width: number,
  depth: number,
  cornerRadius: number
): Drawing {
  switch (shape) {
    case 'circle':
    case 'hexagon':
      // Hexagon approximated with circle (polygon support TBD)
      return drawCircle(width / 2);
    case 'rounded-rect': {
      const maxR = Math.min(width, depth) / 2 - 0.01;
      return drawRoundedRectangle(width, depth, Math.min(cornerRadius, maxR));
    }
    case 'slot':
      return drawRoundedRectangle(width, depth, Math.min(width, depth) / 2);
    case 'rectangle':
    default:
      return drawRectangle(width, depth);
  }
}
/**
 * Build insert cavity cuts.
 *
 * `innerW`/`innerD` are needed only when the bin has tilted dividers — the
 * worker checks if each insert straddles a tilted divider line and skips
 * any that would otherwise punch through a wedge into the neighboring
 * compartment. Default `undefined` keeps the legacy callers working.
 */
export function buildInsertCuts(
  params: BinParams,
  innerW?: number,
  innerD?: number
): Shape3D | null {
  if (params.inserts.length === 0) return null;
  const hasTiltedDividers = (params.compartments.dividerOverrides?.length ?? 0) > 0;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const insertShapes: Shape3D[] = [];

    for (const insert of params.inserts) {
      // Guard: skip inserts with degenerate dimensions that would crash WASM
      if (insert.cutDepth <= 0 || insert.width <= 0 || insert.depth <= 0) continue;

      // Tilted-divider compat: skip inserts whose footprint crosses a
      // tilted divider line. The check is conservative — a false positive
      // only suppresses an insert (visible to the user as "missing");
      // a false negative would punch through the wedge and produce
      // visually broken geometry.
      if (hasTiltedDividers && innerW !== undefined && innerD !== undefined) {
        const rect = {
          x: insert.x - insert.width / 2,
          y: insert.y - insert.depth / 2,
          width: insert.width,
          depth: insert.depth,
        };
        if (rectStraddlesTiltedDivider(params.compartments, innerW, innerD, rect)) {
          continue;
        }
      }

      const profile = makeInsertProfile(
        insert.shape,
        insert.width,
        insert.depth,
        insert.cornerRadius
      );
      const solid = scope.register(sketch(profile, 'XY').extrude(insert.cutDepth));
      insertShapes.push(scope.register(translate(solid, [insert.x, insert.y, 0])));
    }

    if (insertShapes.length === 0) return null;
    const fused =
      insertShapes.length === 1
        ? insertShapes[0]
        : scope.register(unwrap(fuseAll(insertShapes as ValidSolid[])));
    return unwrap(clone(fused));
  });
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, stableSerialize, compactKey } from './cacheKeyUtils';

export const insertCutsFeature: FeatureBuilder = {
  name: 'insertCuts',
  tag: FeatureTag.INSERT,
  target: 'cut',
  // Inserts cut recesses into the interior floor; a lightweight floor is a thin
  // shell over a hollow base, so the cut would punch through. Mutually exclusive
  // in the UI; suppress here too for any legacy design carrying both.
  shouldBuild: (ctx) => ctx.params.inserts.length > 0 && !ctx.dimensions.lightweight,
  cacheKey: (ctx) =>
    compactKey(
      buildCacheKey(
        // `v2`: insert-vs-tilted-divider skip means dividerOverrides
        // affects which inserts render. Cache namespace bumped.
        'v2',
        ctx.dimensions.shellKey,
        stableSerialize(ctx.params.inserts),
        stableSerialize(ctx.params.compartments.dividerOverrides ?? [])
      )
    ),
  build: (ctx) => {
    const result = buildInsertCuts(ctx.params, ctx.dimensions.innerW, ctx.dimensions.innerD);
    return result ? [result] : null;
  },
};
