/**
 * Planar homography — the core of perspective correction.
 *
 * A flat reference of known real-world size (a bank card, a Gridfinity grid)
 * appears in the photo as some quadrilateral. The homography that maps that
 * quad back to its true rectangle simultaneously removes keystone distortion
 * AND pins millimetres. Applying it to the traced outline points yields a
 * square, metric outline — no image resampling needed.
 *
 * Pure math, no DOM. Points are in pixels on the way in, millimetres on the
 * way out (or vice versa — the matrix is whatever the correspondences define).
 */

import type { Point } from './types';

/** Row-major 3×3 homography: [h0 h1 h2; h3 h4 h5; h6 h7 h8]. */
export type Homography = readonly number[];

/**
 * Solve an n×n linear system A·x = b by Gauss–Jordan elimination with partial
 * pivoting. Returns null if the system is singular (degenerate correspondences).
 */
function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Work on an augmented copy so the caller's arrays aren't mutated.
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: pick the row with the largest magnitude in this column.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];

    // Normalize the pivot row.
    const pivotVal = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= pivotVal;

    // Eliminate this column from every other row.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }

  return m.map((row) => row[n]);
}

/**
 * Compute the homography mapping four source points to four destination points.
 *
 * Order matters: `src[i]` maps to `dst[i]`. Returns null for degenerate
 * (e.g. collinear) inputs.
 */
export function solveHomography(
  src: readonly [Point, Point, Point, Point],
  dst: readonly [Point, Point, Point, Point]
): Homography | null {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const h = solveLinearSystem(a, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Map a single point through a homography. */
export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** Map a list of points through a homography. */
export function rectifyPoints(points: readonly Point[], h: Homography): Point[] {
  return points.map((p) => applyHomography(h, p));
}
