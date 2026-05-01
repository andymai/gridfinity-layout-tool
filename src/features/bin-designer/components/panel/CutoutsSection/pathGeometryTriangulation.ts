/**
 * 2D polygon triangulation via ear-clipping.
 *
 * Used to build the fill mesh under a closed pen-tool path. Suitable for
 * convex and mildly concave polygons; complex self-intersecting paths
 * yield an empty triangle list (caller should detect those upstream via
 * `isSelfIntersecting`).
 */

import type { Point2D } from './pathGeometryBezier';

/**
 * Triangulate a closed polygon using the ear-clipping algorithm.
 *
 * Uses a simple implementation suitable for convex and mildly concave
 * polygons typical of pen tool cutouts. For complex self-intersecting
 * paths, returns an empty array.
 *
 * @returns Array of triangle index triples into the input points array.
 */
export function triangulatePath(flatPoints: readonly Point2D[]): number[] {
  const n = flatPoints.length;
  if (n < 3) return [];

  // Use earcut-style triangulation via flat coordinate array
  const coords: number[] = [];
  for (const p of flatPoints) {
    coords.push(p.x, p.y);
  }

  return earclip(coords);
}

/**
 * Simple ear-clipping triangulation for 2D polygons.
 *
 * Input: flat array [x0, y0, x1, y1, ...] of polygon vertices.
 * Output: array of index triples [i0, i1, i2, ...] forming triangles.
 */
function earclip(coords: number[]): number[] {
  const n = coords.length / 2;
  if (n < 3) return [];

  // Build index list
  const indices: number[] = [];
  const remaining = Array.from({ length: n }, (_, i) => i);

  // Ensure CCW winding
  if (signedArea(coords) < 0) {
    remaining.reverse();
  }

  let attempts = 0;
  const maxAttempts = n * n;

  while (remaining.length > 2 && attempts < maxAttempts) {
    attempts++;
    let earFound = false;

    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length];
      const curr = remaining[i];
      const next = remaining[(i + 1) % remaining.length];

      const ax = coords[prev * 2],
        ay = coords[prev * 2 + 1];
      const bx = coords[curr * 2],
        by = coords[curr * 2 + 1];
      const cx = coords[next * 2],
        cy = coords[next * 2 + 1];

      // Check if the triangle is convex (CCW)
      const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (cross <= 0) continue;

      // Check that no other vertex lies inside this triangle
      let containsPoint = false;
      for (const idx of remaining) {
        if (idx === prev || idx === curr || idx === next) continue;
        const px = coords[idx * 2],
          py = coords[idx * 2 + 1];
        if (pointInTriangle(px, py, ax, ay, bx, by, cx, cy)) {
          containsPoint = true;
          break;
        }
      }

      if (!containsPoint) {
        indices.push(prev, curr, next);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) break;
  }

  // If we couldn't reduce all the way down to a triangle, the polygon is
  // self-intersecting or otherwise unsuitable for ear clipping; return
  // an empty list rather than a partial mesh so callers don't render a
  // broken fill (matches the doc on `triangulatePath`).
  if (remaining.length > 2) return [];

  return indices;
}

function signedArea(coords: number[]): number {
  const n = coords.length / 2;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i * 2] * coords[j * 2 + 1];
    area -= coords[j * 2] * coords[i * 2 + 1];
  }
  return area / 2;
}

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
