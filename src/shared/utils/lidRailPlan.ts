/**
 * Where a lid's click rails sit on each wall, kernel-free.
 *
 * Kept apart from `lidClickRail`, which fuses them, so the designer panel can
 * ask which walls the bin dip leaves without a rail from the placements the
 * worker builds, not from a second derivation that could disagree.
 */

import { maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import { binDipSplitsRails, LID_MIN_RAIL_LENGTH as MIN_RAIL_LENGTH } from '@/shared/types/bin';
import type { BinParams, LidCompatibilitySide, LidRailSide } from '@/shared/types/bin';
import {
  railSegmentsClearOfBlocks,
  railSegmentsClearOfLabelTabs,
  subtractSpan,
  type RailSegment,
} from '@/shared/utils/labelTabPlan';
import { railSegmentsClearOfPolygonGaps } from '@/shared/utils/lipGapPlan';
import { gripPlacements, sideForOutward } from './lidGripPlan';
import { resolveLidInputs } from './lidInputs';
import type { LidInputs } from './lidInputs';

/**
 * One rail to place on a wall: along which axis does the rail extrude
 * ('x' or 'y') and which way does the bump point (+1 or -1 along the
 * perpendicular axis).
 */
export interface RailPlacement {
  readonly side: LidRailSide;
  /**
   * Index of the polygon edge the rail runs along, or null on a rectangle,
   * where `side` already names the wall. A custom shape can face one way
   * along two separate edges on the same line, so neither the side nor the
   * line tells them apart.
   */
  readonly edge: number | null;
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
 *  - Segments the surviving run around this EDGE's lip gaps, then
 *    drops any stretch under MIN_RAIL_LENGTH
 *  - Honors `disabledRails`, which on this path means only a finger scoop
 *
 * The gaps are matched per EDGE rather than per side, and that is the whole
 * reason `polygonGaps` exists alongside `wallBlocks`: a U faces front with two
 * walls, a cutout sits on one of them, and blocking by side name would take the
 * rail off both. A bin with no gaps places exactly what it did before — one
 * rail per edge, centred, at `(edgeLen - 2 * lidCornerR) * coverage`.
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
    polygonGaps,
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

    if (edgeLen - 2 * lidCornerR <= 0) continue;

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

    // The run this edge offers, inset from its corners, in world along-axis
    // coordinates. Segmented around any lip gap on THIS edge — matched
    // by the edge's own cross coordinate, so a U's two front walls are told
    // apart rather than both losing their rail to one cutout.
    const alongX = dy === 0;
    const alongLo = Math.min(alongX ? a.x : a.y, alongX ? b.x : b.y) + lidCornerR;
    const alongHi = Math.max(alongX ? a.x : a.y, alongX ? b.x : b.y) - lidCornerR;
    const edgeCross = alongX ? a.y : a.x;
    const crossPos =
      (alongX ? (a.y + b.y) / 2 : (a.x + b.x) / 2) + (alongX ? inY : inX) * railInset;

    for (const seg of railSegmentsClearOfPolygonGaps(
      [{ lo: alongLo, hi: alongHi }],
      side,
      edgeCross,
      polygonGaps
    )) {
      // Coverage applies per surviving stretch, as on the rectangle path, so a
      // wall with a window yields two short rails rather than one sized for a
      // run it cannot use.
      const railLen = (seg.hi - seg.lo) * clickRailCoverage;
      if (railLen < MIN_RAIL_LENGTH) continue;
      const centre = (seg.lo + seg.hi) / 2;
      placements.push({
        side,
        edge: i,
        centerX: alongX ? centre : crossPos,
        centerY: alongX ? crossPos : centre,
        length: railLen,
        rotationDeg,
      });
    }
  }

  return placements;
}

/** Compute rail placements for a rectangular bin (4 walls). */
function railPlacementsForRectangle(inputs: LidInputs): RailPlacement[] {
  const { lidOuterW, lidOuterD, lidCornerR, disabledRails, clickRails, clickRailCoverage } = inputs;
  const { outerOffsetX: offX, outerOffsetY: offY, labelFootprints, wallBlocks } = inputs;
  // Wall midlines, shifted by the overhang offset so rails ride the lid's
  // (possibly off-center) perimeter rather than the nominal socket grid.
  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  const placements: RailPlacement[] = [];

  /**
   * Coverage applies per surviving stretch, not per wall, so a wall the tabs
   * partly cover yields several short rails rather than one sized for a run it
   * cannot use. A wall they fully cover yields none and goes friction-fit.
   *
   * Dividers, wall cutouts and handle holes cut the same run, after the tabs
   * and in the same frame: all are measured in the bin's centred interior, and
   * `offX`/`offY` are applied below only when the placement is written out,
   * because an overhang translates the cavity and the lid's perimeter by the
   * same amount.
   */
  const pushWallRails = (
    side: LidCompatibilitySide,
    railCross: number,
    rotationDeg: number
  ): void => {
    if (!clickRails[side] || disabledRails.has(side)) return;
    const alongX = rotationDeg === 0 || rotationDeg === 180;
    const half = alongX ? corneredOuterX : corneredOuterY;
    for (const seg of railSegmentsClearOfBlocks(
      railSegmentsClearOfLabelTabs(-half, half, alongX, railCross, labelFootprints),
      side,
      wallBlocks
    )) {
      const length = (seg.hi - seg.lo) * clickRailCoverage;
      if (length < MIN_RAIL_LENGTH) continue;
      const center = (seg.lo + seg.hi) / 2;
      placements.push({
        side,
        edge: null,
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

function isAlongX(rail: RailPlacement): boolean {
  return rail.rotationDeg === 0 || rail.rotationDeg === 180;
}

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
    const alongX = isAlongX(rail);
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

export function binDipEasesRails(params: BinParams): boolean {
  // Forced on: the toggle's help has to warn before the user flips it.
  const dipped = { ...params, lid: { ...params.lid, grip: { ...params.lid.grip, binDip: true } } };
  if (!binDipSplitsRails(dipped)) return false;
  const inputs = resolveLidInputs(dipped);
  const full = railPlacements(inputs);
  const totalLength = (rails: readonly RailPlacement[]): number =>
    rails.reduce((sum, rail) => sum + rail.length, 0);
  // A segment's length is rebuilt from its span ends, so an untouched rail can drift by an ULP.
  return totalLength(full) - totalLength(splitRailsAroundGrip(full, inputs)) > 1e-6;
}

/**
 * Sides with a wall whose every rail the bin dip removed, so that wall holds
 * by friction alone.
 *
 * Shortening a rail is the trade the dip offers; losing all of one is not
 * something the user can see in the preview, which is why the panel names it.
 */
export function railSidesLostToBinDip(params: BinParams): readonly LidRailSide[] {
  if (!binDipSplitsRails(params)) return [];
  const inputs = resolveLidInputs(params);
  const full = railPlacements(inputs);
  const split = splitRailsAroundGrip(full, inputs);
  const wallKey = (rail: RailPlacement): string => `${rail.side}:${rail.edge ?? ''}`;
  const kept = new Set(split.map(wallKey));
  return [...new Set(full.filter((rail) => !kept.has(wallKey(rail))).map((rail) => rail.side))];
}
