/**
 * Wall cutout builder for Gridfinity bins.
 *
 * Generates cutouts in outer walls and interior divider walls with support
 * for u-shape, scoop (semicircle), and funnel (tapered U) profiles.
 */

import { draw, translate, rotate, clone, unwrap, withScope, fuseAll } from 'brepjs';
import type { Shape3D, Drawing, DisposalScope, ValidSolid } from 'brepjs';
import { binFloorMm } from '@/shared/types/bin';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { LIP_HEIGHT, LIP_TAPER_WIDTH, CUT_RIM_CLEARANCE } from './generatorConstants';
import { interiorDividerSegments } from './compartmentBuilder';
import { resolvePolygonSideGeometry, type PolygonSideGeometry } from './maskPolygonEdges';
import { pitchFromParams } from './gridPitch';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  MIN_CUTOUT_CORNER_RADIUS,
  UNBOUNDED_SLACK,
  computeCutoutCenter,
  cornerSlackFor,
  resolveCutoutCornerRadii,
  safeCutoutCornerRadii,
  type CornerSlack,
  type CutoutCornerRadii,
} from '@/shared/utils/wallCutoutPosition';

// Re-exported for consumers that were importing them from this module
export {
  computeCutoutCenter,
  autoCornerRadius,
  cornerSlackFor,
} from '@/shared/utils/wallCutoutPosition';
export type { CornerSlack } from '@/shared/utils/wallCutoutPosition';

/** Funnel taper ratio: bottom width is 60% of top width. */
const FUNNEL_TAPER_RATIO = 0.6;

/**
 * Distance from a quarter-arc's chord midpoint out to the arc, as a fraction of
 * the radius: `1 − cos(45°)`. The mid-arc point `threePointsArcTo` needs.
 */
const QUARTER_ARC_BULGE = 1 - Math.SQRT1_2;

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
 * @param cornerSlack - Wall left standing at each end of the span
 * @param radii - Resolved corner radii; omit for square shoulders + auto fillet
 */
export function buildCutoutProfile(
  cutoutShape: WallCutoutShape,
  cutWidth: number,
  userCutHeight: number,
  overshoot: number,
  cornerSlack: CornerSlack = UNBOUNDED_SLACK,
  radii: CutoutCornerRadii = resolveCutoutCornerRadii(undefined, undefined, cutWidth)
): Drawing {
  const totalHeight = userCutHeight + overshoot;
  const topY = totalHeight / 2;
  const bottomY = -totalHeight / 2;
  // Highest material the cut passes through: the lip's top face when there is
  // one, the wall's otherwise. The round-over is tangent to this plane, which
  // is what makes the shoulder read as one continuous curve rather than a
  // rounded wall with a square lip perched on it.
  const rimY = topY - CUT_RIM_CLEARANCE;
  const safe = safeCutoutCornerRadii(
    radii,
    cutWidth,
    userCutHeight,
    overshoot - CUT_RIM_CLEARANCE,
    cornerSlack
  );

  switch (cutoutShape) {
    case 'scoop': {
      // Semicircle arc clamped by available height (floor boundary).
      // When cutWidth/2 > chord depth, the arc becomes a shallow circular
      // segment instead of a full semicircle.
      const hw = cutWidth / 2;
      const topR = Math.max(safe.topLeft, safe.topRight);
      // The chord is one horizontal line, so it drops by the DEEPER of the two
      // round-overs and the shallower end keeps a short straight run down to
      // it. With no round-over this is `topY - overshoot`, the arc's original
      // seat at the wall body's top face.
      const chordY = Math.min(topY - overshoot, rimY - topR);
      const sagitta = Math.min(hw, chordY - bottomY);
      // Where the cut's own side starts on each end: under the round-over when
      // there is one, at the profile's top edge when there is not.
      const sideTop = (r: number): number => (r > MIN_CUTOUT_CORNER_RADIUS ? rimY - r : topY);

      let pen = draw([-(hw + safe.topLeft), topY]).lineTo([hw + safe.topRight, topY]);
      pen = penTopFlare(pen, hw, rimY, safe.topRight, 1);
      if (chordY < sideTop(safe.topRight) - 1e-6) pen = pen.lineTo([hw, chordY]);
      pen = pen.sagittaArc(-cutWidth, 0, sagitta);
      if (chordY < sideTop(safe.topLeft) - 1e-6) pen = pen.lineTo([-hw, sideTop(safe.topLeft)]);
      return penTopFlare(pen, hw, rimY, safe.topLeft, -1).close();
    }

    case 'u-shape':
    case 'funnel': {
      // U-shape and funnel are the same pen — a straight-sided u-shape is the
      // degenerate funnel with no taper.
      const topHW = cutWidth / 2;
      const bottomHW = cutoutShape === 'funnel' ? (cutWidth * FUNNEL_TAPER_RATIO) / 2 : topHW;

      let pen = draw([-(topHW + safe.topLeft), topY]).lineTo([topHW + safe.topRight, topY]);
      pen = penTopFlare(pen, topHW, rimY, safe.topRight, 1);
      pen = pen.lineTo([bottomHW, bottomY]);
      if (safe.bottomRight > MIN_CUTOUT_CORNER_RADIUS) pen = pen.customCorner(safe.bottomRight);
      pen = pen.lineTo([-bottomHW, bottomY]);
      if (safe.bottomLeft > MIN_CUTOUT_CORNER_RADIUS) pen = pen.customCorner(safe.bottomLeft);
      if (safe.topLeft > MIN_CUTOUT_CORNER_RADIUS) pen = pen.lineTo([-topHW, rimY - safe.topLeft]);
      return penTopFlare(pen, topHW, rimY, safe.topLeft, -1).close();
    }
  }
}

/**
 * Draw one end of the top round-over: from the rim plane, outboard of the cut,
 * down to where the cut's own side resumes.
 *
 * Written as an explicit quarter arc rather than `customCorner`, which fillets
 * two drawn curves and would need the rim run to be LONGER than the radius to
 * have something left to trim. Sized exactly it silently declines to fillet
 * (`removeCorner` returns the curves untouched); sized longer it leaves a
 * horizontal face lying in the material's own top plane, which is a coincident
 * face for the boolean to trip over. Neither failure is loud.
 *
 * `dir` is +1 for the right end of the span and -1 for the left; on the left
 * the pen is travelling the other way round the profile, so the arc runs from
 * the cut side back out to the rim.
 */
function penTopFlare(
  pen: ReturnType<typeof draw>,
  halfWidth: number,
  rimY: number,
  radius: number,
  dir: 1 | -1
): ReturnType<typeof draw> {
  if (radius <= MIN_CUTOUT_CORNER_RADIUS) return pen;
  const bulge = radius * QUARTER_ARC_BULGE;
  const outer = dir * (halfWidth + radius);
  const inner = dir * halfWidth;
  const via: [number, number] = [dir * (halfWidth + bulge), rimY - bulge];
  return dir === 1
    ? pen.lineTo([outer, rimY]).threePointsArcTo([inner, rimY - radius], via)
    : pen.threePointsArcTo([outer, rimY], via);
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
  position: { x: number; y: number; rotateZ: number },
  cornerSlack: CornerSlack,
  radii?: CutoutCornerRadii
): Shape3D {
  const profile = buildCutoutProfile(
    cutoutShape,
    cutWidth,
    userCutHeight,
    overshoot,
    cornerSlack,
    radii
  );

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
  position: { x: number; y: number; rotateZ: number },
  cornerSlack: CornerSlack = UNBOUNDED_SLACK,
  radii?: CutoutCornerRadii
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
      position,
      cornerSlack,
      radii
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
  hasLip: boolean,
  dividerTopZ: number
): Shape3D | null {
  if (!params.walls.enabled) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const result = buildWallCutoutCutsInScope(
      scope,
      params,
      innerW,
      innerD,
      wallHeight,
      hasLip,
      dividerTopZ
    );
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
  /** Cut depth, measured down from the divider's own top. */
  readonly cutH: number;
  readonly x: number;
  readonly y: number;
  /** In-plane rotation (deg) so the window lies in the (possibly tilted) wall. */
  readonly rotateZ: number;
  /** Divider material left standing at each end of the window. */
  readonly cornerSlack: CornerSlack;
  /** Corner radii resolved from `walls.interior` and the wall-level defaults. */
  readonly radii: CutoutCornerRadii;
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
  dividerTopZ: number
): InteriorDividerCutout[] {
  const cfg = params.walls.interior;
  if (!cfg.enabled || isPartialMask(params.cellMask)) return [];
  if (cfg.width <= 0 || cfg.depth <= 0) return [];

  // The divider standing above the cavity floor, which is thicker than the wall
  // on a spec base. Measured against the wall, a cut at 100% carries on past
  // the divider and slots the floor.
  const dividerH = dividerTopZ - binFloorMm(params.wallThickness);
  const out: InteriorDividerCutout[] = [];
  for (const seg of interiorDividerSegments(params, innerW, innerD, dividerTopZ)) {
    // `seg.x/y` is the wall's TOP edge. A leaning divider is a non-vertical
    // plane, so a feature placed against that line lands in open air lower
    // down; stand down until the placement can express the plane.
    if (seg.leanDeg !== 0) continue;
    // Width and alignment are measured ALONG the wall, so use the true wall
    // length (`wallLen`), which exceeds the axis-projected `segLen` on tilted
    // dividers. Match outer walls: absolute mm override clamps to the span,
    // otherwise percentage of it.
    const cutW =
      cfg.widthMm !== null ? Math.min(cfg.widthMm, seg.wallLen) : seg.wallLen * (cfg.width / 100);
    const cutH = dividerH * (cfg.depth / 100);
    if (cutW < 0.1 || cutH < 0.1) continue;
    // Honour alignment + offset like outer walls. The cutout's span axis points
    // along the (possibly tilted) divider, so project the along-wall centre
    // offset onto the segment direction (cos/sin of its in-plane rotation).
    const centerOffset = computeCutoutCenter(
      seg.wallLen,
      cutW,
      params.wallThickness,
      cfg.alignment,
      cfg.offset
    );
    const rad = (seg.rotateZ * Math.PI) / 180;
    out.push({
      cutW,
      cutH,
      x: seg.x + centerOffset * Math.cos(rad),
      y: seg.y + centerOffset * Math.sin(rad),
      rotateZ: seg.rotateZ,
      cornerSlack: cornerSlackFor(seg.wallLen, cutW, centerOffset),
      radii: resolveCutoutCornerRadii(params.walls, cfg, cutW),
    });
  }
  return out;
}

function buildWallCutoutCutsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean,
  dividerTopZ: number
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
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + CUT_RIM_CLEARANCE;

  // For non-rectangular bins, map each side to the outermost polygon edge
  // facing that direction (silently skipping sides with no matching edge).
  // Rectangular fallback uses the bin AABB.
  const cellMask = params.cellMask;
  const sides: PolygonSideGeometry[] = isPartialMask(cellMask)
    ? (['front', 'back', 'left', 'right'] as const)
        .map((key) =>
          resolvePolygonSideGeometry(cellMask, pitchFromParams(params), wallThickness, key)
        )
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
        },
        cornerSlackFor(side.wallSpan, cutWidth, centerOffset),
        resolveCutoutCornerRadii(params.walls, cfg, cutWidth)
      )
    );
  }

  // Interior divider walls — skip entirely on polygon bins, since
  // compartmentWallsFeature is filtered out for custom shapes and the
  // corresponding divider walls won't exist. Cutting where there's no
  // material would be wasted boolean work (and risks carving the shell
  // if a cut crosses it). Placement honours tilted dividers (dividerOverrides)
  // so the window lands ON the angled wall instead of slicing it at a slant.
  for (const c of computeInteriorDividerCutouts(params, innerW, innerD, dividerTopZ)) {
    cutShapes.push(
      buildSingleCutoutInScope(
        scope,
        cutoutShape,
        c.cutW,
        c.cutH,
        // A divider carries no stacking lip, so its own top face IS the rim the
        // shoulder round-over is tangent to. Given the wall's rim instead, the
        // blend runs its whole radius through the air above the divider and
        // reaches it — if at all — as a sliver hundredths of a millimetre wide.
        CUT_RIM_CLEARANCE,
        extrudeDepth,
        dividerTopZ,
        c,
        c.cornerSlack,
        c.radii
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
import type { BinDimensions } from './pipeline/types';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';

/**
 * Where the interior dividers actually end, in the body frame.
 *
 * The two divider paths do not agree: the multi-cavity cut leaves pockets that
 * reach the rim, so those dividers stand to the wall top, while divider-wall
 * boxes stop at the interior height — a lip taper short of it — or lower still
 * when a design shortens them.
 */
export function interiorDividerTopZ(params: BinParams, dim: BinDimensions): number {
  return dim.compartmentsBakedIntoShell
    ? dim.wallHeight
    : resolveCompartmentDividerHeight(params.compartments.dividerHeight, dim.interiorHeight);
}

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
        // `v2`: interior cutouts are cut from the divider's own top rather than
        // the wall's rim, so the same wall config yields a different cut.
        'v2',
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
        stableSerialize(params.compartments.dividerOverrides ?? []),
        quantize(interiorDividerTopZ(params, dim))
      )
    );
  },
  build: (ctx) => {
    const result = buildWallCutoutCuts(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.dimensions.hasLip,
      interiorDividerTopZ(ctx.params, ctx.dimensions)
    );
    return result ? [result] : null;
  },
};
