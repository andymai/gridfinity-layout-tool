/**
 * Round the corners of a drawer outline into tangent arcs.
 *
 * Expressed as a transform of the outline itself rather than as a generator
 * feature, because the outline has several consumers: cell classification, the
 * plate slab intersect, `padOutline`, the layout hatching, and bin-placement
 * gating all read the same vertices. Filleting inside the generator would round
 * the printed plate while the layout still believed the corner was sharp.
 *
 * `OutlineVertex` already carries `bulge`, so a fillet needs no new
 * representation: each corner becomes two points joined by an arc.
 */

import type { DrawerOutline, OutlineVertex } from '@/core/types';
import { arcGeometry, BULGE_EPS, type OutlinePoint } from './drawerOutlineGeometry';
import { OUTLINE_MAX_VERTICES, OUTLINE_QUANTUM_MM } from './drawerOutline';

/** Below this a corner is treated as straight and left alone. */
const MIN_TURN_RAD = 1e-4;
/** Fillets smaller than this are not worth the extra vertices. */
const MIN_RADIUS_MM = 0.05;
/**
 * Fraction of an adjacent edge one fillet may consume. Just under half, so two
 * fillets sharing an edge always leave a real segment between them — meeting
 * exactly at the midpoint produces coincident vertices, which the outline
 * validator rejects as a degenerate segment.
 */
const MAX_EDGE_SHARE = 0.49;

interface Corner {
  readonly turn: number;
  readonly setback: number;
}

/**
 * Signed turn at a corner and the distance back along each edge the arc needs.
 *
 * `turn` is the change in heading, positive for a left turn — which on a CCW
 * loop is a convex corner. The arc's sweep equals that turn, so its bulge is
 * `tan(turn/4)` and it lands on the correct side without a special case for
 * concave corners.
 */
function cornerAt(
  prev: OutlineVertex,
  v: OutlineVertex,
  next: OutlineVertex,
  radiusMm: number
): Corner | null {
  const inX = v.x - prev.x;
  const inY = v.y - prev.y;
  const outX = next.x - v.x;
  const outY = next.y - v.y;
  const inLen = Math.hypot(inX, inY);
  const outLen = Math.hypot(outX, outY);
  if (inLen < MIN_RADIUS_MM || outLen < MIN_RADIUS_MM) return null;

  const turn = Math.atan2(inX * outY - inY * outX, inX * outX + inY * outY);
  if (Math.abs(turn) < MIN_TURN_RAD) return null;
  // A reversal has no defined fillet plane.
  if (Math.abs(Math.abs(turn) - Math.PI) < MIN_TURN_RAD) return null;

  // Setback is where the arc becomes tangent to each edge. Capped at half of
  // each adjacent edge so two neighbouring fillets can never overrun each other
  // and fold the loop.
  const ideal = radiusMm / Math.tan((Math.PI - Math.abs(turn)) / 2);
  const setback = Math.min(ideal, inLen * MAX_EDGE_SHARE, outLen * MAX_EDGE_SHARE);
  if (setback < MIN_RADIUS_MM) return null;
  return { turn, setback };
}

/**
 * Round the eligible corners of `outline`.
 *
 * `radii` is either one radius for every corner or a per-vertex array indexed
 * by the corner it rounds — a drawer moulding is rarely uniform, so a single
 * radius cannot express the shape people actually measure.
 *
 * A corner is skipped, staying sharp, when either adjacent segment is already
 * an arc (the tangent construction assumes straight edges), when the corner is
 * too shallow to round, or when both adjacent edges are too short to give the
 * arc room. Returns the outline unchanged when nothing is eligible, so callers
 * can apply it unconditionally.
 *
 * The per-corner setback is capped at half of each adjacent edge, so adjacent
 * fillets cannot overrun one another however large the radius, and the total
 * is budgeted against `OUTLINE_MAX_VERTICES` so rounding a detailed perimeter
 * cannot push it past the model ceiling and block Apply.
 */
export function filletOutline(
  outline: DrawerOutline,
  radii: number | readonly number[]
): DrawerOutline {
  const uniform = typeof radii === 'number';
  if (uniform && radii < MIN_RADIUS_MM) return outline;
  const radiusAt = (i: number): number => (uniform ? radii : (radii[i] ?? 0));
  const verts = outline.vertices;
  const n = verts.length;
  if (n < 3) return outline;

  const out: OutlineVertex[] = [];
  let changed = false;
  // Each fillet costs one extra vertex. Past the model's ceiling the outline
  // would fail validation and Apply would be blocked with no way back except
  // undoing the radius, so the remaining corners stay sharp instead.
  let budget = OUTLINE_MAX_VERTICES - n;

  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const v = verts[i];
    const next = verts[(i + 1) % n];

    // The construction is tangent to straight edges; an arc arriving at or
    // leaving the corner has its own curvature, so leave it alone.
    // `BULGE_EPS`, not `=== 0`: arcGeometry, flattenOutline and the validator
    // all treat anything below it as straight, and a corner they consider
    // straight must be filletable here too.
    const straightIn = Math.abs(prev.bulge ?? 0) < BULGE_EPS;
    const straightOut = Math.abs(v.bulge ?? 0) < BULGE_EPS;
    // A zero radius falls out naturally: cornerAt's setback collapses below
    // MIN_RADIUS_MM and it returns null, so an unrounded corner needs no branch.
    const corner =
      straightIn && straightOut && budget > 0 ? cornerAt(prev, v, next, radiusAt(i)) : null;

    if (corner === null) {
      out.push(v);
      continue;
    }

    const inLen = Math.hypot(v.x - prev.x, v.y - prev.y);
    const outLen = Math.hypot(next.x - v.x, next.y - v.y);
    const { turn, setback } = corner;
    const start = {
      x: v.x - ((v.x - prev.x) / inLen) * setback,
      y: v.y - ((v.y - prev.y) / inLen) * setback,
    };
    const end = {
      x: v.x + ((next.x - v.x) / outLen) * setback,
      y: v.y + ((next.y - v.y) / outLen) * setback,
    };
    // The arc sweeps by the turn angle, so its bulge is tan(turn/4) — signed,
    // which puts a concave corner's arc on the correct side automatically.
    out.push({ ...start, bulge: Math.tan(turn / 4) });
    out.push(end);
    budget--;
    changed = true;
  }

  if (!changed) return outline;
  return outline.authoring !== undefined
    ? { vertices: out, authoring: outline.authoring }
    : { vertices: out };
}

/**
 * Setback mismatch (mm) still read as tangent. A stored outline has been
 * quantized to `OUTLINE_QUANTUM_MM`, so an exactly-filleted corner comes back
 * off by a few hundredths and an exact test would find no fillets at all.
 */
const UNFILLET_SETBACK_TOL_MM = 0.05;
/** Same allowance on the arc's sweep, which the quantization also perturbs. */
const UNFILLET_BULGE_TOL = 5e-3;

export interface UnfilletedOutline {
  readonly vertices: OutlineVertex[];
  /** Radius (mm) recovered per returned vertex; 0 where the corner is sharp. */
  readonly radii: number[];
}

/** Intersection of two lines given a point and a unit direction on each. */
function lineIntersection(
  p0: OutlinePoint,
  d0: OutlinePoint,
  p1: OutlinePoint,
  d1: OutlinePoint
): OutlinePoint | null {
  const cross = d0.x * d1.y - d0.y * d1.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((p1.x - p0.x) * d1.y - (p1.y - p0.y) * d1.x) / cross;
  return { x: p0.x + d0.x * t, y: p0.y + d0.y * t };
}

/**
 * The corner and radius a `start`/`end` vertex pair was rounded from, or null
 * when the arc is drawn geometry rather than a fillet.
 *
 * Both adjacent segments must be straight, the recovered corner must lie ahead
 * of the arc's start and behind its end, and the arc must be tangent to both
 * edges — which shows up as equal setbacks and a sweep equal to the corner's
 * turn. A hand-drawn arc failing any of these is left exactly as drawn.
 */
function recoverFillet(
  prev: OutlineVertex,
  start: OutlineVertex,
  end: OutlineVertex,
  next: OutlineVertex
): { corner: OutlinePoint; radius: number } | null {
  const bulge = start.bulge ?? 0;
  if (Math.abs(bulge) < BULGE_EPS) return null;
  if (Math.abs(prev.bulge ?? 0) >= BULGE_EPS) return null;
  if (Math.abs(end.bulge ?? 0) >= BULGE_EPS) return null;

  const inLen = Math.hypot(start.x - prev.x, start.y - prev.y);
  const outLen = Math.hypot(next.x - end.x, next.y - end.y);
  if (inLen < MIN_RADIUS_MM || outLen < MIN_RADIUS_MM) return null;
  const din = { x: (start.x - prev.x) / inLen, y: (start.y - prev.y) / inLen };
  const dout = { x: (next.x - end.x) / outLen, y: (next.y - end.y) / outLen };

  const corner = lineIntersection(start, din, end, dout);
  if (corner === null) return null;

  const setIn = (corner.x - start.x) * din.x + (corner.y - start.y) * din.y;
  const setOut = (end.x - corner.x) * dout.x + (end.y - corner.y) * dout.y;
  if (setIn < MIN_RADIUS_MM || setOut < MIN_RADIUS_MM) return null;
  const setback = Math.max(setIn, setOut);
  if (Math.abs(setIn - setOut) > Math.max(UNFILLET_SETBACK_TOL_MM, 0.01 * setback)) return null;

  const turn = Math.atan2(din.x * dout.y - din.y * dout.x, din.x * dout.x + din.y * dout.y);
  if (Math.abs(Math.tan(turn / 4) - bulge) > Math.max(UNFILLET_BULGE_TOL, 0.02 * Math.abs(bulge))) {
    return null;
  }

  const arc = arcGeometry(start, end, bulge);
  if (arc === null) return null;
  // Quantized like the coordinates it is derived from, or four corners rounded
  // to the same radius come back differing in the last float digit and read as
  // four different radii.
  return { corner, radius: Math.round(arc.r / OUTLINE_QUANTUM_MM) * OUTLINE_QUANTUM_MM };
}

/**
 * Inverse of {@link filletOutline}: collapse every rounded corner back to a
 * sharp one plus its radius.
 *
 * This is what lets the pen editor reopen a saved shape with its radii still
 * adjustable. Storing the pre-fillet sketch alongside the geometry would do the
 * same, but the tangent construction is exactly invertible — the corner is
 * where the two adjacent edges meet — so no second copy of the shape has to be
 * persisted, versioned or sanitized.
 *
 * Where `filletOutline` clipped a radius to the setback cap, this recovers the
 * radius that was actually applied rather than the one that was asked for.
 */
export function unfilletOutline(outline: DrawerOutline): UnfilletedOutline {
  const verts = outline.vertices;
  const n = verts.length;
  const asDrawn = (): UnfilletedOutline => ({
    vertices: [...verts],
    radii: new Array<number>(n).fill(0),
  });
  // A fillet costs one vertex, so the smallest shape that can carry one is a
  // rounded triangle.
  if (n < 4) return asDrawn();

  const corners = new Map<number, { x: number; y: number; radius: number }>();
  const consumed = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (consumed.has(i)) continue;
    const endIdx = (i + 1) % n;
    if (consumed.has(endIdx) || corners.has(endIdx)) continue;
    const found = recoverFillet(
      verts[(i - 1 + n) % n],
      verts[i],
      verts[endIdx],
      verts[(i + 2) % n]
    );
    if (found === null) continue;
    corners.set(i, { x: found.corner.x, y: found.corner.y, radius: found.radius });
    consumed.add(endIdx);
  }
  if (corners.size === 0) return asDrawn();

  const vertices: OutlineVertex[] = [];
  const radii: number[] = [];
  for (let i = 0; i < n; i++) {
    if (consumed.has(i)) continue;
    const corner = corners.get(i);
    if (corner === undefined) {
      vertices.push(verts[i]);
      radii.push(0);
      continue;
    }
    // No bulge on the recovered corner: filletOutline only rounds a corner
    // whose outgoing edge is straight, so the consumed `end` never carried one.
    vertices.push({ x: corner.x, y: corner.y });
    radii.push(corner.radius);
  }
  // Unreachable for filletOutline output (three corners round to six vertices),
  // but a hand-edited or synced outline is not bound by that.
  if (vertices.length < 3) return asDrawn();
  return { vertices, radii };
}
