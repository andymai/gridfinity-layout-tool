/**
 * Chaikin corner-cutting for a closed polygon.
 *
 * The mask→contour→RDP pipeline yields a faceted polygon (straight segments);
 * Chaikin rounds those corners into smooth curves so an organic tool traces as a
 * smooth outline rather than a many-sided polygon. Each iteration replaces every
 * vertex with two points at 1/4 and 3/4 along its adjacent edges, so straight
 * runs are preserved (their interior points stay collinear) while corners round.
 */

import type { Point } from './types';

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
