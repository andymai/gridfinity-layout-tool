/**
 * Stage 4: Ramer–Douglas–Peucker polyline simplification.
 *
 * Collapses the dense per-pixel contour to a sparse set of corners. Iterative
 * (explicit stack) so very long contours don't overflow the call stack.
 */

import type { Point } from './types';

function perpDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  // |cross product| / |segment|
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  return cross / Math.sqrt(lenSq);
}

export function simplifyRdp(points: readonly Point[], epsilon: number): Point[] {
  const n = points.length;
  if (n < 3 || epsilon <= 0) return points.map((p) => ({ x: p.x, y: p.y }));

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) break;
    const [s, e] = segment;
    if (e <= s + 1) continue;

    let maxDist = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(points[i], points[s], points[e]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }

    if (maxDist > epsilon && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }

  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push({ x: points[i].x, y: points[i].y });
  }
  return out;
}
