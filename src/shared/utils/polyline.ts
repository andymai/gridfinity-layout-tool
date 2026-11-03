/**
 * Shared polyline helpers used by both the 2D cut editor and the generation
 * worker. Kept in `shared/` so the two flatteners (the editor's adaptive
 * `flattenPath` and the worker's fixed-step `flattenPathToPolyline`) enforce
 * the same degenerate-vertex invariant from one canonical source.
 */

/** Two points closer than this (mm) are treated as the same vertex. Far below
 * the 0.5mm editor snap grid and any printable resolution, so it only ever
 * collapses genuine duplicates — never distinct (e.g. collinear) geometry. */
export const COINCIDENT_POINT_EPSILON = 1e-3;

/**
 * Drop coincident consecutive points from a flattened polyline. When `closed`
 * (the default), also drops a trailing run of points coincident with the first
 * so the implicit closing edge is never zero-length.
 *
 * Snap-to-grid (two clicks in one grid cell) and `clampPathToBounds` can leave
 * duplicate points in a committed path. The zero-length edge they produce makes
 * earclip triangulation bail out (empty fill in the editor) and OpenCascade
 * reject the wire in the worker (the cut collapses to a bounding-box rectangle).
 *
 * Returns references to the original point objects (never mutates input).
 */
export function dropCoincidentPoints<T extends { readonly x: number; readonly y: number }>(
  poly: readonly T[],
  closed = true
): T[] {
  const eps2 = COINCIDENT_POINT_EPSILON * COINCIDENT_POINT_EPSILON;
  const near = (a: T, b: T): boolean => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= eps2;

  const out: T[] = [];
  for (const p of poly) {
    if (out.length === 0 || !near(out[out.length - 1], p)) out.push(p);
  }
  if (closed) {
    while (out.length > 1 && near(out[out.length - 1], out[0])) out.pop();
  }
  return out;
}
