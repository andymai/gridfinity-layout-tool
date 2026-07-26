/**
 * "Expand to Fit": grow the selected bins until they fill the empty space
 * around them, with no gaps between them.
 *
 * A bin's footprint is locked to 0.5-unit multiples, so it can never be a size
 * the grid cannot express — the reason three equal columns across a 7-unit
 * drawer (98mm each, 2⅓ units) were previously unbuildable. `Bin.overhang`
 * grows a body outward in mm while the feet stay at the nominal footprint, and
 * this module computes the positions and overhangs that make a selection tile
 * a span exactly.
 *
 * Footprints are never changed. The design owns width/depth (they sync design →
 * bin), so resizing here would desynchronise linked bins from the geometry that
 * actually gets printed. Position and overhang only.
 *
 * The invariant that makes this safe: for slice `[sliceStart, sliceEnd]` and a
 * socket at `p`, `L = p - sliceStart` and `R = sliceEnd - (p + w)`, so the body
 * spans `sliceStart..sliceEnd` for ANY legal `p`. Zero gaps are structural, not
 * a rounding accident — which also frees `p` to be chosen for the best foot
 * placement rather than to make the arithmetic work.
 */

import type { Bin, BinId, Layout, StoredBaseplateParams } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { createOccupiedCellSet } from '@/shared/utils/fill';
import type { OverhangConfig } from '@/core/types';

/** Placement granularity. Always half-unit: an expansion may produce fractional
 *  positions (and enables half-grid mode as a consequence), so scanning at whole
 *  units would mis-detect a bin already parked at x.5 from an earlier run. */
const STEP = 0.5;

/** Outward-only per-side ceiling (mm) — half a 42mm grid unit. Mirrors the
 *  designer's `MAX_OVERHANG`; beyond it the honest answer is "your bins are too
 *  small for this span", not a larger cantilever. */
const MAX_SIDE_MM = 21;

/** Grid-unit slack for boundary comparisons. */
const EPS = 1e-6;

export type ExpandBlockedReason =
  /** Selection isn't a clean row/column/grid, spans layers, or is all staging. */
  | 'ragged'
  /** Nothing to absorb — the bins already meet their neighbours. */
  | 'no-slack'
  /** A share of the slack exceeds what an overhang may cover. */
  | 'slack-exceeds-overhang'
  /**
   * A slice has slack, but too little to contain a legal (half-unit) socket
   * origin, so the bodies can't tile without a socket poking outside its slice.
   * Reachable with sub-millimetre baseplate padding on an exactly-filled grid:
   * the span starts off-grid and the share is a fraction of a half-unit.
   */
  | 'no-grid-alignment';

export interface ExpandPlacement {
  readonly binId: BinId;
  readonly x: number;
  readonly y: number;
  readonly overhang: OverhangConfig;
}

export type ExpandResult =
  | { readonly ok: true; readonly placements: readonly ExpandPlacement[] }
  | { readonly ok: false; readonly reason: ExpandBlockedReason };

/** One axis of the problem, in mm, with the selection's lanes along it. */
interface AxisPlan {
  /** Per-bin slice bounds (mm), index-aligned with the lane's bins. */
  readonly slices: readonly { readonly start: number; readonly end: number }[];
}

/**
 * Largest legal socket origin (a multiple of `STEP`, in units) whose footprint
 * of `wUnits` fits inside `[startMm, endMm]`, chosen to minimise the larger of
 * the two overhangs so the feet sit as centrally under the body as the grid
 * allows. Returns null when no legal origin fits.
 */
function centredOrigin(
  startMm: number,
  endMm: number,
  wUnits: number,
  pitchMm: number
): number | null {
  const startU = startMm / pitchMm;
  const endU = endMm / pitchMm;
  const lo = Math.ceil((startU - EPS) / STEP) * STEP;
  const hi = Math.floor((endU - wUnits + EPS) / STEP) * STEP;
  if (hi < lo - EPS) return null;

  // Ideal (unsnapped) origin centres the socket in its slice.
  const ideal = startU + (endU - startU - wUnits) / 2;
  const snapped = Math.round(ideal / STEP) * STEP;
  return Math.min(hi, Math.max(lo, snapped));
}

/** Distinct sorted coordinates, treating near-equal values as one lane. */
function lanesOf(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > EPS) out.push(v);
  }
  return out;
}

/**
 * Grow `[lo, hi]` (units) outward along one axis until it meets an occupied cell
 * or the drawer edge. `otherLo`/`otherHi` bound the perpendicular extent that
 * must be clear for a step to be taken, so growth stops at anything the
 * selection would actually collide with.
 */
function growSpan(
  lo: number,
  hi: number,
  otherLo: number,
  otherHi: number,
  limit: number,
  occupied: Set<string>,
  axis: 'x' | 'y'
): { lo: number; hi: number } {
  /** Is the whole perpendicular extent of the lane at `coord` unoccupied? */
  const laneIsClear = (coord: number): boolean => {
    for (let o = otherLo; o < otherHi - EPS; o += STEP) {
      const key = axis === 'x' ? `${coord},${o}` : `${o},${coord}`;
      if (occupied.has(key)) return false;
    }
    return true;
  };
  let newLo = lo;
  while (newLo - STEP >= -EPS && laneIsClear(newLo - STEP)) newLo -= STEP;
  let newHi = hi;
  while (newHi + STEP <= limit + EPS && laneIsClear(newHi)) newHi += STEP;
  return { lo: newLo, hi: newHi };
}

/**
 * Divide `[spanStartMm, spanEndMm]` among sockets of the given widths, giving
 * each bin an equal share of the leftover slack. Slices tile the span exactly.
 */
function planAxis(
  spanStartMm: number,
  spanEndMm: number,
  socketWidthsMm: readonly number[]
): AxisPlan {
  const totalSockets = socketWidthsMm.reduce((a, b) => a + b, 0);
  const slack = spanEndMm - spanStartMm - totalSockets;
  const share = slack / socketWidthsMm.length;
  const slices: { start: number; end: number }[] = [];
  let cursor = spanStartMm;
  for (const w of socketWidthsMm) {
    const start = cursor;
    const end = start + w + share;
    slices.push({ start, end });
    cursor = end;
  }
  return { slices };
}

/**
 * Compute positions + overhangs so the selected bins fill the space around them.
 *
 * Works on one bin (it absorbs its own surrounding gap) or many. The axis is
 * inferred: a row expands across, a column in depth, a grid on both. An axis
 * with no slack is left alone.
 */
export function resolveExpandToFit(
  bins: readonly Bin[],
  selectedIds: readonly BinId[],
  layout: Layout,
  baseplate: StoredBaseplateParams | undefined
): ExpandResult {
  const selectedSet = new Set(selectedIds);
  const selected = bins.filter((b) => selectedSet.has(b.id) && b.layerId !== STAGING_ID);
  if (selected.length === 0) return { ok: false, reason: 'ragged' };

  // One layer only — each layer has its own grid, so a cross-layer selection has
  // no single span to divide.
  const layerId = selected[0].layerId;
  if (selected.some((b) => b.layerId !== layerId)) return { ok: false, reason: 'ragged' };

  const pitchX = layout.gridUnitMm;
  const pitchY = effectiveGridUnitMmY(layout);
  if (pitchX <= 0 || pitchY <= 0) return { ok: false, reason: 'ragged' };

  const cols = lanesOf(selected.map((b) => b.x));
  const rows = lanesOf(selected.map((b) => b.y));

  // A clean row, column, or full grid: every lane intersection is filled exactly
  // once, and each column shares a width / each row a depth. Anything else has
  // no unambiguous per-lane slice.
  if (cols.length * rows.length !== selected.length) return { ok: false, reason: 'ragged' };
  const laneOf = (v: number, lanes: readonly number[]): number =>
    lanes.findIndex((l) => Math.abs(l - v) <= EPS);
  const seen = new Set<string>();
  for (const b of selected) {
    const ci = laneOf(b.x, cols);
    const ri = laneOf(b.y, rows);
    if (ci < 0 || ri < 0) return { ok: false, reason: 'ragged' };
    const key = `${ci},${ri}`;
    if (seen.has(key)) return { ok: false, reason: 'ragged' };
    seen.add(key);
  }
  const widthOfCol = cols.map((c) => {
    const inCol = selected.filter((b) => Math.abs(b.x - c) <= EPS);
    return inCol[0].width;
  });
  const depthOfRow = rows.map((r) => {
    const inRow = selected.filter((b) => Math.abs(b.y - r) <= EPS);
    return inRow[0].depth;
  });
  if (selected.some((b) => Math.abs(b.width - widthOfCol[laneOf(b.x, cols)]) > EPS)) {
    return { ok: false, reason: 'ragged' };
  }
  if (selected.some((b) => Math.abs(b.depth - depthOfRow[laneOf(b.y, rows)]) > EPS)) {
    return { ok: false, reason: 'ragged' };
  }

  // Obstacles: same-layer bins (excluding the selection), blocked zones from
  // lower layers, and cells outside a non-rectangular drawer outline.
  const others = bins.filter((b) => !selectedSet.has(b.id));
  const occupied = createOccupiedCellSet(others, layerId, layout, STEP);

  const selLoX = Math.min(...selected.map((b) => b.x));
  const selHiX = Math.max(...selected.map((b) => b.x + b.width));
  const selLoY = Math.min(...selected.map((b) => b.y));
  const selHiY = Math.max(...selected.map((b) => b.y + b.depth));

  const spanX = growSpan(selLoX, selHiX, selLoY, selHiY, layout.drawer.width, occupied, 'x');
  const spanY = growSpan(selLoY, selHiY, selLoX, selHiX, layout.drawer.depth, occupied, 'y');

  // Baseplate padding sits OUTSIDE the grid extent, so a span that reached a
  // drawer edge also claims that edge's margin.
  const padAt = (reached: boolean, mm: number | undefined): number =>
    reached ? Math.max(0, mm ?? 0) : 0;
  const startXmm = spanX.lo * pitchX - padAt(spanX.lo <= EPS, baseplate?.paddingLeft);
  const endXmm =
    spanX.hi * pitchX +
    padAt(Math.abs(spanX.hi - layout.drawer.width) <= EPS, baseplate?.paddingRight);
  const startYmm = spanY.lo * pitchY - padAt(spanY.lo <= EPS, baseplate?.paddingFront);
  const endYmm =
    spanY.hi * pitchY +
    padAt(Math.abs(spanY.hi - layout.drawer.depth) <= EPS, baseplate?.paddingBack);

  const socketWmm = widthOfCol.map((w) => w * pitchX);
  const socketDmm = depthOfRow.map((d) => d * pitchY);
  const slackX = endXmm - startXmm - socketWmm.reduce((a, b) => a + b, 0);
  const slackY = endYmm - startYmm - socketDmm.reduce((a, b) => a + b, 0);
  if (slackX <= EPS && slackY <= EPS) return { ok: false, reason: 'no-slack' };

  const planX = planAxis(startXmm, endXmm, socketWmm);
  const planY = planAxis(startYmm, endYmm, socketDmm);

  const placements: ExpandPlacement[] = [];
  for (const b of selected) {
    const ci = laneOf(b.x, cols);
    const ri = laneOf(b.y, rows);
    const sx = planX.slices[ci];
    const sy = planY.slices[ri];

    const originX = centredOrigin(sx.start, sx.end, b.width, pitchX);
    const originY = centredOrigin(sy.start, sy.end, b.depth, pitchY);
    if (originX === null || originY === null) {
      return { ok: false, reason: 'no-grid-alignment' };
    }

    const left = originX * pitchX - sx.start;
    const right = sx.end - (originX + b.width) * pitchX;
    const front = originY * pitchY - sy.start;
    const back = sy.end - (originY + b.depth) * pitchY;

    if (
      left > MAX_SIDE_MM + EPS ||
      right > MAX_SIDE_MM + EPS ||
      front > MAX_SIDE_MM + EPS ||
      back > MAX_SIDE_MM + EPS
    ) {
      return { ok: false, reason: 'slack-exceeds-overhang' };
    }

    placements.push({
      binId: b.id,
      x: originX,
      y: originY,
      overhang: {
        enabled: true,
        left: Math.max(0, left),
        right: Math.max(0, right),
        front: Math.max(0, front),
        back: Math.max(0, back),
        feet: false,
      },
    });
  }

  return { ok: true, placements };
}
