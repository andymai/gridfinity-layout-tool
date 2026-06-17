/**
 * Corner-cutting smoothers for a closed contour polygon.
 *
 * The mask→contour→RDP pipeline yields a faceted polygon (straight segments
 * meeting at vertices). Two smoothers turn it into a final outline:
 *
 *  - `chaikin` rounds *every* vertex — right for an organic blob, wrong for an
 *    angular tool (it bevels the 90° corners and tips that define the shape).
 *  - `smoothPreservingCorners` first classifies each vertex by its turning
 *    angle: sharp vertices (a tool's corners and tips) are kept exactly, while
 *    gentle vertices (the dense run of points RDP leaves along a curve) are
 *    corner-cut. Straight runs stay straight, real curves still round.
 */

import type { Point } from './types';

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function chaikin(points: readonly Point[], iterations: number): Point[] {
  if (points.length < 3 || iterations <= 0) return points.slice();
  let pts: Point[] = points.slice();
  for (let it = 0; it < iterations; it++) {
    const next: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    pts = next;
  }
  return pts;
}

/** Turning angle (radians, 0–π) between the incoming and outgoing edges at a vertex. */
function turningAngle(prev: Point, cur: Point, next: Point): number {
  const ix = cur.x - prev.x;
  const iy = cur.y - prev.y;
  const ox = next.x - cur.x;
  const oy = next.y - cur.y;
  const cross = ix * oy - iy * ox;
  const dot = ix * ox + iy * oy;
  return Math.abs(Math.atan2(cross, dot));
}

interface Vertex {
  readonly p: Point;
  /** Sharp vertices are carried through every iteration unchanged. */
  readonly corner: boolean;
}

/**
 * Smooth a closed polygon while keeping sharp corners crisp.
 *
 * A vertex whose turning angle is at least `cornerThresholdDeg` is treated as a
 * corner and passed through untouched; every other vertex is corner-cut toward
 * its neighbours (1/4 of the way each side), so collinear runs stay collinear
 * (straight edges remain straight) and gentle curves round over the iterations.
 */
export function smoothPreservingCorners(
  points: readonly Point[],
  iterations: number,
  cornerThresholdDeg = 36
): Point[] {
  if (points.length < 3 || iterations <= 0) return points.slice();
  const threshold = (cornerThresholdDeg * Math.PI) / 180;

  const n = points.length;
  let verts: Vertex[] = points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    return { p, corner: turningAngle(prev, p, next) >= threshold };
  });

  for (let it = 0; it < iterations; it++) {
    const count = verts.length;
    const next: Vertex[] = [];
    for (let i = 0; i < count; i++) {
      const cur = verts[i];
      if (cur.corner) {
        next.push(cur);
        continue;
      }
      const prev = verts[(i - 1 + count) % count].p;
      const after = verts[(i + 1) % count].p;
      next.push({ p: lerp(cur.p, prev, 0.25), corner: false });
      next.push({ p: lerp(cur.p, after, 0.25), corner: false });
    }
    verts = next;
  }

  return verts.map((v) => v.p);
}
