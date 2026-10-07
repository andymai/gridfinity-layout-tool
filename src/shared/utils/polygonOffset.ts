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

/** Passes that shrink a culprit's reach proportionally before zeroing it. */
const MAX_SCALED_PASSES = 32;

const CROSSING_EPS = 1e-6;

/** Where along each segment two segments cross, or null if they do not. */
function segmentCrossing(a1: Pt, a2: Pt, b1: Pt, b2: Pt): { t: number; u: number } | null {
  const den = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(den) < 1e-10) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / den;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / den;
  const inside = (s: number): boolean => s > CROSSING_EPS && s < 1 - CROSSING_EPS;
  return inside(t) && inside(u) ? { t, u } : null;
}

/**
 * For every pair of non-adjacent edges that cross, the endpoint of each edge
 * nearest the crossing that still has reach to give up. Pulling back the far
 * endpoint instead would shrink the offset along the whole edge, which on a
 * long straight run is most of the outline.
 */
function crossingVertices(poly: readonly Pt[], reach: readonly number[]): Set<number> {
  const n = poly.length;
  const hit = new Set<number>();
  const nearer = (start: number, s: number): number => {
    const end = (start + 1) % n;
    const [near, far] = s < 0.5 ? [start, end] : [end, start];
    return reach[near] > 0 ? near : far;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const at = segmentCrossing(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]);
      if (at) hit.add(nearer(i, at.t)).add(nearer(j, at.u));
    }
  }
  return hit;
}

/**
 * Per-vertex factors that stop each edge reversing: an edge whose offset no
 * longer keeps {@link MIN_EDGE_KEEP} of its length along its own direction has
 * both endpoints scaled back by exactly the amount that restores it.
 */
function foldFactors(points: readonly Pt[], out: readonly Pt[]): Map<number, number> {
  const n = points.length;
  const factors = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = points[j].x - points[i].x;
    const ey = points[j].y - points[i].y;
    const len2 = ex * ex + ey * ey;
    const along = (out[j].x - out[i].x) * ex + (out[j].y - out[i].y) * ey;
    const floor = MIN_EDGE_KEEP * len2;
    if (len2 === 0 || along >= floor) continue;
    const scale = (len2 - floor) / (len2 - along);
    factors.set(i, Math.min(factors.get(i) ?? 1, scale));
    factors.set(j, Math.min(factors.get(j) ?? 1, scale));
  }
  return factors;
}

/**
 * Outward miter offset by `d` that is always a simple polygon with the input's
 * vertex count, for a simple input.
 *
 * A plain miter offset fails two ways on a freeform outline: a concave curve
 * tighter than `d` overshoots its own centre of curvature and folds back, and
 * two lobes closer than `2d` grow into each other. Here the vertices involved
 * move less instead, so a tight notch takes the largest offset it can hold and
 * the rest of the outline still moves the full `d`. `cap` bounds each vertex's
 * reach, which keeps one section inside another vertex for vertex when both
 * feed a ruled loft.
 */
export function offsetClosedPolygonWithinReach(
  points: readonly Pt[],
  d: number,
  cap?: readonly number[]
): ReachLimitedOffset {
  const n = points.length;
  const reach = points.map((_, i) => Math.max(0, Math.min(d, cap?.[i] ?? d)));
  if (n < 3 || d <= 0) {
    return { points: points.map((p) => ({ x: p.x, y: p.y })), reach: reach.map(() => 0) };
  }

  const sign = signedArea(points) >= 0 ? 1 : -1;
  const miter = offsetWithSign(points, 1, sign).map((q, i) => ({
    x: q.x - points[i].x,
    y: q.y - points[i].y,
  }));
  const place = (): Pt[] =>
    points.map((p, i) => ({ x: p.x + miter[i].x * reach[i], y: p.y + miter[i].y * reach[i] }));

  for (let pass = 0; ; pass++) {
    const out = place();
    let factors = foldFactors(points, out);
    if (factors.size === 0) {
      const crossing = crossingVertices(out, reach);
      if (crossing.size === 0) return { points: out, reach };
      factors = new Map([...crossing].map((v) => [v, 0.5]));
    }
    let moved = false;
    for (const [v, f] of factors) {
      const next = pass < MAX_SCALED_PASSES ? reach[v] * f : 0;
      if (next !== reach[v]) moved = true;
      reach[v] = next;
    }
    // Only an input that already crosses itself can leave nothing to pull back.
    if (!moved) {
      return { points: points.map((p) => ({ x: p.x, y: p.y })), reach: reach.map(() => 0) };
    }
  }
}

/** Reach below this share of `d` counts as held back by a notch. */
const HELD_BACK = 0.999;

/**
 * The same outline with a collinear vertex `d` in from every held-back end of
 * an edge longer than `2d`.
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
