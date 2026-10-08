/**
 * Segment geometry behind the reach-limited path offset: the closest approach
 * between two segments, a coarser copy of an outline, and a uniform grid that
 * lets each edge meet only the edges near it. The same grid answers whether
 * two outlines touch or come near each other.
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
 *
 * A run splits at its worst vertex unless that lies in the run's outer eighth,
 * when it splits in the middle instead: every run still ends within `tol`, and
 * a crafted outline cannot drive the splits one vertex at a time.
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
    const margin = (b - a) >> 3;
    const balanced = worst - a > margin && b - worst > margin;
    const split = worst2 > tol * tol && balanced ? worst : (a + b) >> 1;
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

  /** Most edges any one cell holds. */
  busiest(): number {
    let most = 0;
    for (const list of this.cells.values()) most = Math.max(most, list.length);
    return most;
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

/** Whether any two non-adjacent edges of a closed outline touch, found on a grid. */
export function touchesItself(poly: readonly Pt[]): boolean {
  const n = poly.length;
  const grid = new EdgeGrid(poly, 0);
  const across: Across = { gap: 0, ux: 0, uy: 0 };
  const near: number[] = [];
  for (let e = 0; e < n; e++) {
    const a = poly[e];
    const b = poly[(e + 1) % n];
    grid.collect(a, b, CONTACT, near);
    for (const f of near) {
      if (f <= e + 1 || (e === 0 && f === n - 1)) continue;
      if (!gapAcross(a, b, poly[f], poly[(f + 1) % n], across)) return true;
    }
  }
  return false;
}

/**
 * Whether edges `i` and `j` of a closed outline, laid out as coordinates with
 * the first vertex repeated at the end, cross well inside both: the test a
 * path cutout has always been validated with. Touching, overlapping and
 * near-parallel edges pass.
 */
function edgesCrossInside(xs: Float64Array, ys: Float64Array, i: number, j: number): boolean {
  const ax = xs[i + 1] - xs[i];
  const ay = ys[i + 1] - ys[i];
  const bx = xs[j + 1] - xs[j];
  const by = ys[j + 1] - ys[j];
  const d = ax * by - ay * bx;
  if (Math.abs(d) < 1e-10) return false;
  const ox = xs[j] - xs[i];
  const oy = ys[j] - ys[i];
  const t = (ox * by - oy * bx) / d;
  const u = (ox * ay - oy * ax) / d;
  const eps = 1e-6;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/** Runs of at most this many consecutive edges are checked pair by pair. */
const CROSSING_LEAF = 16;

/**
 * Edge pairs a crossing check may compare before it stops and reports a
 * crossing. The floor covers every pair of the longest drawn path
 * (`MAX_PATH_POINTS` anchors, each flattened to `BEZIER_SEGMENTS` points), so
 * only an imported outline can run out.
 */
const CROSSING_PAIRS_FLOOR = 1 << 23;
const CROSSING_PAIRS_PER_EDGE = 512;

/**
 * Whether any two non-adjacent edges of a closed polyline cross
 * ({@link edgesCrossInside}), checked over a tree of boxes round runs of
 * consecutive edges. Two edges that cross meet strictly inside both, so their
 * boxes overlap and the pair is always reached: within the pair budget, the
 * verdict is the all-pairs one. Only runs whose boxes overlap are opened, which
 * keeps a dense zigzag, a jittered edge or a tight spiral near linear. Long
 * edges that all pass one point, like a fan of spikes, overlap in every box and
 * would be compared pair by pair; an outline that crowded spends the budget and
 * reads as crossing, so a crafted one is rejected rather than stalling whoever
 * opens it.
 */
export function polylineCrosses(poly: readonly Pt[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  const xs = new Float64Array(n + 1);
  const ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    xs[i] = poly[i % n].x;
    ys[i] = poly[i % n].y;
  }
  const lo: number[] = [];
  const hi: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const box: number[] = [];
  const build = (from: number, to: number): number => {
    const node = lo.length;
    lo.push(from);
    hi.push(to);
    left.push(-1);
    right.push(-1);
    if (to - from <= CROSSING_LEAF) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let v = from; v <= to; v++) {
        minX = Math.min(minX, xs[v]);
        minY = Math.min(minY, ys[v]);
        maxX = Math.max(maxX, xs[v]);
        maxY = Math.max(maxY, ys[v]);
      }
      box.push(minX, minY, maxX, maxY);
      return node;
    }
    box.push(0, 0, 0, 0);
    const mid = (from + to) >> 1;
    const l = build(from, mid);
    const r = build(mid, to);
    left[node] = l;
    right[node] = r;
    box[4 * node] = Math.min(box[4 * l], box[4 * r]);
    box[4 * node + 1] = Math.min(box[4 * l + 1], box[4 * r + 1]);
    box[4 * node + 2] = Math.max(box[4 * l + 2], box[4 * r + 2]);
    box[4 * node + 3] = Math.max(box[4 * l + 3], box[4 * r + 3]);
    return node;
  };
  const root = build(0, n);
  let pairsLeft = CROSSING_PAIRS_FLOOR + CROSSING_PAIRS_PER_EDGE * n;

  const overlap = (a: number, b: number): boolean =>
    box[4 * a] <= box[4 * b + 2] &&
    box[4 * b] <= box[4 * a + 2] &&
    box[4 * a + 1] <= box[4 * b + 3] &&
    box[4 * b + 1] <= box[4 * a + 3];
  // Every run of `a` comes before every run of `b`, so i < j throughout.
  const across = (a: number, b: number): boolean => {
    if (!overlap(a, b)) return false;
    const aLeaf = left[a] < 0;
    const bLeaf = left[b] < 0;
    if (aLeaf && bLeaf) {
      pairsLeft -= (hi[a] - lo[a]) * (hi[b] - lo[b]);
      if (pairsLeft < 0) return true;
      for (let i = lo[a]; i < hi[a]; i++) {
        const end = i === 0 && hi[b] === n ? n - 1 : hi[b];
        for (let j = Math.max(lo[b], i + 2); j < end; j++) {
          if (edgesCrossInside(xs, ys, i, j)) return true;
        }
      }
      return false;
    }
    if (bLeaf || (!aLeaf && hi[a] - lo[a] >= hi[b] - lo[b])) {
      return across(left[a], b) || across(right[a], b);
    }
    return across(a, left[b]) || across(a, right[b]);
  };
  const within = (node: number): boolean => {
    if (left[node] < 0) {
      const run = hi[node] - lo[node];
      pairsLeft -= (run * run) >> 1;
      if (pairsLeft < 0) return true;
      for (let i = lo[node]; i < hi[node]; i++) {
        const end = i === 0 && hi[node] === n ? n - 1 : hi[node];
        for (let j = i + 2; j < end; j++) {
          if (edgesCrossInside(xs, ys, i, j)) return true;
        }
      }
      return false;
    }
    return within(left[node]) || within(right[node]) || across(left[node], right[node]);
  };
  return within(root);
}

/**
 * Whether any edge of `b` comes within `gap` of an edge of `a`, both closed
 * outlines, touching included. Each edge of `a` meets only the edges of `b` on
 * the grid cells around it.
 */
function edgesWithin(a: readonly Pt[], b: readonly Pt[], gap: number, minCell: number): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const grid = new EdgeGrid(b, minCell);
  const across: Across = { gap: 0, ux: 0, uy: 0 };
  const near: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = a[i + 1 === a.length ? 0 : i + 1];
    grid.collect(p, q, gap, near);
    for (const f of near) {
      const g = b[f + 1 === b.length ? 0 : f + 1];
      if (!gapAcross(p, q, b[f], g, across) || across.gap < gap) return true;
    }
  }
  return false;
}

/** Whether two closed outlines cross or touch each other. */
export function outlinesTouch(a: readonly Pt[], b: readonly Pt[]): boolean {
  return edgesWithin(a, b, CONTACT, 0);
}

/**
 * Whether two closed outlines come within `gap` of each other. Measured
 * between coarser copies kept within `gap / 16` of each outline, so a dense one
 * costs what its shape needs rather than its point count. Outlines up to a
 * quarter further than `gap` apart can read as near; two within `gap` never
 * read as apart.
 */
export function outlinesComeWithin(a: readonly Pt[], b: readonly Pt[], gap: number): boolean {
  const tol = gap / 16;
  const coarse = (points: readonly Pt[]): Pt[] =>
    points.length < 4 ? [...points] : proxyIndices(points, tol, Infinity).map((i) => points[i]);
  const reach = gap + 2 * tol;
  return edgesWithin(coarse(a), coarse(b), reach, reach / 2);
}
