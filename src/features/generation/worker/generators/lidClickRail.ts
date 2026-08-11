/**
 * Click rails — snap features extruded along each straight wall of the lid.
 *
 * Cross-section (X = outward from corner-radius line, Y = vertical):
 *   The polygon has its top at Z=wallBottom (just below the mating wall),
 *   protrudes OUTWARD by LID_CLICK_RAIL_OUT to form the rail bump that
 *   catches the lip's bottom chamfer, drops down, then has an inner shelf
 *   that gives the rail body structural depth.
 *
 * Each rail is built in a canonical orientation (extrusion along X axis,
 * profile in YZ plane), then translated/rotated to each straight wall.
 * Rails are inset from corners by `lidCornerR` on both ends.
 */

import { draw, unwrap, fuse, translate, rotate } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing } from 'brepjs';
import {
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_SHOULDER,
  LID_CLICK_RAIL_DROP_BELOW_WALL,
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INSET,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
} from './lidConstants';
import { maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_MIN_RAIL_LENGTH as MIN_RAIL_LENGTH } from '@/shared/types/bin';
import { gripPlacements, sideForOutward } from './lidGripRelief';
import type { LidInputs } from './lidInputs';
import {
  railSegmentsClearOfLabelTabs,
  subtractSpan,
  type RailSegment,
} from '@/shared/utils/labelTabPlan';
import type { LidCompatibilitySide } from '@/shared/types/bin';

/** True when at least one side carries a rail, i.e. the lid is not friction-fit. */
export function hasAnyClickRail(rails: LidInputs['clickRails']): boolean {
  return rails.front || rails.back || rails.left || rails.right;
}

/**
 * Top-chamfer apex X for a rail bar, given the cavity wall's rail-local X.
 *
 * The chamfer slopes 45° from the rail's inner-face top corner up to this
 * apex; we want the apex to land on the cavity wall so the rail attaches
 * flush instead of leaving an unsupported tongue hanging into the cavity.
 * When the cavity wall is at or inboard of the spine (LID_WALL_THICKNESS
 * ≳ 1.85mm), the apex falls back to the baseline 0.8mm chamfer width.
 *
 * Exported for unit testing of the geometric relationship.
 */
export function chamferApexXForCavityWall(cavityWallX: number): number {
  return Math.max(LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER, cavityWallX);
}

/**
 * Build the rail's 2D cross-section.
 *
 * @param wallBottomZ Z of the rail's top face (= bottom of mating wall).
 * @param cavityWallX Rail-local X of the lid's cavity inner face. The rail
 *   spine sits at X=0 and is anchored at the lid's corner-radius line; the
 *   cavity wall sits at `lidCornerR - cavityInset` away from the spine in
 *   the outward (+X) direction. The top chamfer's apex extends to meet
 *   this position so the rail attaches flush to the cavity wall instead
 *   of leaving an unsupported tongue hanging in midair.
 */
function clickShape2D(wallBottomZ: number, cavityWallX: number): Drawing {
  // Top of polygon = top of rail = bottom of mating wall.
  const yTop = wallBottomZ;
  // Y heights stepping down from the rail's top.
  const y1 = yTop - LID_CLICK_RAIL_ENTRY_CHAMFER; // -0.8
  const y2 = y1 - LID_CLICK_RAIL_BUMP - LID_CLICK_RAIL_SHOULDER; // rail body bottom
  const y3 = y2 - LID_CLICK_RAIL_EXIT_CHAMFER; // exit chamfer
  const y4 = y3 - LID_CLICK_RAIL_DROP; // post-bump drop
  const y5 = yTop - LID_CLICK_RAIL_DROP_BELOW_WALL; // bottom apex (== y4 - TAIL)

  const chamferApexX = chamferApexXForCavityWall(cavityWallX);
  const chamferTopY = yTop + (chamferApexX - LID_CLICK_RAIL_INNER);

  return draw([chamferApexX, yTop])
    .lineTo([LID_CLICK_RAIL_OUT, yTop])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y1])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y2])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y3])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y4])
    .lineTo([0, y5])
    .lineTo([LID_CLICK_RAIL_INNER, y5])
    .lineTo([LID_CLICK_RAIL_INNER, yTop])
    .lineTo([chamferApexX, chamferTopY])
    .close();
}

/**
 * Build a single click rail bar in a canonical orientation: extruded along
 * the X axis (length = wallLength), profile in YZ plane at X=0. The rail's
 * outward direction is +Y (so the bump protrudes in +Y), and its top sits
 * at Z=wallBottomZ.
 */
function buildClickRailBar(
  scope: DisposalScope,
  wallBottomZ: number,
  cavityWallX: number,
  length: number
): Shape3D {
  // Build polygon in a 2D plane where local X = outward, local Y = vertical.
  // Sketch on YZ plane (perpendicular to wall direction = X axis).
  const profile = clickShape2D(wallBottomZ, cavityWallX);
  const sketch = profile.sketchOnPlane('YZ', -length / 2);
  return scope.register(sketch.extrude(length));
}

/**
 * One rail to place on a wall: along which axis does the rail extrude
 * ('x' or 'y') and which way does the bump point (+1 or -1 along the
 * perpendicular axis).
 */
export interface RailPlacement {
  /** Rail center position in world coords. */
  readonly centerX: number;
  readonly centerY: number;
  /** Length along the extrusion axis. */
  readonly length: number;
  /** Z rotation in degrees that maps the canonical bar to the target orientation. */
  readonly rotationDeg: number;
}

/**
 * Compute rail placements for a polygon bin.
 *
 * Walks the polygon's outer loop. For each axis-aligned edge:
 *  - Computes inward normal (interior is on LEFT of edge direction in CCW)
 *  - Outward = -inward
 *  - Insets the edge by `lidCornerR` from each end so the rail stays clear
 *    of corners (which are filled mating-shell pillars)
 *  - Skips edges shorter than MIN_RAIL_LENGTH after inset
 *  - Honors `disabledRails` (per-side conflict overrides driven by
 *    labels, wall cutouts, and intruding handles)
 */
function railPlacementsForPolygon(inputs: LidInputs): RailPlacement[] {
  const {
    cellMask,
    gridUnitMm,
    gridUnitMmY,
    lidCornerR,
    fitClearance,
    disabledRails,
    clickRails,
    clickRailCoverage,
  } = inputs;
  if (!cellMask) return [];

  const loops = maskToPolygon(cellMask);
  const outer = loops[0];
  // Non-square grids stretch mask columns by X and rows by Y independently.
  const halfWidthMm = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;

  const verticesMm = outer.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMmY - halfDepthMm,
  }));

  const railInset = fitClearance + lidCornerR;
  const n = verticesMm.length;
  const placements: RailPlacement[] = [];

  for (let i = 0; i < n; i++) {
    const a = verticesMm[i];
    const b = verticesMm[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.abs(dx) + Math.abs(dy); // axis-aligned

    // Rail spans the edge minus 2× corner radius (clear of corners), then
    // shrunk to `clickRailCoverage` (centered on the wall). Skip if the
    // resulting rail is too short to be useful.
    const railLen = (edgeLen - 2 * lidCornerR) * clickRailCoverage;
    if (railLen < MIN_RAIL_LENGTH) continue;

    const edgeDirX = Math.sign(dx);
    const edgeDirY = Math.sign(dy);
    // Outward normal: right-perpendicular of edge direction (CCW polygon).
    const outX = edgeDirY;
    const outY = -edgeDirX;
    const inX = -outX;
    const inY = -outY;

    // Classify the edge by outward direction so we can apply the user's
    // per-side toggle. `null` is a non-axis-aligned edge, which a cellMask
    // polygon should never produce. Shared with the grip relief so the two
    // cannot disagree about which wall is `left` or how it is rotated — they
    // are matched against each other in `splitRailsAroundGrip`.
    const classified = sideForOutward(outX, outY);
    if (!classified) continue;
    const { side, rotationDeg } = classified;

    if (!clickRails[side]) continue;
    if (disabledRails.has(side)) continue;

    const midX = (a.x + b.x) / 2 + inX * railInset;
    const midY = (a.y + b.y) / 2 + inY * railInset;

    placements.push({
      centerX: midX,
      centerY: midY,
      length: railLen,
      rotationDeg,
    });
  }

  return placements;
}

/** Compute rail placements for a rectangular bin (4 walls). */
function railPlacementsForRectangle(inputs: LidInputs): RailPlacement[] {
  const { lidOuterW, lidOuterD, lidCornerR, disabledRails, clickRails, clickRailCoverage } = inputs;
  const { outerOffsetX: offX, outerOffsetY: offY, labelFootprints } = inputs;
  // Wall midlines, shifted by the overhang offset so rails ride the lid's
  // (possibly off-center) perimeter rather than the nominal socket grid.
  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  const placements: RailPlacement[] = [];

  /**
   * Coverage applies per surviving stretch, not per wall, so a wall the tabs
   * partly cover yields several short rails rather than one sized for a run it
   * cannot use. A wall they fully cover yields none and goes friction-fit.
   */
  const pushWallRails = (
    side: LidCompatibilitySide,
    railCross: number,
    rotationDeg: number
  ): void => {
    if (!clickRails[side] || disabledRails.has(side)) return;
    const alongX = rotationDeg === 0 || rotationDeg === 180;
    const half = alongX ? corneredOuterX : corneredOuterY;
    for (const seg of railSegmentsClearOfLabelTabs(
      -half,
      half,
      alongX,
      railCross,
      labelFootprints
    )) {
      const length = (seg.hi - seg.lo) * clickRailCoverage;
      if (length < MIN_RAIL_LENGTH) continue;
      const center = (seg.lo + seg.hi) / 2;
      placements.push({
        centerX: (alongX ? center : railCross) + offX,
        centerY: (alongX ? railCross : center) + offY,
        length,
        rotationDeg,
      });
    }
  };

  pushWallRails('back', corneredOuterY, 0);
  pushWallRails('front', -corneredOuterY, 180);
  pushWallRails('right', corneredOuterX, -90);
  pushWallRails('left', -corneredOuterX, 90);

  return placements;
}

/**
 * Quiet zone (mm) kept between a grip relief and the nearest rail segment.
 *
 * Not a clearance — a relief cuts UPWARD from `anchorZ` and a rail's top sits
 * at `wallBottomZ`, below it, so the two never touch. The margin widens the
 * soft zone past the relief's own span.
 */
const GRIP_RAIL_MARGIN = 2;

/**
 * Slack (mm) on the rail-to-grip wall-line match.
 *
 * The nominal gap is exactly `lidCornerR`; this only absorbs floating-point
 * drift. It must stay far below the distance between two parallel same-facing
 * edges of a polygon lid (a grid unit, 42mm) or the two would alias.
 */
const GRIP_WALL_MATCH_TOL = 0.01;

/**
 * Interrupt each rail that runs behind a grip relief, leaving a segment on
 * either side.
 *
 * Gated on `binDip`, NOT on the relief alone. Since relief and rail never
 * intersect, splitting is not a fix for anything — it trades snap retention
 * for an easier opening, and only a user who also dipped the bin's lip has
 * asked for that trade. A plain chamfer or shadow line keeps its rails whole.
 *
 * Rails and reliefs are matched on the wall LINE (cross-axis position) plus
 * orientation, then by overlap along it. All three terms are load-bearing: a
 * polygon lid can carry two parallel edges facing the same way, so orientation
 * and along-overlap alone would let one edge's relief cut the other's rail,
 * and matching on side name has the same defect. Both placement paths put a
 * grip exactly `lidCornerR` outboard of its own rail (the grip sits on the
 * outer face, the rail on the corner-radius line), while two parallel
 * same-facing edges are at least a grid unit apart, so that gap identifies the
 * wall unambiguously.
 *
 * Subtracting the grip's blocked span from the rail's own span handles a rail
 * sitting anywhere along its wall, which a label tab routinely causes. A rail
 * wholly behind the grip drops out rather than splitting into two slivers.
 */
export function splitRailsAroundGrip(
  placements: readonly RailPlacement[],
  inputs: LidInputs
): RailPlacement[] {
  if (!inputs.gripSoftensSnap) return [...placements];
  const grips = gripPlacements(inputs);
  if (grips.length === 0) return [...placements];

  const out: RailPlacement[] = [];

  for (const rail of placements) {
    // Front/back walls run along X; left/right along Y.
    const alongX = rail.rotationDeg === 0 || rail.rotationDeg === 180;
    const railAlong = alongX ? rail.centerX : rail.centerY;

    let spans: RailSegment[] = [
      { lo: railAlong - rail.length / 2, hi: railAlong + rail.length / 2 },
    ];
    const railCross = alongX ? rail.centerY : rail.centerX;
    for (const grip of grips) {
      if (grip.rotationDeg !== rail.rotationDeg) continue;
      const gripCross = alongX ? grip.centerY : grip.centerX;
      if (Math.abs(gripCross - railCross) > inputs.lidCornerR + GRIP_WALL_MATCH_TOL) continue;
      const gripAlong = alongX ? grip.centerX : grip.centerY;
      const blockLo = gripAlong - grip.spanMm / 2 - GRIP_RAIL_MARGIN;
      const blockHi = gripAlong + grip.spanMm / 2 + GRIP_RAIL_MARGIN;
      spans = subtractSpan(spans, blockLo, blockHi);
      if (spans.length === 0) break;
    }

    for (const span of spans) {
      const length = span.hi - span.lo;
      if (length < MIN_RAIL_LENGTH) continue;
      const centre = (span.lo + span.hi) / 2;
      out.push({
        ...rail,
        length,
        centerX: alongX ? centre : rail.centerX,
        centerY: alongX ? rail.centerY : centre,
      });
    }
  }
  return out;
}

/**
 * Full-length rail placements for this lid, before any grip relief interrupts
 * them. Exported so tests exercise the real placements rather than a
 * re-derivation of the same arithmetic.
 */
export function railPlacements(inputs: LidInputs): RailPlacement[] {
  return inputs.cellMask ? railPlacementsForPolygon(inputs) : railPlacementsForRectangle(inputs);
}

export function addClickRails(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const placements = splitRailsAroundGrip(railPlacements(inputs), inputs);

  // Cavity wall position in rail-local X (where +X is outward from the
  // spine). The spine sits at `lidCornerR` from the lid outer; the cavity
  // wall sits at `cavityInset`. Their difference tells the rail's chamfer
  // how far outward it needs to climb to meet the wall flush.
  const cavityWallX = inputs.lidCornerR - inputs.cavityInset;

  let result = body;
  for (const place of placements) {
    const rail = buildClickRailBar(scope, inputs.wallBottomZ, cavityWallX, place.length);
    const oriented =
      place.rotationDeg === 0
        ? rail
        : scope.register(rotate(rail, place.rotationDeg, { axis: [0, 0, 1] }));
    const positioned = scope.register(translate(oriented, [place.centerX, place.centerY, 0]));
    if (originToTag) {
      collectOrigins(positioned, FeatureTag.LID_RAIL, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, positioned));
  }
  return result;
}
