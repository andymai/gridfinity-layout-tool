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

/** Sorted x-spans of the plate (outline clipped to its slab) along row `y`. */
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

/** Parts of the sorted spans `a` not covered by the sorted spans `b`. */
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

function distanceToPolyline(pts: readonly OutlinePoint[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j];
    const dx = pts[i].x - a.x;
    const dy = pts[i].y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

function distanceToRect(r: Rect, x: number, y: number): number {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
}

/**
 * Deepest reach (mm) of a turned-over copy past the plate below, for the turn
 * about `axis` seated by `seatMm` (see `planPlateFlip`). Zero for a plate with
 * no outline, whose padding is judged separately.
 *
 * The plate is scanned row by row in its plate-local frame, where the turn is
 * a mirror about the socket lattice's centre line shifted by the seat. Each
 * overhanging stretch is measured from its midpoint to the nearest edge of the
 * plate below, so a mirrored arc that flattens a hair differently reads as a
 * few hundredths of a millimetre and a missing cell as half a cell.
 */
export function turnedPlateOverhangMm(
  params: TurnOverhangInput,
  axis: 'x' | 'y',
  seatMm: number
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
  const mirror =
    axis === 'x'
      ? 2 * params.paddingFront + gridD + seatMm
      : 2 * params.paddingLeft + gridW + seatMm;
  const rowLo = axis === 'x' ? mirror - slab.y1 : slab.y0;
  const rowHi = axis === 'x' ? mirror - slab.y0 : slab.y1;

  let deepest = 0;
  for (let y = rowLo + ROW_STEP_MM / 2; y < rowHi; y += ROW_STEP_MM) {
    const below = rowSpans(pts, y, slab);
    const turned =
      axis === 'x'
        ? rowSpans(pts, mirror - y, slab)
        : below.map(([a, b]): Span => [mirror - b, mirror - a]).reverse();
    for (const [a, b] of subtractSpans(turned, below)) {
      const x = (a + b) / 2;
      const onSlab = x >= slab.x0 && x <= slab.x1 && y >= slab.y0 && y <= slab.y1;
      const depth = onSlab ? distanceToPolyline(pts, x, y) : distanceToRect(slab, x, y);
      deepest = Math.max(deepest, depth);
    }
  }
  return deepest;
}
