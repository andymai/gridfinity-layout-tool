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
 * Round every eligible corner of `outline` to `radiusMm`.
 *
 * A corner is skipped, staying sharp, when either adjacent segment is already
 * an arc (the tangent construction assumes straight edges), when the corner is
 * too shallow to round, or when both adjacent edges are too short to give the
 * arc room. Returns the outline unchanged when nothing is eligible, so callers
 * can apply it unconditionally.
 *
 * The per-corner setback is capped at half of each adjacent edge, so adjacent
 * fillets cannot overrun one another however large the radius.
 */
export function filletOutline(outline: DrawerOutline, radiusMm: number): DrawerOutline {
  if (radiusMm < MIN_RADIUS_MM) return outline;
  const verts = outline.vertices;
  const n = verts.length;
  if (n < 3) return outline;

  const out: OutlineVertex[] = [];
  let changed = false;

  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const v = verts[i];
    const next = verts[(i + 1) % n];

    // The construction is tangent to straight edges; an arc arriving at or
    // leaving the corner has its own curvature, so leave it alone.
    const straightIn = (prev.bulge ?? 0) === 0;
    const straightOut = (v.bulge ?? 0) === 0;
    const corner = straightIn && straightOut ? cornerAt(prev, v, next, radiusMm) : null;

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
    changed = true;
  }

  if (!changed) return outline;
  return outline.authoring !== undefined
    ? { vertices: out, authoring: outline.authoring }
    : { vertices: out };
}
