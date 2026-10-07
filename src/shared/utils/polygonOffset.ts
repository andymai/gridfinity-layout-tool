/**
 * Outward offset of a simple closed polygon (miter joins, miter-limit clamped).
 *
 * Used to build the flared top rim of a chamfered *path* cutout: the outline is
 * flattened to a polyline, then offset outward by the chamfer width to form the
 * wider opening the generator lofts down to the nominal profile. The result has
 * the same vertex count and 1:1 correspondence with the input, which keeps the
 * downstream ruled loft well-behaved.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

const MITER_LIMIT = 4;

function signedArea(p: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    a += p[i].x * b.y - b.x * p[i].y;
  }
  return a / 2;
}

function outwardNormal(a: Pt, b: Pt, sign: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (sign * dy) / len, y: (sign * -dx) / len };
}

function intersectLines(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

function offsetWithSign(points: readonly Pt[], d: number, sign: number): Pt[] {
  const n = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const n1 = outwardNormal(prev, cur, sign);
    const n2 = outwardNormal(cur, next, sign);
    const p1 = { x: prev.x + n1.x * d, y: prev.y + n1.y * d };
    const dir1 = { x: cur.x - prev.x, y: cur.y - prev.y };
    const p2 = { x: cur.x + n2.x * d, y: cur.y + n2.y * d };
    const dir2 = { x: next.x - cur.x, y: next.y - cur.y };

    const hit = intersectLines(p1, dir1, p2, dir2);
    if (!hit) {
      // Collinear / parallel edges — a plain perpendicular offset is exact.
      out.push({ x: cur.x + n2.x * d, y: cur.y + n2.y * d });
      continue;
    }
    // Clamp runaway miters at sharp corners so a spike can't blow up the loft.
    const mdx = hit.x - cur.x;
    const mdy = hit.y - cur.y;
    const mlen = Math.hypot(mdx, mdy);
    const cap = MITER_LIMIT * Math.abs(d);
    if (mlen > cap && mlen > 0) {
      const k = cap / mlen;
      out.push({ x: cur.x + mdx * k, y: cur.y + mdy * k });
    } else {
      out.push(hit);
    }
  }
  return out;
}

/**
 * Offset a closed polygon outward by `d`. Winding-agnostic: it picks the sign
 * that actually grows the area, so it can't accidentally shrink the outline
 * (which would invert the chamfer funnel).
 */
export function offsetClosedPolygon(points: readonly Pt[], d: number): Pt[] {
  const n = points.length;
  if (n < 3 || d === 0) return points.map((p) => ({ x: p.x, y: p.y }));

  const sign = signedArea(points) >= 0 ? 1 : -1;
  const a0 = Math.abs(signedArea(points));
  const out = offsetWithSign(points, d, sign);
  // Safety net against coordinate-handedness surprises: if the chosen sign
  // shrank the polygon, redo with the opposite sign so the offset is outward.
  if (Math.abs(signedArea(out)) < a0) return offsetWithSign(points, d, -sign);
  return out;
}

export interface ReachLimitedOffset {
  readonly points: Pt[];
  /** How far (mm) each vertex actually moved along its miter, at most `d`. */
  readonly reach: number[];
}

/**
 * Share of an edge's length, along its own direction, that its offset must
 * keep. Bounds how thin a ruled face between two offset sections can get.
 */
const MIN_EDGE_KEEP = 0.1;

/**
 * Share of the gap between two edges that the pair may close between them.
 * Two disjoint segments lie on either side of the line square to their closest
 * approach, and an offset edge stays within its endpoints' moves of where it
 * was, so two edges whose endpoints together close less than the gap, measured
 * across it, cannot meet. Moves along or away from the gap are free.
 */
const GAP_CLOSE = 0.98;

/**
 * Net turning (radians) along the outline past which two edges can face each
 * other across a gap: a slot's walls, a valley's flanks. Closer than this, the
 * fold bound governs them. Net, so a step's two walls (a concave turn then a
 * convex one) stay near. At 120° a concave curve just wider than the offset
 * does not read as a gap, since its chord there is still 1.7× its radius.
 */
const GAP_TURN = (2 * Math.PI) / 3;

/**
 * Chords longer than this many `d` are not fold-checked: both ends would have
 * to close more than the chord's length before it reversed.
 */
const FOLD_CHORD_REACH = 4;

/** A turn (radians) toward the outside past this ends a run of inside turns. */
const INSIDE_TURN = 1e-9;

/** Distance (mm) at which two segments count as touching. */
const CONTACT = 1e-7;

/** Grid keys pack a cell's column and row; rows stay below this. */
const GRID_STRIDE = 2 ** 21;

interface Across {
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
function gapAcross(a1: Pt, a2: Pt, b1: Pt, b2: Pt, out: Across): boolean {
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

/** Uniform grid over a polygon's edges, so each edge only meets its neighbours. */
class EdgeGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly seen: Int32Array;
  private visit = 0;
  private readonly originX: number;
  private readonly originY: number;
  private readonly size: number;

  constructor(poly: readonly Pt[], minCell: number) {
    const n = poly.length;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[i + 1 === n ? 0 : i + 1];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      perimeter += Math.hypot(q.x - p.x, q.y - p.y);
    }
    this.originX = minX;
    this.originY = minY;
    const extent = Math.max(maxX - minX, maxY - minY);
    this.size = Math.max(minCell, perimeter / n, extent / (GRID_STRIDE / 4), 1e-6);
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

/** One offset in progress: the outline, each vertex's miter, and its reach so far. */
class ReachSolver {
  readonly reach: number[];
  private readonly points: readonly Pt[];
  private readonly n: number;
  private readonly miter: Pt[];
  private readonly miterLen: number[];
  private readonly turnBefore: number[];
  private readonly sign: number;
  private readonly across: Across = { gap: 0, ux: 0, uy: 0 };
  private readonly candidates: number[] = [];

  constructor(points: readonly Pt[], d: number, cap: readonly number[] | undefined) {
    const n = points.length;
    this.points = points;
    this.n = n;
    this.reach = points.map((_, i) => Math.max(0, Math.min(d, cap?.[i] ?? d)));
    const sign = signedArea(points) >= 0 ? 1 : -1;
    this.sign = sign;
    this.miter = offsetWithSign(points, 1, sign).map((q, i) => ({
      x: q.x - points[i].x,
      y: q.y - points[i].y,
    }));
    this.miterLen = this.miter.map((m) => Math.hypot(m.x, m.y));
    this.turnBefore = [0];
    for (let v = 0; v < n; v++) {
      const prev = points[(v - 1 + n) % n];
      const cur = points[v];
      const nxt = points[this.next(v)];
      const ax = cur.x - prev.x;
      const ay = cur.y - prev.y;
      const bx = nxt.x - cur.x;
      const by = nxt.y - cur.y;
      this.turnBefore.push(this.turnBefore[v] + Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    }
  }

  place(): Pt[] {
    return this.points.map((p, i) => ({
      x: p.x + this.miter[i].x * this.reach[i],
      y: p.y + this.miter[i].y * this.reach[i],
    }));
  }

  /**
   * The fold bound, in closed form, on every edge and on every chord across a
   * run of inside turns. A chord's offset keeps `|C|² + rⱼ(mⱼ·C) − rᵢ(mᵢ·C)`
   * of its length along `C`; counting only the terms that shorten it,
   * `rᵢcᵢ + rⱼcⱼ ≤ (1 − keep)|C|²` holds while both ends stay under
   * `(1 − keep)|C|² / (cᵢ + cⱼ)`, and keeps holding as reaches only shrink.
   *
   * The edges alone are not enough at a tight inside curve: the vertex where
   * it meets a straight turns by half a chord, so it can move past the
   * curve's centre and cross the vertex at its other end. A chord over a
   * circular arc bounds both ends to 0.9 of its radius whatever its span, as
   * the edges do, so an arc wider than `d` is not held at all.
   */
  boundFolds(d: number): void {
    const { points, n } = this;
    const reachCap = FOLD_CHORD_REACH * d;
    for (let i = 0; i < n; i++) {
      let turned = 0;
      for (let k = 1; k < n; k++) {
        const j = (i + k) % n;
        if (k > 1) {
          const v = (i + k - 1) % n;
          const turn = this.turnBefore[v + 1] - this.turnBefore[v];
          if (turn * this.sign > INSIDE_TURN) break;
          turned += Math.abs(turn);
          if (turned >= Math.PI) break;
        }
        const cx = points[j].x - points[i].x;
        const cy = points[j].y - points[i].y;
        const len2 = cx * cx + cy * cy;
        if (k > 1 && len2 > reachCap * reachCap) break;
        this.holdChord(i, j, cx, cy, len2);
      }
    }
  }

  private holdChord(i: number, j: number, cx: number, cy: number, len2: number): void {
    const { miter, reach } = this;
    const ci = Math.max(0, miter[i].x * cx + miter[i].y * cy);
    const cj = Math.max(0, -(miter[j].x * cx + miter[j].y * cy));
    if (len2 === 0 || ci + cj === 0) return;
    const limit = ((1 - MIN_EDGE_KEEP) * len2) / (ci + cj);
    if (ci > 0) reach[i] = Math.min(reach[i], limit);
    if (cj > 0) reach[j] = Math.min(reach[j], limit);
  }

  /**
   * Hold apart every pair that faces across a gap, found on a grid: each edge
   * looks as far as it could move twice over, so a pair is found from the
   * edge that moves more.
   */
  boundGaps(d: number): void {
    const { points, n } = this;
    const from = [...this.reach];
    const moves = points.map((_, e) => this.edgeMove(e, from));
    const grid = new EdgeGrid(points, 2 * d);
    for (let e = 0; e < n; e++) {
      if (moves[e] === 0) continue;
      grid.collect(points[e], points[this.next(e)], 2 * moves[e], this.candidates);
      for (const f of this.candidates) {
        if (moves[e] + moves[f] <= this.boxGap(e, f) || this.adjacent(e, f)) continue;
        if (this.turnBetween(e, f) < GAP_TURN) continue;
        this.holdApart(e, f, from);
      }
    }
  }

  /**
   * Hold apart whatever the a-priori bounds missed, caught as a contact. That
   * parts the pair for good, so each round settles at least one new pair and
   * the loop ends. An outline that already touches itself at a pair has
   * nothing to give there, and holdApart leaves it as it is.
   */
  repairContacts(d: number): Pt[] {
    const { n } = this;
    const settled = new Set<number>();
    for (;;) {
      const out = this.place();
      const grid = new EdgeGrid(out, 2 * d);
      const contacts: number[] = [];
      for (let e = 0; e < n; e++) {
        const a = out[e];
        const b = out[this.next(e)];
        grid.collect(a, b, CONTACT, this.candidates);
        for (const f of this.candidates) {
          if (f <= e || this.adjacent(e, f) || settled.has(e * n + f)) continue;
          if (!gapAcross(a, b, out[f], out[this.next(f)], this.across)) contacts.push(e, f);
        }
      }
      if (contacts.length === 0) return out;
      const from = [...this.reach];
      for (let k = 0; k < contacts.length; k += 2) {
        settled.add(contacts[k] * n + contacts[k + 1]);
        this.holdApart(contacts[k], contacts[k + 1], from);
      }
    }
  }

  private next(e: number): number {
    return e + 1 === this.n ? 0 : e + 1;
  }

  private adjacent(e: number, f: number): boolean {
    return e === f || this.next(e) === f || this.next(f) === e;
  }

  private edgeMove(e: number, from: readonly number[]): number {
    const j = this.next(e);
    return Math.max(from[e] * this.miterLen[e], from[j] * this.miterLen[j]);
  }

  /** Net turning between edges e and f the smaller way round. */
  private turnBetween(e: number, f: number): number {
    const lo = Math.min(e, f);
    const hi = Math.max(e, f);
    const forward = this.turnBefore[hi + 1] - this.turnBefore[lo + 1];
    return Math.min(Math.abs(forward), Math.abs(this.turnBefore[this.n] - forward));
  }

  /** A lower bound on the gap between two edges, from their boxes. */
  private boxGap(e: number, f: number): number {
    const a = this.points[e];
    const b = this.points[this.next(e)];
    const c = this.points[f];
    const g = this.points[this.next(f)];
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

  /**
   * Split GAP_CLOSE of the gap between two edges in proportion to how far
   * each could close it, measured across the gap, and hold every endpoint that
   * closes to its edge's part. A pair that cannot meet is left alone. Shares
   * come from `from`, one snapshot per round, so a pair's split does not
   * depend on which other pairs were held first.
   */
  private holdApart(e: number, f: number, from: readonly number[]): void {
    const { points, across } = this;
    const e2 = this.next(e);
    const f2 = this.next(f);
    if (!gapAcross(points[e], points[e2], points[f], points[f2], across)) return;
    const closeE = Math.max(this.closing(e, 1) * from[e], this.closing(e2, 1) * from[e2]);
    const closeF = Math.max(this.closing(f, -1) * from[f], this.closing(f2, -1) * from[f2]);
    if (closeE + closeF < across.gap) return;
    const budget = (GAP_CLOSE * across.gap) / (closeE + closeF);
    this.hold(e, 1, budget * closeE);
    this.hold(e2, 1, budget * closeE);
    this.hold(f, -1, budget * closeF);
    this.hold(f2, -1, budget * closeF);
  }

  /** How fast vertex v closes the current gap per unit reach, from its side. */
  private closing(v: number, side: number): number {
    const m = this.miter[v];
    return Math.max(0, side * (m.x * this.across.ux + m.y * this.across.uy));
  }

  private hold(v: number, side: number, limit: number): void {
    const rate = this.closing(v, side);
    if (rate > 0) this.reach[v] = Math.min(this.reach[v], limit / rate);
  }
}

/**
 * Outward miter offset by `d` that is always a simple polygon with the input's
 * vertex count, for a simple input.
 *
 * A plain miter offset fails two ways on a freeform outline: a concave curve
 * tighter than `d` overshoots its own centre of curvature and folds back, and
 * two parts of the outline closer than `2d` grow into each other. Here the
 * vertices involved move less instead, so a tight notch takes the largest
 * offset it can hold and the rest of the outline still moves the full `d`.
 * `cap` bounds each vertex's reach, which keeps one section inside another
 * vertex for vertex when both feed a ruled loft.
 *
 * Every bound only ever lowers a reach and stays satisfied as others drop, so
 * each is one pass over a uniform grid rather than over all pairs.
 */
export function offsetClosedPolygonWithinReach(
  points: readonly Pt[],
  d: number,
  cap?: readonly number[]
): ReachLimitedOffset {
  if (points.length < 3 || d <= 0) {
    return {
      points: points.map((p) => ({ x: p.x, y: p.y })),
      reach: points.map(() => 0),
    };
  }
  const solver = new ReachSolver(points, d, cap);
  solver.boundFolds(d);
  solver.boundGaps(d);
  return { points: solver.repairContacts(d), reach: solver.reach };
}

/** Reach below this share of `d` counts as held back. */
const HELD_BACK = 0.999;

/**
 * The same outline with a collinear vertex `d` in from each held-back end of
 * every edge longer than `2d`.
 *
 * A vertex can only move along its own miter, so the one where a tight notch
 * meets a long straight run has to stop short of the corner the true offset
 * makes, and the offset then tapers along the whole run. The extra vertex
 * confines that taper to `d`. The shape is unchanged, so one refined outline
 * can feed every section of a loft.
 */
export function refineForOffset(points: readonly Pt[], d: number): Pt[] {
  const { reach } = offsetClosedPolygonWithinReach(points, d);
  const n = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const j = (i + 1) % n;
    const b = points[j];
    out.push({ x: a.x, y: a.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 2 * d) continue;
    const at = (s: number): Pt => ({
      x: a.x + ((b.x - a.x) * s) / len,
      y: a.y + ((b.y - a.y) * s) / len,
    });
    if (reach[i] < d * HELD_BACK) out.push(at(d));
    if (reach[j] < d * HELD_BACK) out.push(at(len - d));
  }
  return out;
}
