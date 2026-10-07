/**
 * Outward offset of a simple closed polygon (miter joins, miter-limit clamped).
 *
 * Used to build the flared top rim of a chamfered *path* cutout: the outline is
 * flattened to a polyline, then offset outward by the chamfer width to form the
 * wider opening the generator lofts down to the nominal profile. The result has
 * the same vertex count and 1:1 correspondence with the input, which keeps the
 * downstream ruled loft well-behaved.
 */

import { COINCIDENT_POINT_EPSILON } from './polyline';
import { CONTACT, EdgeGrid, boxGap, gapAcross, proxyIndices, type Across } from './outlineSegments';

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

/**
 * How far (mm) the outline may stray from the coarser copy the gap pass
 * measures on: the spacing below which a path's points count as one.
 */
const PROXY_TOLERANCE = COINCIDENT_POINT_EPSILON;

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
   * The fold bound, in closed form, on every edge and on chords across a run
   * of inside turns. A chord's offset keeps `|C|² + rⱼ(mⱼ·C) − rᵢ(mᵢ·C)` of
   * its length along `C`; counting only the terms that shorten it,
   * `rᵢcᵢ + rⱼcⱼ ≤ (1 − keep)|C|²` holds while both ends stay under
   * `(1 − keep)|C|² / (cᵢ + cⱼ)`, and keeps holding as reaches only shrink.
   *
   * The edges alone are not enough at a tight inside curve: the vertex where
   * it meets a straight turns by half a chord, so it can move past the
   * curve's centre and cross the vertex at its other end. A chord over a
   * circular arc bounds both ends to 0.9 of its radius whatever its span, as
   * the edges do, so an arc wider than `d` is not held at all, and one chord
   * per doubling of span is enough to reach both ends of any run. That keeps
   * a densely sampled curve to a logarithmic number of chords per vertex.
   */
  boundFolds(d: number): void {
    const { points, n } = this;
    const reachCap = FOLD_CHORD_REACH * d;
    const outsideBefore = [0];
    const turningBefore = [0];
    for (let v = 0; v < n; v++) {
      const turn = this.turnBefore[v + 1] - this.turnBefore[v];
      outsideBefore.push(outsideBefore[v] + (turn * this.sign > INSIDE_TURN ? 1 : 0));
      turningBefore.push(turningBefore[v] + Math.abs(turn));
    }
    // Sum over the `count` vertices from `start` on, round the loop.
    const over = (prefix: readonly number[], start: number, count: number): number => {
      const end = start + count;
      return end <= n ? prefix[end] - prefix[start] : prefix[n] - prefix[start] + prefix[end - n];
    };
    for (let i = 0; i < n; i++) {
      for (let k = 1; k < n; k *= 2) {
        const j = (i + k) % n;
        const between = this.next(i);
        if (k > 1 && over(outsideBefore, between, k - 1) > 0) break;
        if (k > 1 && over(turningBefore, between, k - 1) >= Math.PI) break;
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
   * Hold apart every pair of runs that face across a gap, found on a grid
   * over a coarser copy of the outline ({@link proxyIndices}): each proxy
   * edge looks as far as its run could move twice over, so a pair is found
   * from the run that moves more. A densely sampled curve is a handful of
   * proxy edges, so the pairs within reach of each other stay few however
   * many points it carries.
   */
  boundGaps(d: number): void {
    const { points, n } = this;
    const from = [...this.reach];
    const keep = proxyIndices(points, PROXY_TOLERANCE, d / 2);
    const m = keep.length;
    const proxy = keep.map((v) => points[v]);
    const spans: number[][] = keep.map((start, k) => {
      const end = k + 1 < m ? keep[k + 1] : keep[0] + n;
      return Array.from({ length: end - start + 1 }, (_, s) => (start + s) % n);
    });
    const moves = spans.map((span) => {
      let move = 0;
      for (const v of span) move = Math.max(move, from[v] * this.miterLen[v]);
      return move;
    });
    const after = (k: number): number => (k + 1 === m ? 0 : k + 1);
    const grid = new EdgeGrid(proxy, 2 * d);
    for (let k = 0; k < m; k++) {
      if (moves[k] === 0) continue;
      const reachK = 2 * moves[k] + 2 * PROXY_TOLERANCE;
      grid.collect(proxy[k], proxy[after(k)], reachK, this.candidates);
      for (const l of this.candidates) {
        if (l === k || after(k) === l || after(l) === k) continue;
        const box = boxGap(proxy[k], proxy[after(k)], proxy[l], proxy[after(l)]);
        if (moves[k] + moves[l] <= box - 2 * PROXY_TOLERANCE) continue;
        if (this.turnBetween(keep[k], keep[l]) < GAP_TURN) continue;
        this.holdRunsApart(
          proxy[k],
          proxy[after(k)],
          spans[k],
          proxy[l],
          proxy[after(l)],
          spans[l],
          from
        );
      }
    }
  }

  /**
   * {@link holdApart} for two runs of the outline, each within
   * PROXY_TOLERANCE of the proxy edge standing in for it, so the gap they
   * keep across is the proxies' less twice that.
   */
  private holdRunsApart(
    a1: Pt,
    a2: Pt,
    runA: readonly number[],
    b1: Pt,
    b2: Pt,
    runB: readonly number[],
    from: readonly number[]
  ): void {
    const { across } = this;
    if (!gapAcross(a1, a2, b1, b2, across)) return;
    const gap = across.gap - 2 * PROXY_TOLERANCE;
    if (gap <= CONTACT) return;
    let closeA = 0;
    for (const v of runA) closeA = Math.max(closeA, this.closing(v, 1) * from[v]);
    let closeB = 0;
    for (const v of runB) closeB = Math.max(closeB, this.closing(v, -1) * from[v]);
    if (closeA + closeB < gap) return;
    const budget = (GAP_CLOSE * gap) / (closeA + closeB);
    for (const v of runA) this.hold(v, 1, budget * closeA);
    for (const v of runB) this.hold(v, -1, budget * closeB);
  }

  /**
   * Hold apart whatever the a-priori bounds missed, caught as a contact. That
   * parts the pair for good, so each round settles at least one new pair and
   * the loop ends. An outline that already touches itself at a pair has
   * nothing to give there, and holdApart leaves it as it is.
   */
  repairContacts(): Pt[] {
    const { n } = this;
    const settled = new Set<number>();
    for (;;) {
      const out = this.place();
      const grid = new EdgeGrid(out, 0);
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

  /** Net turning between edges e and f the smaller way round. */
  private turnBetween(e: number, f: number): number {
    const lo = Math.min(e, f);
    const hi = Math.max(e, f);
    const forward = this.turnBefore[hi + 1] - this.turnBefore[lo + 1];
    return Math.min(Math.abs(forward), Math.abs(this.turnBefore[this.n] - forward));
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
  return { points: solver.repairContacts(), reach: solver.reach };
}

/** Reach below this share of `d` counts as held back. */
const HELD_BACK = 0.999;

/**
 * Most points an outline keeps before it is offset: the explicit bound on the
 * offset's work. Spread-out outlines offset in near linear time, but a compact
 * scribble puts every edge within reach of every other, so its cost grows with
 * the square of this, and an imported SVG has no point cap of its own.
 */
export const MAX_OFFSET_POINTS = 500;

/** Whether any two non-adjacent edges of a closed outline touch. */
function touchesItself(poly: readonly Pt[]): boolean {
  const n = poly.length;
  const across: Across = { gap: 0, ux: 0, uy: 0 };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (!gapAcross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n], across)) return true;
    }
  }
  return false;
}

/**
 * The outline thinned (Douglas–Peucker) to at most {@link MAX_OFFSET_POINTS},
 * doubling the tolerance from {@link COINCIDENT_POINT_EPSILON} until it fits.
 * An outline already within the budget is used as it is. Null when thinning
 * makes the outline touch itself, the same failure as a path that crosses.
 */
function withinPointBudget(points: readonly Pt[]): readonly Pt[] | null {
  if (points.length <= MAX_OFFSET_POINTS) return points;
  for (let tol = COINCIDENT_POINT_EPSILON; ; tol *= 2) {
    const keep = proxyIndices(points, tol, Infinity);
    if (keep.length > MAX_OFFSET_POINTS) continue;
    const thinned = keep.map((v) => points[v]);
    return thinned.length < 3 || touchesItself(thinned) ? null : thinned;
  }
}

/**
 * The same outline with a collinear vertex `d` in from each held-back end of
 * every edge longer than `2d`, first thinned to {@link MAX_OFFSET_POINTS}.
 *
 * A vertex can only move along its own miter, so the one where a tight notch
 * meets a long straight run has to stop short of the corner the true offset
 * makes, and the offset then tapers along the whole run. The extra vertex
 * confines that taper to `d`. The shape is otherwise unchanged, so one refined
 * outline can feed every section of a loft.
 *
 * An edge held at both ends but too short to fit both points more than
 * {@link COINCIDENT_POINT_EPSILON} apart, the spacing at or below which a
 * path's points count as one, takes a single midpoint instead: the pair would
 * leave an edge too short for the kernel to build.
 *
 * Null when the outline cannot be thinned to the budget without touching
 * itself.
 */
export function refineForOffset(points: readonly Pt[], d: number): Pt[] | null {
  const outline = d > 0 ? withinPointBudget(points) : points;
  if (!outline) return null;
  const { reach } = offsetClosedPolygonWithinReach(outline, d);
  const n = outline.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const j = (i + 1) % n;
    const b = outline[j];
    out.push({ x: a.x, y: a.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 2 * d) continue;
    const at = (s: number): Pt => ({
      x: a.x + ((b.x - a.x) * s) / len,
      y: a.y + ((b.y - a.y) * s) / len,
    });
    const heldStart = reach[i] < d * HELD_BACK;
    const heldEnd = reach[j] < d * HELD_BACK;
    if (heldStart && heldEnd && len - 2 * d <= COINCIDENT_POINT_EPSILON) {
      out.push(at(len / 2));
      continue;
    }
    if (heldStart) out.push(at(d));
    if (heldEnd) out.push(at(len - d));
  }
  return out;
}
