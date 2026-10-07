/**
 * Segment geometry behind the reach-limited path offset: the closest approach
 * between two segments, a coarser copy of an outline, and a uniform grid that
 * lets each edge meet only the edges near it.
 */

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Distance (mm) at which two segments count as touching. */
export const CONTACT = 1e-7;

/** Grid keys pack a cell's column and row; rows stay below this. */
const GRID_STRIDE = 2 ** 21;

export interface Across {
  gap: number;
  ux: number;
  uy: number;
}

/**
 * Keep `best` if `p`'s closest point on segment ab is nearer than it holds
 * (squared), with the direction pointing from the first segment to the
 * second (`sign`).
 */
function nearerAcross(p: Pt, a: Pt, b: Pt, sign: number, best: Across): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  const vx = sign * (a.x + t * dx - p.x);
  const vy = sign * (a.y + t * dy - p.y);
  const gap2 = vx * vx + vy * vy;
  if (gap2 < best.gap) {
    best.gap = gap2;
    best.ux = vx;
    best.uy = vy;
  }
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function properlyCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
}

/**
 * Closest approach between two segments, written into `out`: its length and
 * the unit direction from the first segment to the second. False when they
 * touch.
 */
export function gapAcross(a1: Pt, a2: Pt, b1: Pt, b2: Pt, out: Across): boolean {
  if (properlyCross(a1, a2, b1, b2)) return false;
  out.gap = Infinity;
  nearerAcross(a1, b1, b2, 1, out);
  nearerAcross(a2, b1, b2, 1, out);
  nearerAcross(b1, a1, a2, -1, out);
  nearerAcross(b2, a1, a2, -1, out);
  const gap = Math.sqrt(out.gap);
  if (gap <= CONTACT) return false;
  out.gap = gap;
  out.ux /= gap;
  out.uy /= gap;
  return true;
}

/** A lower bound on the gap between segments ab and cg, from their boxes. */
export function boxGap(a: Pt, b: Pt, c: Pt, g: Pt): number {
  const dx = Math.max(
    0,
    Math.min(c.x, g.x) - Math.max(a.x, b.x),
    Math.min(a.x, b.x) - Math.max(c.x, g.x)
  );
  const dy = Math.max(
    0,
    Math.min(c.y, g.y) - Math.max(a.y, b.y),
    Math.min(a.y, b.y) - Math.max(c.y, g.y)
  );
  return Math.hypot(dx, dy);
}

function distance2(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return (a.x + t * dx - p.x) ** 2 + (a.y + t * dy - p.y) ** 2;
}

/**
 * The vertices a coarser copy of a closed outline keeps (Douglas–Peucker):
 * every vertex it drops lies within `tol` of the proxy edge replacing its
 * run, and no proxy edge that replaces a run is longer than `maxSpan`, so a
 * hold measured on one stays local. Sorted, starting at vertex 0.
 */
export function proxyIndices(points: readonly Pt[], tol: number, maxSpan: number): number[] {
  const n = points.length;
  const keep = new Uint8Array(n);
  let far = 0;
  let farthest = -1;
  for (let v = 1; v < n; v++) {
    const d2 = (points[v].x - points[0].x) ** 2 + (points[v].y - points[0].y) ** 2;
    if (d2 > farthest) {
      farthest = d2;
      far = v;
    }
  }
  keep[0] = 1;
  keep[far] = 1;
  // Pairs of run ends; an end of n is vertex 0 again, closing the loop.
  const runs = [0, far, far, n];
  for (;;) {
    const b = runs.pop();
    const a = runs.pop();
    if (a === undefined || b === undefined) break;
    if (b - a < 2) continue;
    const pa = points[a];
    const pb = points[b % n];
    let worst = a + 1;
    let worst2 = -1;
    for (let v = a + 1; v < b; v++) {
      const d2 = distance2(points[v], pa, pb);
      if (d2 > worst2) {
        worst2 = d2;
        worst = v;
      }
    }
    const long = (pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2 > maxSpan * maxSpan;
    if (worst2 <= tol * tol && !long) continue;
    const split = worst2 > tol * tol ? worst : (a + b) >> 1;
    keep[split] = 1;
    runs.push(a, split, split, b);
  }
  const out: number[] = [];
  for (let v = 0; v < n; v++) if (keep[v]) out.push(v);
  return out;
}

/** Uniform grid over a polygon's edges, so each edge only meets its neighbours. */
export class EdgeGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly seen: Int32Array;
  private visit = 0;
  private readonly originX: number;
  private readonly originY: number;
  private readonly size: number;

  /**
   * Cells are at least `minCell`, and otherwise as small as the typical
   * edge, so a densely sampled stretch spreads over many cells instead of
   * filling one. Cutting the long edges into cell-sized pieces stays within
   * 8 pieces per edge overall.
   */
  constructor(poly: readonly Pt[], minCell: number) {
    const n = poly.length;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let perimeter = 0;
    const lengths = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[i + 1 === n ? 0 : i + 1];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      lengths[i] = Math.hypot(q.x - p.x, q.y - p.y);
      perimeter += lengths[i];
    }
    this.originX = minX;
    this.originY = minY;
    const extent = Math.max(maxX - minX, maxY - minY);
    const median = lengths.sort()[n >> 1];
    this.size = Math.max(minCell, median, perimeter / (8 * n), extent / (GRID_STRIDE / 4), 1e-6);
    this.seen = new Int32Array(n);
    for (let e = 0; e < n; e++) {
      const a = poly[e];
      const b = poly[e + 1 === n ? 0 : e + 1];
      this.walk(a, b, 0, e, null);
    }
  }

  /** Into `out`, every edge with a piece within roughly `pad` of the segment, once. */
  collect(a: Pt, b: Pt, pad: number, out: number[]): void {
    out.length = 0;
    this.visit++;
    this.walk(a, b, pad, -1, out);
  }

  /**
   * The cells under the segment, cut into cell-sized pieces with each piece's
   * box grown by `pad`. Files `edge` into them, or gathers what they hold.
   */
  private walk(a: Pt, b: Pt, pad: number, edge: number, out: number[] | null): void {
    const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / this.size));
    for (let k = 0; k < pieces; k++) {
      const x0 = a.x + ((b.x - a.x) * k) / pieces;
      const x1 = a.x + ((b.x - a.x) * (k + 1)) / pieces;
      const y0 = a.y + ((b.y - a.y) * k) / pieces;
      const y1 = a.y + ((b.y - a.y) * (k + 1)) / pieces;
      const cx0 = Math.max(0, Math.floor((Math.min(x0, x1) - pad - this.originX) / this.size));
      const cx1 = Math.floor((Math.max(x0, x1) + pad - this.originX) / this.size);
      const cy0 = Math.max(0, Math.floor((Math.min(y0, y1) - pad - this.originY) / this.size));
      const cy1 = Math.min(
        GRID_STRIDE - 1,
        Math.floor((Math.max(y0, y1) + pad - this.originY) / this.size)
      );
      for (let ix = cx0; ix <= cx1; ix++) {
        for (let iy = cy0; iy <= cy1; iy++) {
          const key = ix * GRID_STRIDE + iy;
          const list = this.cells.get(key);
          if (out) {
            if (!list) continue;
            for (const f of list) {
              if (this.seen[f] === this.visit) continue;
              this.seen[f] = this.visit;
              out.push(f);
            }
          } else if (!list) this.cells.set(key, [edge]);
          else if (list[list.length - 1] !== edge) list.push(edge);
        }
      }
    }
  }
}
