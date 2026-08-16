/**
 * Where a bin's stacking lip has been cut away, and what that costs a click
 * rail.
 *
 * A wall cutout always descends from the wall top and overshoots above it, and
 * a handle hole placed high enough reaches the same material — so both leave a
 * stretch of wall with no lip for a rail's bump to hook under. Until a
 * single window cost the whole wall its rail, which on a 40%-wide cutout threw
 * away 60% of the retention it did not have to.
 *
 * This is the OTHER kind of obstruction (see {@link WallSpanBlock}): nothing is
 * in the way, the grip is simply absent. Two consequences, both easy to get
 * wrong:
 *
 * - The interior relief (`lid.relieveInterior`,) does nothing for it.
 *    That ring carves back material that intrudes; it cannot put back material
 *    that was removed, so these blocks apply whether it is on or off.
 *  - Mating the bin and lid and sweeping for interference cannot see it. A rail
 *    hanging over a window collides with nothing at all, so
 *    `worstSeatInterference` reports clean on a lid that does not hold. The
 *    probe this needs asks the opposite question — is there bin material ABOVE
 *    the rail — and lives in `__kernel-tests__/lidSeating.ungrippedRailMm`.
 *
 * Pure and kernel-free for the same reason `labelTabPlan` and `dividerRailPlan`
 * are: the worker that places rails, the panel readout that counts them, and
 * the compatibility warning that explains them all have to agree, and the
 * latter two run on the main thread, which cannot import brepjs.
 */

import type { BinParams, HandleConfig, LidCompatibilitySide } from '@/shared/types/bin';
import { LID_MIN_RAIL_LENGTH } from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { isPartialMask } from '@/shared/utils/cellMask';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import {
  labelTabInteriorDims,
  subtractSpan,
  type RailSegment,
  type WallSpanBlock,
} from '@/shared/utils/labelTabPlan';
import { maskEdgesMm, outermostEdgeForSide } from '@/shared/utils/maskEdgeGeometry';

const WALL_SIDES = ['front', 'back', 'left', 'right'] as const;

/**
 * Air (mm) kept between a rail's cut end and the edge of a lip gap.
 *
 * Not a clearance — the two never touch, since the gap is exactly the place the
 * bin has no material. It stands the rail off a free edge: the lip beside a
 * window is unsupported at the cut and flexes, so the last millimetre of a rail
 * ending flush with it would grip the springiest part of the wall. Matches
 * `DIVIDER_RAIL_MARGIN` rather than `labelTabPlan`'s 2mm, which is sized for a
 * shelf the rail would otherwise interpenetrate.
 */
export const LIP_GAP_RAIL_MARGIN = 1;

/** What removed the lip. The compatibility panel reports the two separately. */
export type LipGapSource = 'cutout' | 'handle';

/** One stretch of one wall where the stacking lip has been cut away. */
export interface LipGap {
  readonly side: LidCompatibilitySide;
  readonly source: LipGapSource;
  /** Along-axis extent, in the bin's centred interior frame. No margin. */
  readonly lo: number;
  readonly hi: number;
  /** The wall's full interior span, so a caller can ask what lip survives. */
  readonly wallSpan: number;
}

/**
 * Z below which a hole through the wall leaves the lip intact, measured above
 * the cavity floor.
 *
 * Deliberately the LIP test and not the rail-band test, which sits ~2mm higher:
 * a friction lid grips the lip's inner face over its whole perimeter and has no
 * rails to segment, so the warning this feeds has to answer the lip question.
 * Erring high would let a rail keep a stretch whose grip is marginal; erring low
 * only costs a rail nobody would miss.
 */
function lipBottomZ(interiorHeight: number): number {
  return interiorHeight - GRIDFINITY_SPEC.LIP_HEIGHT;
}

/**
 * Every stretch of outer wall this design actually opens through the lip.
 *
 * Mirrors `wallCutoutBuilder` and `handleBuilder` gate for gate, because a gap
 * reported where no hole is cut costs a rail for nothing — the exact defect
 * Is about, in miniature. The gates that bite in practice: handles are
 * skipped entirely on a slotted bin and on the BACK wall of a bin with label
 * tabs, and a hole clamped under 1mm tall is not built at all.
 *
 * Rectangular footprints only. A polygon bin's cutouts and handles are cut
 * against resolved polygon edges rather than the interior AABB, and its rails
 * are placed by `railPlacementsForPolygon`, which does no clipping at all —
 *.
 */
export function lipGaps(params: BinParams): readonly LipGap[] {
  if (isPartialMask(params.cellMask)) return [];
  const dims = labelTabInteriorDims(params);
  if (!dims) return [];
  const spanOf = (side: LidCompatibilitySide): number =>
    side === 'front' || side === 'back' ? dims.innerW : dims.innerD;

  const out: LipGap[] = [];
  for (const side of WALL_SIDES) {
    const wallSpan = spanOf(side);
    for (const g of wallGaps(params, dims, side, wallSpan)) {
      // A rectangle's wall is centred on the interior origin, so its local
      // coordinates are already the bin's.
      out.push({
        side,
        source: g.source,
        lo: g.centre - g.width / 2,
        hi: g.centre + g.width / 2,
        wallSpan,
      });
    }
  }
  return out;
}

/** One opening, in coordinates local to the wall it sits on. */
interface WallGap {
  readonly source: LipGapSource;
  /** Offset from the wall's own midpoint, along the wall. */
  readonly centre: number;
  readonly width: number;
}

/**
 * Every opening one wall carries, measured from that wall's midpoint.
 *
 * Wall-local rather than bin-centred so the rectangle and polygon paths share
 * it: they disagree only about where a wall IS and how long it is, never about
 * what a cutout or a handle does to it. Splitting on that boundary is what
 * keeps the builders' gates — the slotted skip, the back-wall-with-labels skip,
 * the sub-1mm clamp, the end gaps a full-width handle cannot fit inside —
 * written once for both.
 */
function wallGaps(
  params: BinParams,
  dims: NonNullable<ReturnType<typeof labelTabInteriorDims>>,
  side: LidCompatibilitySide,
  wallSpan: number
): readonly WallGap[] {
  const { wallHeight, interiorHeight } = dims;
  const wallThickness = params.wallThickness;
  const out: WallGap[] = [];
  if (wallSpan <= 0) return out;

  // Wall cutouts. No Z test: the profile is positioned with its top at
  // `wallHeight + overshoot` where the overshoot alone exceeds the lip, so any
  // cutout the builder emits removes the lip across its whole span.
  const cfg = params.walls[side];
  if (params.walls.enabled && cfg.enabled) {
    const cutWidth =
      cfg.widthMm !== null ? Math.min(cfg.widthMm, wallSpan) : wallSpan * (cfg.width / 100);
    // The builder measures depth against the wall MINUS one thickness, not
    // against the cavity ceiling. Only decides whether the cut is built.
    const userCutHeight = (wallHeight - wallThickness) * (cfg.depth / 100);
    if (cutWidth > 0 && cfg.depth > 0 && cutWidth >= 0.1 && userCutHeight >= 0.1) {
      out.push({
        source: 'cutout',
        centre: computeCutoutCenter(wallSpan, cutWidth, wallThickness, cfg.alignment, cfg.offset),
        width: cutWidth,
      });
    }
  }

  // Handle holes. Unlike a cutout these are windows in the middle of the wall,
  // so a hole low enough leaves the lip whole and takes nothing.
  const handles: HandleConfig = params.handles;
  if (!handles.enabled || params.style === 'slotted' || handles.height <= 0) return out;
  const sideCfg = handles[side];
  if (!sideCfg.enabled) return out;
  // A label tab owns the back wall's interior face, so the builder skips the
  // hole outright rather than cutting through the shelf.
  if (side === 'back' && params.label.enabled) return out;

  const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
    interiorHeight,
    sideCfg.height ?? handles.height,
    handles.verticalPosition
  );
  if (effectiveHeight < 1) return out;
  if (centerZ + effectiveHeight / 2 <= lipBottomZ(interiorHeight)) return out;

  const sideWidth = sideCfg.width ?? handles.width;
  const segments = computeWallHandleSegments(
    wallSpan,
    sideWidth,
    wallThickness,
    params.walls.enabled ? params.walls[side] : undefined
  );
  if (!segments) return out;
  // Multi-handle offsets translate the whole segment set, which is how the
  // builder composes the two: a wall with a cutout and three handles cuts each
  // surviving segment once per handle position.
  for (const handleOffset of computeMultiHandleOffsets(
    handles.count,
    wallSpan,
    wallSpan * (sideWidth / 100)
  )) {
    for (const seg of segments) {
      out.push({ source: 'handle', centre: seg.offset + handleOffset, width: seg.width });
    }
  }
  return out;
}

/**
 * The gaps as rail blocks, widened by {@link LIP_GAP_RAIL_MARGIN}.
 *
 * Takes an already-computed plan rather than `BinParams` so a caller that also
 * needs the sides (the panel) walks the design once.
 */
export function lipGapRailBlocks(gaps: readonly LipGap[]): readonly WallSpanBlock[] {
  return gaps.map((g) => ({
    side: g.side,
    lo: g.lo - LIP_GAP_RAIL_MARGIN,
    hi: g.hi + LIP_GAP_RAIL_MARGIN,
  }));
}

/** Walls that lose some lip to `source`. Drives the panel's warning rows. */
export function lipGapSides(
  // Structural, so the rectangle and polygon plans both feed it — the question
  // is only which walls carry a gap, which neither frame changes.
  gaps: readonly { readonly side: LidCompatibilitySide; readonly source: LipGapSource }[],
  source: LipGapSource
): readonly LidCompatibilitySide[] {
  const sides = new Set(gaps.filter((g) => g.source === source).map((g) => g.side));
  return WALL_SIDES.filter((s) => sides.has(s));
}

/**
 * Walls `source` has left with no usable lip.
 *
 * The blocker's real question. "A cutout is enabled on all four sides" is not
 * the same as "there is no lip anywhere", and treating it as such is what made
 * four 40%-wide windows refuse to generate a lid that the same four windows on
 * three walls generated happily.
 *
 * "Usable" is `LID_MIN_RAIL_LENGTH` rather than a literal zero, because a
 * literal zero is unreachable for one of the two sources and far too generous
 * for the other. `computeMultiHandleOffsets` reserves 3mm of wall at each end,
 * so no arrangement of handles ever clears a whole span — the blocker would be
 * dead code — while a 98%-wide cutout leaves 0.8mm in each corner and is
 * plainly not a grip either. The threshold the rail placement already uses to
 * decide a stretch is not worth building answers both, and answers them the
 * same way.
 *
 * Merges the gaps rather than testing each: two handles either side of a
 * central cutout can jointly clear a wall no one of them covers.
 */
export function unlippedSides(
  gaps: readonly LipGap[],
  source: LipGapSource
): readonly LidCompatibilitySide[] {
  return WALL_SIDES.filter((side) => {
    const own = gaps.filter((g) => g.side === side && g.source === source);
    if (own.length === 0) return false;
    const half = own[0].wallSpan / 2;
    // Walk the merged union left to right; the widest daylight it leaves is the
    // longest stretch of lip that survives.
    let reached = -half;
    let longest = 0;
    for (const g of [...own].sort((a, b) => a.lo - b.lo)) {
      longest = Math.max(longest, g.lo - reached);
      reached = Math.max(reached, g.hi);
    }
    longest = Math.max(longest, half - reached);
    return longest < LID_MIN_RAIL_LENGTH;
  });
}

/**
 * One stretch of one POLYGON edge where the lip has been cut away.
 *
 * Carries the edge's own cross-axis coordinate rather than just a side name,
 * because a custom shape can face one direction with several edges — a U has
 * two front walls — and a cutout is placed on exactly one of them. Blocking by
 * side alone would take the rail off both.
 */
export interface PolygonLipGap {
  readonly side: LidCompatibilitySide;
  readonly source: LipGapSource;
  /** Constant coordinate of the edge this gap sits on, in centred mm. */
  readonly edgeCross: number;
  /** Along-axis extent in centred mm, on that edge's axis. */
  readonly lo: number;
  readonly hi: number;
}

/**
 * Lip gaps on a custom-shape footprint.
 *
 * The live half of that issue: `wallCutoutsFeature` and `handlesFeature` both
 * declare `supportsCellMask`, and `FeatureGate` only greys the controls out, so
 * a polygon bin really does get its cutouts and handles cut — against resolved
 * polygon edges — while `railPlacementsForPolygon` clipped nothing at all. The
 * result was a rail running the full length of a wall with a window in it.
 *
 * Placement mirrors `resolvePolygonSideGeometry` exactly, and has to: the wall
 * span a percentage width is taken of is the EDGE's span less the clearance and
 * two walls, not the bin's bounding box. Reading the bounding box instead makes
 * every gap on a stepped shape the wrong width and the wrong place.
 */
export function polygonLipGaps(params: BinParams): readonly PolygonLipGap[] {
  const mask = params.cellMask;
  if (!isPartialMask(mask)) return [];
  const dims = labelTabInteriorDims(params);
  if (!dims) return [];

  const unitX = params.gridUnitMm;
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  const edges = maskEdgesMm(mask, unitX, unitY);
  const wallThickness = params.wallThickness;

  const out: PolygonLipGap[] = [];
  for (const side of WALL_SIDES) {
    const edge = outermostEdgeForSide(edges, side);
    if (!edge) continue;
    const alongX = side === 'front' || side === 'back';
    // Same derivation `resolvePolygonSideGeometry` uses for its `wallSpan`.
    const wallSpan = edge.length - GRIDFINITY_SPEC.TOLERANCE - 2 * wallThickness;
    if (wallSpan <= 0) continue;

    const alongMid = alongX ? edge.midX : edge.midY;
    const edgeCross = alongX ? edge.midY : edge.midX;
    for (const g of wallGaps(params, dims, side, wallSpan)) {
      out.push({
        side,
        source: g.source,
        edgeCross,
        lo: alongMid + g.centre - g.width / 2,
        hi: alongMid + g.centre + g.width / 2,
      });
    }
  }
  return out;
}

/** Tolerance (mm) on matching a gap to the edge it was measured against. */
const EDGE_MATCH_TOL = 0.01;

/**
 * Cut a polygon edge's rail run down around the gaps on THAT edge.
 *
 * Matched on the edge's own cross coordinate, not its side name, so a U's two
 * front walls keep their own rails when only one carries a cutout.
 */
export function railSegmentsClearOfPolygonGaps(
  segments: readonly RailSegment[],
  side: LidCompatibilitySide,
  edgeCross: number,
  gaps: readonly PolygonLipGap[]
): RailSegment[] {
  let out = [...segments];
  for (const g of gaps) {
    if (g.side !== side) continue;
    if (Math.abs(g.edgeCross - edgeCross) > EDGE_MATCH_TOL) continue;
    out = subtractSpan(out, g.lo - LIP_GAP_RAIL_MARGIN, g.hi + LIP_GAP_RAIL_MARGIN);
    if (out.length === 0) break;
  }
  return out;
}
