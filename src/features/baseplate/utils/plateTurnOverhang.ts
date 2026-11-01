/**
 * How far a turned-over copy of a shaped plate overhangs the upright plate it
 * prints on. Turning a plate over mirrors it in plan view, so the copy only
 * covers the plate below where the perimeter is symmetric about the turn.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { flattenOutline, type OutlinePoint } from '@/shared/utils/drawerOutlineGeometry';

export type TurnOverhangInput = Pick<
  ResolvedBaseplateParams,
  | 'width'
  | 'depth'
  | 'gridUnitMm'
  | 'gridUnitMmY'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingFront'
  | 'paddingBack'
  | 'outline'
  | 'outlineOverhang'
>;

const ROW_STEP_MM = 0.5;

type Span = readonly [number, number];

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function rowSpans(pts: readonly OutlinePoint[], y: number, slab: Rect): Span[] {
  if (y < slab.y0 || y > slab.y1) return [];
  const xs: number[] = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j];
    const b = pts[i];
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  const spans: Span[] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const lo = Math.max(xs[k], slab.x0);
    const hi = Math.min(xs[k + 1], slab.x1);
    if (hi > lo) spans.push([lo, hi]);
  }
  return spans;
}

function subtractSpans(a: readonly Span[], b: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (const [start, hi] of a) {
    let lo = start;
    for (const [bLo, bHi] of b) {
      if (bHi <= lo) continue;
      if (bLo >= hi) break;
      if (bLo > lo) out.push([lo, bLo]);
      lo = bHi;
      if (lo >= hi) break;
    }
    if (lo < hi) out.push([lo, hi]);
  }
  return out;
}

interface BelowRows {
  readonly y0: number;
  readonly spans: readonly Span[][];
}

/**
 * Distance from (x, y) to the plate below, looking no further than `reach`:
 * past it the answer is Infinity. Rows are searched outward from the nearest
 * one and the search stops once no row left can come closer.
 */
function distanceToBelow(below: BelowRows, x: number, y: number, reach: number): number {
  const n = below.spans.length;
  const nearest = Math.min(n - 1, Math.max(0, Math.round((y - below.y0) / ROW_STEP_MM)));
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    let closer = false;
    for (const i of k === 0 ? [nearest] : [nearest - k, nearest + k]) {
      if (i < 0 || i >= n) continue;
      const dy = Math.abs(below.y0 + i * ROW_STEP_MM - y);
      if (dy >= best || dy > reach) continue;
      closer = true;
      for (const [lo, hi] of below.spans[i]) {
        const dx = x < lo ? lo - x : x > hi ? x - hi : 0;
        best = Math.min(best, Math.hypot(dx, dy));
      }
    }
    if (!closer) break;
  }
  return best;
}

/**
 * Deepest reach (mm) of a turned-over copy past the plate below, for the turn
 * about `axis` seated by `seatMm` (see `planPlateFlip`). Zero for a plate with
 * no outline, whose padding is judged separately. With `limitMm`, the scan
 * stops at the first reading past it and returns that reading, which may be
 * Infinity: a caller deciding whether a turn fits needs no more than that.
 *
 * The plate is scanned row by row in its plate-local frame, where the turn is
 * a mirror about the socket lattice's centre line shifted by the seat. The
 * plate below is the outline clipped to the slab, since a split piece carries
 * its parent's whole outline. Turned rows share the rows of the plate below, so
 * a reading within a row is exact. Each overhanging stretch is sampled along
 * its length, ends included, so a mirrored arc that flattens a hair differently
 * reads as a few hundredths of a millimetre and a cut corner as its full depth.
 */
export function turnedPlateOverhangMm(
  params: TurnOverhangInput,
  axis: 'x' | 'y',
  seatMm: number,
  limitMm = Infinity
): number {
  if (params.outline === undefined) return 0;
  const pts = flattenOutline(params.outline);
  const gridW = params.width * params.gridUnitMm;
  const gridD = params.depth * (params.gridUnitMmY ?? params.gridUnitMm);
  const oh = params.outlineOverhang;
  const slab: Rect = {
    x0: -(oh?.left ?? 0),
    y0: -(oh?.front ?? 0),
    x1: gridW + params.paddingLeft + params.paddingRight + (oh?.right ?? 0),
    y1: gridD + params.paddingFront + params.paddingBack + (oh?.back ?? 0),
  };
  const belowY0 = slab.y0 + ROW_STEP_MM / 2;
  const belowSpans: Span[][] = [];
  for (let y = belowY0; y < slab.y1; y += ROW_STEP_MM) belowSpans.push(rowSpans(pts, y, slab));
  const below: BelowRows = { y0: belowY0, spans: belowSpans };
  const mirror =
    axis === 'x'
      ? 2 * params.paddingFront + gridD + seatMm
      : 2 * params.paddingLeft + gridW + seatMm;
  const rowLo = axis === 'x' ? mirror - slab.y1 : slab.y0;
  const rowHi = axis === 'x' ? mirror - slab.y0 : slab.y1;

  let deepest = 0;
  for (let k = Math.ceil((rowLo - belowY0) / ROW_STEP_MM); belowY0 + k * ROW_STEP_MM < rowHi; k++) {
    const y = belowY0 + k * ROW_STEP_MM;
    const underneath = belowSpans[k] ?? [];
    const turned =
      axis === 'x'
        ? rowSpans(pts, mirror - y, slab)
        : underneath.map(([a, b]): Span => [mirror - b, mirror - a]).reverse();
    for (const [a, b] of subtractSpans(turned, underneath)) {
      const steps = Math.max(1, Math.ceil((b - a) / ROW_STEP_MM));
      for (let j = 0; j <= steps; j++) {
        deepest = Math.max(deepest, distanceToBelow(below, a + ((b - a) * j) / steps, y, limitMm));
        if (deepest > limitMm) return deepest;
      }
    }
  }
  return deepest;
}
