/**
 * Divider-cutout blend builder for Gridfinity bins.
 *
 * Produces cut solids that trim compartment divider walls where they meet
 * outer-wall cutouts, creating aesthetically pleasing transitions:
 *
 * Case 1 — Divider end within cutout span: trim to match cutout profile
 * Case 2 — Divider end adjacent to cutout: straight-slope ramp (~45°)
 * Case 3 — Parallel divider visible through cutout: flat horizontal trim
 *
 * Standard (fused wall) bin style only — slotted bins are skipped.
 *
 * Sub-modules:
 *   - `dividerBlendTypes`     — interfaces, predicates, ramp-zone descriptor
 *   - `dividerBlendResolvers` — pure resolveOuterCutouts / collectDividers
 *   - `dividerBlendCuts`      — buildEndTrimCut / buildRampCut / buildParallelTrimCut
 */

import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { fuseAllOrNull } from './utils/shapeOps';
import { COPLANAR_MARGIN } from './generatorConstants';
import {
  type RampZone,
  MIN_DIM,
  dividerTouchesWall,
  getWallFaceInfo,
  isPerpendicular,
} from './dividerBlendTypes';
import { collectDividers, resolveOuterCutouts } from './dividerBlendResolvers';
import { buildEndTrimCut, buildParallelTrimCut, buildRampCut } from './dividerBlendCuts';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export type { RampZone } from './dividerBlendTypes';
export { resolveOuterCutouts, collectDividers } from './dividerBlendResolvers';

/**
 * Build all divider-cutout blend cuts.
 *
 * Returns a single fused cut solid (or null if no blending is needed).
 */
export function buildDividerBlends(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  if (params.style !== 'standard') return null;
  if (!params.walls.enabled) return null;

  const cutouts = resolveOuterCutouts(params, innerW, innerD, wallHeight);
  if (cutouts.length === 0) return null;

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return null;

  const cutoutShape = params.walls.shape;
  const cuts: Shape3D[] = [];

  for (const divider of dividers) {
    for (const cutout of cutouts) {
      const perp = isPerpendicular(divider, cutout);

      if (perp && dividerTouchesWall(divider, cutout)) {
        // Divider's wall-local position along the cutout's span axis
        const dividerPos = divider.posAlongPerp;
        const halfThick = divider.thickness / 2;

        // Case 1: Divider fully inside the cutout span — trim the end flush.
        const insideSpan =
          dividerPos + halfThick <= cutout.cutRight + 0.01 &&
          dividerPos - halfThick >= cutout.cutLeft - 0.01;

        if (insideSpan) {
          try {
            const cut = buildEndTrimCut(divider, cutout, cutoutShape, wallHeight, hasLip);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        } else {
          // Case 2: Divider adjacent to (but outside) a cutout edge — ramp.
          // Guarded by `else` so that a divider exactly on the boundary (the
          // ±0.01 tolerance above) doesn't trigger BOTH an end-trim AND a
          // ramp cut — their solids overlap and subtracting the fused union
          // yields a different trim profile than either cut alone.
          const distToLeft = cutout.cutLeft - dividerPos;
          const distToRight = dividerPos - cutout.cutRight;

          if (distToLeft > -halfThick && distToLeft < cutout.userCutHeight) {
            try {
              const cut = buildRampCut(divider, cutout, wallHeight);
              if (cut) cuts.push(cut);
            } catch {
              /* graceful degradation */
            }
          }
          if (distToRight > -halfThick && distToRight < cutout.userCutHeight) {
            try {
              const cut = buildRampCut(divider, cutout, wallHeight);
              if (cut) cuts.push(cut);
            } catch {
              /* graceful degradation */
            }
          }
        }
      } else if (!perp) {
        // Case 3: Parallel divider — flat horizontal trim.
        // Only trim dividers close enough to the wall to be visually exposed
        // through the cutout opening. Use cutout height as proximity threshold.
        const depthFromWall = Math.abs(divider.posAlongPerp - cutout.wallFaceCoord);
        if (depthFromWall < cutout.userCutHeight) {
          try {
            const cut = buildParallelTrimCut(divider, cutout);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }
      }
    }
  }

  // fuseAllOrNull allocates a new WASM handle for the fused result (when
  // cuts.length > 1) but does not dispose its inputs. Free them explicitly
  // to match the leak-plugging pattern used across the other builders.
  const fused = fuseAllOrNull(cuts);
  if (cuts.length > 1) {
    for (const s of cuts) s.delete();
  }
  return fused;
}

// --- Ramp zone data for wall pattern clipping ---

/**
 * Compute ramp zones that face a specific wall, for hex pattern clipping.
 *
 * Returns zones where ramp cuts exist on perpendicular dividers that touch
 * this wall. The pattern builder uses these to extend its clip region.
 */
export function computeRampZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): RampZone[] {
  if (!params.walls.enabled || params.style !== 'standard') return [];

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return [];

  const cutouts = resolveOuterCutouts(params, innerW, innerD, wallHeight);
  const wallCutout = cutouts.find((c) => c.side === wallSide);
  if (!wallCutout) return [];

  const zones: RampZone[] = [];

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wallCutout)) continue;
    if (!dividerTouchesWall(divider, wallCutout)) continue;

    const dividerPos = divider.posAlongPerp;
    const halfThick = divider.thickness / 2;
    const distToLeft = wallCutout.cutLeft - dividerPos;
    const distToRight = dividerPos - wallCutout.cutRight;

    // Left-adjacent ramp
    if (distToLeft > -halfThick && distToLeft < wallCutout.userCutHeight) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }

    // Right-adjacent ramp
    if (distToRight > -halfThick && distToRight < wallCutout.userCutHeight) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }
  }

  return zones;
}

/**
 * Compute zones where perpendicular dividers meet a specific outer wall,
 * for blocking honeycomb pattern at the junction (full wall height).
 *
 * Unlike computeRampZones (which only produces zones near cutout edges),
 * this returns a zone for every perpendicular divider touching the wall,
 * regardless of whether a cutout exists. This ensures the hex pattern is
 * cleared where divider walls connect to the outer wall for structural
 * integrity (see issue #1345).
 */
export function computeDividerJunctionZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): RampZone[] {
  // 'solid' intentionally included — junction blocking applies to any fused-wall style
  if (params.style === 'slotted') return [];

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return [];

  const wall = getWallFaceInfo(wallSide, innerW, innerD);
  const zones: RampZone[] = [];

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wall)) continue;
    if (!dividerTouchesWall(divider, wall)) continue;

    zones.push({
      offsetAlongWall: divider.posAlongPerp,
      width: divider.thickness + 2 * COPLANAR_MARGIN,
      height: wallHeight,
    });
  }

  return zones;
}

// --- FeatureBuilder protocol ---

export const dividerBlendFeature: FeatureBuilder = {
  name: 'dividerCutoutBlend',
  tag: FeatureTag.DIVIDER,
  target: 'cut',
  shouldBuild: (ctx) =>
    !ctx.dimensions.isSlotted &&
    ctx.params.walls.enabled &&
    new Set(ctx.params.compartments.cells).size > 1,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        stableSerialize(params.walls),
        params.compartments.cols,
        params.compartments.rows,
        quantize(params.compartments.thickness),
        params.compartments.cells.join(','),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        dim.hasLip
      )
    );
  },
  build: (ctx) => {
    const result = buildDividerBlends(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.dimensions.hasLip
    );
    return result ? [result] : null;
  },
};
