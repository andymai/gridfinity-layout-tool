/**
 * Cubic bezier evaluation + path flattening.
 *
 * `flattenPath` is the heart of the cutout pen tool: every other geometry
 * helper (triangulation, hit-testing, bounds, self-intersection check)
 * either calls this or works on the polylines it produces. Uses De
 * Casteljau subdivision so the per-curve sample density adapts to the
 * curve's local flatness.
 */

import type { PathPoint } from '@/features/bin-designer/types';

/** Default bezier flattening tolerance in mm */
const DEFAULT_FLATTEN_TOLERANCE = 0.1;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/** Evaluate a cubic bezier curve at parameter t ∈ [0, 1]. */
export function cubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p1: Point2D,
  t: number
): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y,
  };
}

/** Compute the chord length between two points. */
function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Recursively subdivide a cubic bezier into line segments.
 *
 * Uses De Casteljau's algorithm: splits the curve at t=0.5 and checks
 * if the control points are close enough to the chord. If not, recurses.
 */
function flattenCubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p1: Point2D,
  tolerance: number,
  result: Point2D[],
  depth: number = 0
): void {
  // Max recursion depth to prevent stack overflow on degenerate curves
  if (depth > 10) {
    result.push(p1);
    return;
  }

  // Check if the control points are close enough to the chord
  const chordLen = dist(p0, p1);
  const d1 =
    chordLen > 0.001
      ? Math.abs((p1.x - p0.x) * (p0.y - cp1.y) - (p0.x - cp1.x) * (p1.y - p0.y)) / chordLen
      : dist(p0, cp1);
  const d2 =
    chordLen > 0.001
      ? Math.abs((p1.x - p0.x) * (p0.y - cp2.y) - (p0.x - cp2.x) * (p1.y - p0.y)) / chordLen
      : dist(p0, cp2);

  if (d1 + d2 <= tolerance) {
    result.push(p1);
    return;
  }

  // De Casteljau split at t=0.5
  const m01 = mid(p0, cp1);
  const m12 = mid(cp1, cp2);
  const m23 = mid(cp2, p1);
  const m012 = mid(m01, m12);
  const m123 = mid(m12, m23);
  const m0123 = mid(m012, m123);

  flattenCubicBezier(p0, m01, m012, m0123, tolerance, result, depth + 1);
  flattenCubicBezier(m0123, m123, m23, p1, tolerance, result, depth + 1);
}

/**
 * Convert a bezier path to a polyline by flattening all curves.
 *
 * Straight segments (no handles) are kept as-is. Bezier segments are
 * recursively subdivided until each sub-chord is within `tolerance` mm.
 *
 * @param closed When true (default), flattens the closing segment (last → first)
 *   and omits the duplicate endpoint. When false, returns an open polyline ending
 *   at the last anchor — suitable for in-progress drawing previews.
 */
export function flattenPath(
  points: readonly PathPoint[],
  tolerance: number = DEFAULT_FLATTEN_TOLERANCE,
  closed: boolean = true
): Point2D[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));

  const result: Point2D[] = [];
  const n = points.length;
  const segmentCount = closed ? n : n - 1;

  for (let i = 0; i < segmentCount; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];

    if (i === 0) {
      result.push({ x: p0.x, y: p0.y });
    }

    // For the closing segment (last → first), include bezier intermediates
    // but NOT the endpoint (which would duplicate the first point).
    // lineLoop and earclip handle closure automatically.
    const isClosing = closed && i === n - 1;

    if (!p0.handleOut && !p1.handleIn) {
      if (!isClosing) {
        result.push({ x: p1.x, y: p1.y });
      }
    } else {
      const cp1: Point2D = p0.handleOut
        ? { x: p0.x + p0.handleOut.dx, y: p0.y + p0.handleOut.dy }
        : { x: p0.x, y: p0.y };
      const cp2: Point2D = p1.handleIn
        ? { x: p1.x + p1.handleIn.dx, y: p1.y + p1.handleIn.dy }
        : { x: p1.x, y: p1.y };

      flattenCubicBezier({ x: p0.x, y: p0.y }, cp1, cp2, { x: p1.x, y: p1.y }, tolerance, result);
      // Remove the endpoint if this is the closing segment (duplicate of first point)
      if (isClosing && result.length > 1) {
        result.pop();
      }
    }
  }

  return result;
}
