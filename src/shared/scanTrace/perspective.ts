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

/** A single point correspondence for an over-constrained fit. */
export interface PointPair {
  readonly src: Point;
  readonly dst: Point;
}

/** Row-major 3×3 product. */
function multiply3(a: Homography, b: Homography): Homography {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

/**
 * Isotropic (Hartley) normalization: the similarity that moves a point set's
 * centroid to the origin and scales it so the mean distance from the centroid
 * is √2, plus its inverse.
 *
 * The DLT's design matrix multiplies source by destination coordinates, so a
 * raw pixel/millimetre fit carries entries spanning ~10⁵ into an 8×8 normal-
 * equation solve that squares that spread again. Normalizing first keeps every
 * entry O(1), which is the difference between a usable least-squares fit and
 * one dominated by round-off. Returns null for a set with no spread.
 */
function normalizer(
  points: readonly Point[]
): { readonly forward: Homography; readonly inverse: Homography } | null {
  const n = points.length;
  if (n === 0) return null;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  let meanDist = 0;
  for (const p of points) meanDist += Math.hypot(p.x - cx, p.y - cy);
  meanDist /= n;
  if (!(meanDist > 1e-9)) return null;

  const s = Math.SQRT2 / meanDist;
  return {
    forward: [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1],
    inverse: [1 / s, 0, cx, 0, 1 / s, cy, 0, 0, 1],
  };
}

/**
 * Least-squares homography over any number (≥4) of correspondences.
 *
 * Four points determine a homography exactly, which means every corner-
 * detection error lands in the map itself — undetectable, and amplified across
 * the rest of the frame. With more points the system is over-determined and no
 * single bad correspondence dominates; {@link homographyRmsError} then reports
 * how well the whole set agrees, which four points can never tell you.
 *
 * Solved in the inhomogeneous form (h8 pinned to 1) via the normal equations,
 * which is well behaved once both point sets are Hartley-normalized. Returns
 * null for degenerate input.
 */
export function solveHomographyLeastSquares(pairs: readonly PointPair[]): Homography | null {
  if (pairs.length < 4) return null;
  const srcNorm = normalizer(pairs.map((p) => p.src));
  const dstNorm = normalizer(pairs.map((p) => p.dst));
  if (!srcNorm || !dstNorm) return null;

  const ata: number[][] = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const row = new Array<number>(8);

  const accumulate = (rhs: number): void => {
    for (let i = 0; i < 8; i++) {
      atb[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) ata[i][j] += row[i] * row[j];
    }
  };

  for (const pair of pairs) {
    const { x, y } = applyHomography(srcNorm.forward, pair.src);
    const { x: u, y: v } = applyHomography(dstNorm.forward, pair.dst);

    row[0] = x;
    row[1] = y;
    row[2] = 1;
    row[3] = 0;
    row[4] = 0;
    row[5] = 0;
    row[6] = -x * u;
    row[7] = -y * u;
    accumulate(u);

    row[0] = 0;
    row[1] = 0;
    row[2] = 0;
    row[3] = x;
    row[4] = y;
    row[5] = 1;
    row[6] = -x * v;
    row[7] = -y * v;
    accumulate(v);
  }

  const h = solveLinearSystem(ata, atb);
  if (!h) return null;
  const normalized: Homography = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  const denormalized = multiply3(dstNorm.inverse, multiply3(normalized, srcNorm.forward));
  return denormalized.every(Number.isFinite) ? denormalized : null;
}

/**
 * Root-mean-square distance, in destination units, between where `h` sends each
 * source point and where it was supposed to land. Zero for an exact four-point
 * solve; on an over-constrained fit it is the honest measure of how well the
 * reference was detected.
 */
export function homographyRmsError(h: Homography, pairs: readonly PointPair[]): number {
  if (pairs.length === 0) return 0;
  let sum = 0;
  for (const pair of pairs) {
    const mapped = applyHomography(h, pair.src);
    sum += (mapped.x - pair.dst.x) ** 2 + (mapped.y - pair.dst.y) ** 2;
  }
  return Math.sqrt(sum / pairs.length);
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
