/**
 * Shared polyline helpers used by both the 2D cut editor and the generation
 * worker. Kept in `shared/` so the two flatteners (the editor's adaptive
 * `flattenPath` and the worker's fixed-step `flattenPathToPolyline`) enforce
 * the same degenerate-vertex invariant from one canonical source.
 */

import { polylineCrosses } from './outlineSegments';

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

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Where edges a0-a1 and b0-b1 cross strictly inside both, if they do. */
function crossing(a0: Pt, a1: Pt, b0: Pt, b1: Pt): Pt | null {
  const rx = a1.x - a0.x;
  const ry = a1.y - a0.y;
  const sx = b1.x - b0.x;
  const sy = b1.y - b0.y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const t = ((b0.x - a0.x) * sy - (b0.y - a0.y) * sx) / den;
  const u = ((b0.x - a0.x) * ry - (b0.y - a0.y) * rx) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a0.x + t * rx, y: a0.y + t * ry };
}

function area(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[j].y + ring[i].y);
  }
  return Math.abs(sum / 2);
}

/** Edges this many apart, at most, close a loop worth looking for. */
const LOOP_SPAN = 32;

/**
 * A closed polyline with each small loop it makes by crossing itself cut out
 * at the crossing. A trace's fold, or rounding that pushes a near-touching
 * zigzag across itself, leaves loops like these, and the builder cuts an
 * outline that crosses itself as its bounding box. A loop of `maxArea` or more
 * is a real part of the shape and is left, crossing and all.
 *
 * `at` makes the point the loop is cut at, from the one before it.
 */
export function withoutTinyLoops<T extends Pt>(
  ring: readonly T[],
  maxArea: number,
  at: (x: number, y: number, from: T) => T
): T[] {
  let points = [...ring];
  for (let pass = 0; pass < ring.length && polylineCrosses(points); pass++) {
    const n = points.length;
    let cut: { i: number; k: number; x: Pt } | null = null;
    for (let i = 0; i < n && !cut; i++) {
      for (let k = 2; k <= Math.min(LOOP_SPAN, n - 2) && !cut; k++) {
        const j = (i + k) % n;
        const x = crossing(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]);
        if (!x) continue;
        const loop = [x, ...Array.from({ length: k }, (_, m) => points[(i + 1 + m) % n])];
        if (area(loop) < maxArea) cut = { i, k, x };
      }
    }
    if (!cut) break;
    const { i, k, x } = cut;
    const turned = [...points.slice(i), ...points.slice(0, i)];
    points = [turned[0], at(x.x, x.y, turned[0]), ...turned.slice(k + 1)];
  }
  return points;
}
