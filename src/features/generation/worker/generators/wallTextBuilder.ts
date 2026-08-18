/**
 * Outer-wall surface text.
 *
 * Builds engraved/embossed/through-cut glyph solids on the bin's outer wall
 * faces at the positions computed by `wallTextLayout.ts` (which also drives
 * the wall-pattern clearing behind the same rect — keep both in sync by
 * changing the layout, never the two consumers).
 *
 * Geometry: each wall's text is built flat via `buildTextSolid` (XY frame,
 * glyph run +X, up +Y, sketch plane at Z=0), then stood up against its wall:
 * rotate +90° about X (up → +Z, engrave direction → +Y = inward), yaw about Z
 * to face the wall outward, and translate to the outer face. The builders run
 * through the generic feature runner, which applies the overhang interior
 * offset and tags faces `FeatureTag.TEXT`.
 *
 * Registered as TWO builders because a FeatureBuilder has one static boolean
 * target: engrave/through-cut solids join the cut pile, embossed text joins
 * the fuse pile. The shared surface style has a single mode, so exactly one
 * of the two is active per generation.
 */

import { rotate, translate, withScope, clone, unwrap, fuseAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { BinParams, WallTextSide } from '@/shared/types/bin';
import { WALL_TEXT_SIDES, resolveTextStyle } from '@/shared/types/bin';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import type { PipelineContext } from './pipeline/types';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';
import { buildTextSolid } from './textBuilder';
import { computeWallTextLayouts, wallTextReadingSign } from './wallTextLayout';
import type { WallTextLayout } from './wallTextLayout';

/** Yaw (degrees about +Z) turning a front-facing glyph toward each wall. */
const WALL_YAW: Record<WallTextSide, number> = {
  front: 0,
  back: 180,
  left: -90,
  right: 90,
};

function wallFaceTranslation(
  side: WallTextSide,
  innerW: number,
  innerD: number,
  wallThickness: number
): [number, number, number] {
  switch (side) {
    case 'front':
      return [0, -(innerD / 2 + wallThickness), 0];
    case 'back':
      return [0, innerD / 2 + wallThickness, 0];
    case 'left':
      return [-(innerW / 2 + wallThickness), 0, 0];
    case 'right':
      return [innerW / 2 + wallThickness, 0, 0];
  }
}

function buildOneWallText(
  scope: DisposalScope,
  layout: WallTextLayout,
  params: BinParams,
  innerW: number,
  innerD: number
): Shape3D | null {
  const sign = wallTextReadingSign(layout.side);
  const result = buildTextSolid(scope, {
    text: layout.plan.lines.map((line) => line.text).join('\n'),
    style: layout.style,
    // The solver already resolved the placement inside the chosen rect, so the
    // plan travels with it: re-planning here against a different box is how a
    // caption ends up somewhere other than where the pattern was cleared.
    plan: layout.plan,
    availW: layout.availW,
    availD: layout.availD,
    // Reading-frame centre of the chosen rect; local Y becomes world Z after
    // the stand-up rotation, so the vertical centre rides through centerY.
    centerX: sign * layout.rectCenterU,
    centerY: layout.rectCenterZ,
    topZ: 0,
    depth: layout.depth,
    hostThickness: params.wallThickness,
  });
  if (!result) return null;

  const stood = scope.register(rotate(result.solid, 90, { axis: [1, 0, 0] }));
  const yaw = WALL_YAW[layout.side];
  const faced = yaw === 0 ? stood : scope.register(rotate(stood, yaw, { axis: [0, 0, 1] }));
  return scope.register(
    translate(faced, wallFaceTranslation(layout.side, innerW, innerD, params.wallThickness))
  );
}

function buildWallTextShapes(ctx: PipelineContext, wantFuse: boolean): readonly Shape3D[] | null {
  const { params, dimensions: dim } = ctx;
  const layouts = computeWallTextLayouts(params, dim).filter(
    (l) => (l.mode === 'emboss') === wantFuse
  );
  if (layouts.length === 0) return null;

  return withScope((scope: DisposalScope) => {
    const shapes = layouts
      .map((layout) => buildOneWallText(scope, layout, params, dim.innerW, dim.innerD))
      .filter((shape) => shape !== null);
    if (shapes.length === 0) return null;

    // The feature pipeline applies only the FIRST shape a builder returns and
    // disposes the rest, so one solid per wall would engrave just one of them.
    // The per-wall solids are disjoint, so fusing them is equivalent to applying
    // each in turn.
    const combined =
      shapes.length === 1 ? shapes[0] : scope.register(unwrap(fuseAll(shapes as ValidSolid[])));
    return [unwrap(clone(combined))];
  });
}

function hasAnyWallText(params: BinParams): boolean {
  const walls = params.surfaceText?.walls;
  if (!walls) return false;
  return Object.values(walls).some((t) => typeof t === 'string' && t.trim() !== '');
}

/**
 * Whether any wall resolves to emboss. Per wall, not per design: a wall may
 * carry its own style override, so asking the shared style would send an
 * embossed wall to the cut builder and lose it.
 */
function hasWallTextMode(params: BinParams, wantEmboss: boolean): boolean {
  const walls = params.surfaceText?.walls;
  if (!walls) return false;
  return WALL_TEXT_SIDES.some((side) => {
    if ((walls[side]?.trim() ?? '') === '') return false;
    const mode = resolveTextStyle(
      params.textDefaults,
      params.surfaceText?.style,
      params.surfaceText?.wallStyles?.[side]
    ).mode;
    return (mode === 'emboss') === wantEmboss;
  });
}

function wallTextCacheKey(ctx: PipelineContext): string {
  const { params, dimensions: dim } = ctx;
  // Placement depends on the wall obstacles (cutouts, handles, label back-wall
  // rule) and the band geometry, so all of it feeds the key. Correctness over
  // hit-rate: text edits are rare relative to their build cost.
  return compactKey(
    buildCacheKey(
      // `v3`: wall text is placed by the shared type plan (anchor, tracking,
      // case, cap-height datum), so the same params cut different glyphs in a
      // different place.
      'v3',
      dim.shellKey,
      stableSerialize(params.surfaceText ?? {}),
      stableSerialize(params.textDefaults),
      stableSerialize(params.walls),
      stableSerialize(params.handles),
      params.label.enabled,
      params.style,
      quantize(dim.innerW),
      quantize(dim.innerD),
      quantize(dim.wallHeight),
      quantize(params.wallThickness),
      dim.hasLip
    )
  );
}

export const wallTextCutFeature: FeatureBuilder = {
  name: 'wallTextCut',
  tag: FeatureTag.TEXT,
  target: 'cut',
  shouldBuild: (ctx) =>
    hasAnyWallText(ctx.params) && hasWallTextMode(ctx.params, false) && !ctx.dimensions.solid,
  cacheKey: wallTextCacheKey,
  build: (ctx) => buildWallTextShapes(ctx, false),
};

export const wallTextEmbossFeature: FeatureBuilder = {
  name: 'wallTextEmboss',
  tag: FeatureTag.TEXT,
  target: 'fuse',
  shouldBuild: (ctx) =>
    hasAnyWallText(ctx.params) && hasWallTextMode(ctx.params, true) && !ctx.dimensions.solid,
  cacheKey: wallTextCacheKey,
  build: (ctx) => buildWallTextShapes(ctx, true),
};
