/**
 * Wall cutout builder for Gridfinity bins.
 *
 * Generates cutouts in outer walls and interior divider walls with support
 * for u-shape, scoop (semicircle), and funnel (tapered U) profiles.
 */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  translate,
  rotate,
  clone,
  unwrap,
  withScope,
  fuseAll,
} from 'brepjs';
import type { Shape3D, Drawing, DisposalScope, ValidSolid } from 'brepjs';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { interiorDividerSegments } from './compartmentBuilder';
import { resolvePolygonSideGeometry, type PolygonSideGeometry } from './maskPolygonEdges';
import { isPartialMask } from '@/shared/utils/cellMask';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';

// Re-export for consumers that were importing from this module
export { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';

/** Auto-compute corner radius: 15% of the smaller dimension, clamped to [0.5, 5] mm. */
function autoCornerRadius(cutWidth: number, cutHeight: number): number {
  return Math.max(0.5, Math.min(5, Math.min(cutWidth * 0.15, cutHeight * 0.15)));
}

/** Funnel taper ratio: bottom width is 60% of top width. */
const FUNNEL_TAPER_RATIO = 0.6;

/**
 * Build a 2D cutout profile (Drawing) for the given shape.
 *
 * The profile is centered at the origin in 2D space (X = horizontal, Y = vertical).
 * Total height includes overshoot above the wall top.
 *
 * @param cutoutShape - Shape style
 * @param cutWidth - Horizontal span of the cutout in mm
 * @param userCutHeight - User-visible height (depth from wall top) in mm
 * @param overshoot - Extra height above wall top for clean boolean cuts
 */
export function buildCutoutProfile(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number
): Drawing {
  const totalHeight = userCutHeight + overshoot;

  switch (cutoutShape) {
    case 'scoop': {
      // Semicircle arc clamped by available height (floor boundary).
      // When cutWidth/2 > userCutHeight, the arc becomes a shallow circular
      // segment instead of a full semicircle.
      const hw = cutWidth / 2;
      const sagitta = Math.min(hw, userCutHeight);
      const topY = totalHeight / 2;
      const arcCenterY = topY - overshoot; // Y where the flat top meets the arc
      return draw([-hw, topY])
        .lineTo([hw, topY])
        .lineTo([hw, arcCenterY])
        .sagittaArc(-cutWidth, 0, sagitta)
        .close();
    }

    case 'funnel': {
      // Tapered U: wider at top, narrower at bottom with rounded corners.
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);

      const topHW = cutWidth / 2;
      const bottomHW = (cutWidth * FUNNEL_TAPER_RATIO) / 2;
      const topY = totalHeight / 2;
      const bottomY = -totalHeight / 2;

      // Draw trapezoid: top-left -> top-right -> bottom-right -> bottom-left -> close
      let pen = draw([-topHW, topY]).lineTo([topHW, topY]).lineTo([bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      pen = pen.lineTo([-bottomHW, bottomY]);
      if (safeR > 0.1) pen = pen.customCorner(safeR);
      return pen.close();
    }

    default: {
      // U-shape: rounded rectangle (existing behavior)
      const cornerR = autoCornerRadius(cutWidth, userCutHeight);
      const safeR = Math.min(cornerR, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);
      if (safeR > 0.1) {
        return drawRoundedRectangle(cutWidth, totalHeight, safeR);
      }
      return drawRectangle(cutWidth, totalHeight);
    }
  }
}

/**
 * Internal: build a cutout solid, registering every intermediate in `scope`.
 *
 * Each brepjs transform (extrude, translate, rotate) allocates a new WASM
 * handle while the previous shape becomes garbage. Without scope tracking
 * those intermediates leak across regenerations and eventually exhaust the
 * WASM heap, surfacing as `RuntimeError: memory access out of bounds` on
 * long bins (1×10 with wall cutouts was the reported repro).
 */
function buildSingleCutoutInScope(
  scope: DisposalScope,
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number,
  extrudeDepth: number,
  wallHeight: number,
  position: { x: number; y: number; rotateZ: number }
): Shape3D {
  const profile = buildCutoutProfile(cutoutShape, cutWidth, userCutHeight, overshoot);

  // Sketch on XZ plane: X = horizontal span, Z = vertical height.
  // Extrusion goes along -Y (through the wall).
  let shape = scope.register(sketch(profile, 'XZ').extrude(extrudeDepth));

  // Center extrusion around Y=0 so the cut straddles the wall face.
  shape = scope.register(translate(shape, [0, extrudeDepth / 2, 0]));

  if (position.rotateZ !== 0) {
    shape = scope.register(rotate(shape, position.rotateZ, { axis: [0, 0, 1] }));
  }

  // Position: bottom of visible cutout at (wallHeight - userCutHeight),
  // shape center is offset upward by overshoot/2 from the visual center
  const cutZ = wallHeight - userCutHeight / 2 + overshoot / 2;
  return scope.register(translate(shape, [position.x, position.y, cutZ]));
}

/**
 * Build a single cutout solid from a 2D profile, extruded and positioned.
 *
 * Caller owns the returned shape and must dispose it via `.delete()` (or
 * register it with their own DisposalScope). All intermediate WASM handles
 * allocated during construction are disposed internally before returning.
 *
 * @returns Positioned Shape3D ready for boolean subtraction
 */
export function buildSingleCutout(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number,
  extrudeDepth: number,
  wallHeight: number,
  position: { x: number; y: number; rotateZ: number }
): Shape3D {
  return withScope((scope: DisposalScope) => {
    const tracked = buildSingleCutoutInScope(
      scope,
      cutoutShape,
      cutWidth,
      userCutHeight,
      overshoot,
      extrudeDepth,
      wallHeight,
      position
    );
    // Clone so the scope-owned original can be safely disposed while the
    // caller receives a fresh, independently-owned handle.
    return unwrap(clone(tracked));
  });
}

/**
 * Build wall cutout cuts for all enabled sides and interior divider walls.
 *
 * Supports multiple cutout shapes: u-shape (rectangular notch with rounded corners),
 * scoop (semicircle), and funnel (tapered U with wider top, narrower bottom).
 */
export function buildWallCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.walls.enabled) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const result = buildWallCutoutCutsInScope(scope, params, innerW, innerD, wallHeight, hasLip);
    // The fused/returned shape is registered in `scope` (directly or via
    // fuseAllOrNull's single-element passthrough). Clone it so the original
    // can be safely disposed when the scope exits, while the caller receives
    // a fresh, independently-owned handle.
    return result ? unwrap(clone(result)) : null;
  });
}

/** A single interior-divider cutout window, resolved in bin-centered mm. */
export interface InteriorDividerCutout {
  /** Cut span along the divider's length. */
  readonly cutW: number;
  /** Cut depth (vertical, into the wall from its top). */
  readonly cutH: number;
  readonly x: number;
  readonly y: number;
  /** In-plane rotation (deg) so the window lies in the (possibly tilted) wall. */
  readonly rotateZ: number;
}

/**
 * Resolve the interior-divider cutout windows for a bin.
 *
 * Crucially, this honours `dividerOverrides` (tilted dividers): each window is
 * translated to the tilted segment's midpoint and rotated to lie IN the wall.
 * Without this the cutout is carved at the original grid line while the wall is
 * tilted, so it slices the divider at a slant. Pure + exported so the geometry
 * can be asserted without a WASM build.
 */
export function computeInteriorDividerCutouts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): InteriorDividerCutout[] {
  const cfg = params.walls.interior;
  if (!cfg.enabled || isPartialMask(params.cellMask)) return [];
  if (cfg.width <= 0 || cfg.depth <= 0) return [];

  const interiorH = wallHeight - params.wallThickness;
  const out: InteriorDividerCutout[] = [];
  for (const seg of interiorDividerSegments(params, innerW, innerD)) {
    const cutW = seg.segLen * (cfg.width / 100);
    const cutH = interiorH * (cfg.depth / 100);
    if (cutW < 0.1 || cutH < 0.1) continue;
    out.push({ cutW, cutH, x: seg.x, y: seg.y, rotateZ: seg.rotateZ });
  }
  return out;
}

function buildWallCutoutCutsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  const wallThickness = params.wallThickness;
  const cutShapes: Shape3D[] = [];
  const cutoutShape = params.walls.shape;

  const resolveEffective = (side: 'front' | 'back' | 'left' | 'right' | 'interior') => {
    const cfg = params.walls[side];
    return cfg.enabled
      ? { effectiveWidth: cfg.width, effectiveDepth: cfg.depth }
      : { effectiveWidth: 0, effectiveDepth: 0 };
  };

  const maxThickness = Math.max(wallThickness, params.compartments.thickness);
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  // For non-rectangular bins, map each side to the outermost polygon edge
  // facing that direction (silently skipping sides with no matching edge).
  // Rectangular fallback uses the bin AABB.
  const cellMask = params.cellMask;
  const sides: PolygonSideGeometry[] = isPartialMask(cellMask)
    ? (['front', 'back', 'left', 'right'] as const)
        .map((key) => resolvePolygonSideGeometry(cellMask, params.gridUnitMm, wallThickness, key))
        .filter((g): g is PolygonSideGeometry => g !== null)
    : [
        { key: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
        { key: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
        { key: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
        { key: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
      ];

  for (const side of sides) {
    const cfg = params.walls[side.key];
    if (!cfg.enabled) continue;
    const { effectiveWidth, effectiveDepth } = resolveEffective(side.key);

    // Resolve cutout width: absolute mm override or percentage of wall span
    const cutWidth =
      cfg.widthMm !== null
        ? Math.min(cfg.widthMm, side.wallSpan)
        : side.wallSpan * (effectiveWidth / 100);
    if (cutWidth <= 0 || effectiveDepth <= 0) continue;
    const interiorHeight = wallHeight - wallThickness;
    const userCutHeight = interiorHeight * (effectiveDepth / 100);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

    // Resolve horizontal position from alignment + offset
    const centerOffset = computeCutoutCenter(
      side.wallSpan,
      cutWidth,
      wallThickness,
      cfg.alignment,
      cfg.offset
    );

    cutShapes.push(
      buildSingleCutoutInScope(
        scope,
        cutoutShape,
        cutWidth,
        userCutHeight,
        overshoot,
        extrudeDepth,
        wallHeight,
        {
          x: side.rotateZ === 0 ? side.x + centerOffset : side.x,
          y: side.rotateZ !== 0 ? side.y + centerOffset : side.y,
          rotateZ: side.rotateZ,
        }
      )
    );
  }

  // Interior divider walls — skip entirely on polygon bins, since
  // compartmentWallsFeature is filtered out for custom shapes and the
  // corresponding divider walls won't exist. Cutting where there's no
  // material would be wasted boolean work (and risks carving the shell
  // if a cut crosses it). Placement honours tilted dividers (dividerOverrides)
  // so the window lands ON the angled wall instead of slicing it at a slant.
  for (const c of computeInteriorDividerCutouts(params, innerW, innerD, wallHeight)) {
    cutShapes.push(
      buildSingleCutoutInScope(
        scope,
        cutoutShape,
        c.cutW,
        c.cutH,
        overshoot,
        extrudeDepth,
        wallHeight,
        c
      )
    );
  }

  // Inline fuse so the fused intermediate is registered in `scope` — the
  // shared fuseAllOrNull allocates a new WASM handle that would otherwise
  // escape the scope and leak.
  if (cutShapes.length === 0) return null;
  if (cutShapes.length === 1) return cutShapes[0]; // already scope-registered
  return scope.register(unwrap(fuseAll(cutShapes as ValidSolid[])));
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const wallCutoutsFeature: FeatureBuilder = {
  name: 'wallCutoutCuts',
  tag: FeatureTag.WALL_CUTOUT,
  target: 'cut',
  supportsCellMask: true,
  shouldBuild: (ctx) => ctx.params.walls.enabled,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    // cellMask presence + shape affect the polygon-edge resolution, so
    // include the mask hash (via context's derived maskKey) to prevent
    // rect-bin cache bleed into polygon bins with identical wall config.
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        stableSerialize(params.walls),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        dim.hasLip,
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        // Tilted dividers move interior cutouts off the grid line; omitting this
        // would reuse the stale grid-aligned cut.
        stableSerialize(params.compartments.dividerOverrides ?? [])
      )
    );
  },
  build: (ctx) => {
    const result = buildWallCutoutCuts(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.dimensions.hasLip
    );
    return result ? [result] : null;
  },
};
