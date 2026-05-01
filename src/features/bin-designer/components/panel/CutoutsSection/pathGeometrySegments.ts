/**
 * Per-segment operations on bezier paths: hit-testing, sampling,
 * splitting, and self-intersection detection.
 *
 * `findNearestSegment` powers click-to-insert-point and segment-hover
 * highlighting. `splitBezierSegment` is the math behind point insertion
 * that preserves curvature. `isSelfIntersecting` flattens then runs an
 * O(n²) edge-pair check for the pen-tool's "invalid path" warning.
 */

import type { PathPoint } from '@/features/bin-designer/types';
import { cubicBezier, flattenPath, type Point2D } from './pathGeometryBezier';

/**
 * Find the nearest segment of a path to a given point.
 *
 * Returns the segment index and parameter t, or null if no segment is
 * within the threshold.
 */
export function findNearestSegment(
  px: number,
  py: number,
  points: readonly PathPoint[],
  threshold: number
): { segmentIndex: number; t: number } | null {
  const n = points.length;
  if (n < 2) return null;

  let bestDist = threshold;
  let bestSegment: { segmentIndex: number; t: number } | null = null;

  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const hasCurve = p0.handleOut !== null || p1.handleIn !== null;

    if (!hasCurve) {
      // Straight line: project point onto line segment
      const result = pointToLineSegmentDist(px, py, p0.x, p0.y, p1.x, p1.y);
      if (result.dist < bestDist) {
        bestDist = result.dist;
        bestSegment = { segmentIndex: i, t: result.t };
      }
    } else {
      // Bezier: sample and find closest
      const cp1 = p0.handleOut
        ? { x: p0.x + p0.handleOut.dx, y: p0.y + p0.handleOut.dy }
        : { x: p0.x, y: p0.y };
      const cp2 = p1.handleIn
        ? { x: p1.x + p1.handleIn.dx, y: p1.y + p1.handleIn.dy }
        : { x: p1.x, y: p1.y };

      const steps = 20;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const pt = cubicBezier({ x: p0.x, y: p0.y }, cp1, cp2, { x: p1.x, y: p1.y }, t);
        const d = Math.sqrt((px - pt.x) ** 2 + (py - pt.y) ** 2);
        if (d < bestDist) {
          bestDist = d;
          bestSegment = { segmentIndex: i, t };
        }
      }
    }
  }

  return bestSegment;
}

/**
 * Evaluate the world position at parameter t on the segment from path[segmentIndex]
 * to path[(segmentIndex+1) % n]. Works for both straight and bezier segments.
 */
export function evaluateSegmentPoint(
  points: readonly PathPoint[],
  segmentIndex: number,
  t: number
): { x: number; y: number } {
  const p0 = points[segmentIndex];
  const p1 = points[(segmentIndex + 1) % points.length];
  const hasCurve = p0.handleOut !== null || p1.handleIn !== null;

  if (!hasCurve) {
    return { x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) };
  }

  const cp1 = p0.handleOut
    ? { x: p0.x + p0.handleOut.dx, y: p0.y + p0.handleOut.dy }
    : { x: p0.x, y: p0.y };
  const cp2 = p1.handleIn
    ? { x: p1.x + p1.handleIn.dx, y: p1.y + p1.handleIn.dy }
    : { x: p1.x, y: p1.y };

  return cubicBezier({ x: p0.x, y: p0.y }, cp1, cp2, { x: p1.x, y: p1.y }, t);
}

/**
 * Flatten a single segment (from path[segmentIndex] to path[(segmentIndex+1)%n])
 * into a polyline of {x,y} points. Useful for highlighting a hovered segment.
 */
export function flattenSegment(
  points: readonly PathPoint[],
  segmentIndex: number,
  steps = 20
): Array<{ x: number; y: number }> {
  const p0 = points[segmentIndex];
  const p1 = points[(segmentIndex + 1) % points.length];
  const hasCurve = p0.handleOut !== null || p1.handleIn !== null;

  if (!hasCurve) {
    return [
      { x: p0.x, y: p0.y },
      { x: p1.x, y: p1.y },
    ];
  }

  const cp1 = p0.handleOut
    ? { x: p0.x + p0.handleOut.dx, y: p0.y + p0.handleOut.dy }
    : { x: p0.x, y: p0.y };
  const cp2 = p1.handleIn
    ? { x: p1.x + p1.handleIn.dx, y: p1.y + p1.handleIn.dy }
    : { x: p1.x, y: p1.y };

  const result: Array<{ x: number; y: number }> = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    result.push(cubicBezier({ x: p0.x, y: p0.y }, cp1, cp2, { x: p1.x, y: p1.y }, t));
  }
  return result;
}

/** Distance from a point to a line segment, with parameter t. */
function pointToLineSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2), t: 0 };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return {
    dist: Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2),
    t,
  };
}

/**
 * Split a bezier segment at parameter t, returning the new point
 * with appropriate handles to preserve the curve shape.
 */
export function splitBezierSegment(
  p0: PathPoint,
  p1: PathPoint,
  t: number
): { before: PathPoint; mid: PathPoint; after: PathPoint } {
  const a = { x: p0.x, y: p0.y };
  const cp1 = p0.handleOut ? { x: p0.x + p0.handleOut.dx, y: p0.y + p0.handleOut.dy } : a;
  const cp2 = p1.handleIn
    ? { x: p1.x + p1.handleIn.dx, y: p1.y + p1.handleIn.dy }
    : { x: p1.x, y: p1.y };
  const b = { x: p1.x, y: p1.y };

  // De Casteljau split at parameter t
  const l01 = lerp(a, cp1, t);
  const l12 = lerp(cp1, cp2, t);
  const l23 = lerp(cp2, b, t);
  const l012 = lerp(l01, l12, t);
  const l123 = lerp(l12, l23, t);
  const l0123 = lerp(l012, l123, t);

  const before: PathPoint = {
    ...p0,
    handleOut: p0.handleOut ? { dx: l01.x - p0.x, dy: l01.y - p0.y } : null,
  };

  const midPoint: PathPoint = {
    x: l0123.x,
    y: l0123.y,
    handleIn: { dx: l012.x - l0123.x, dy: l012.y - l0123.y },
    handleOut: { dx: l123.x - l0123.x, dy: l123.y - l0123.y },
    symmetric: false,
  };

  const after: PathPoint = {
    ...p1,
    handleIn: p1.handleIn ? { dx: l23.x - p1.x, dy: l23.y - p1.y } : null,
  };

  return { before, mid: midPoint, after };
}

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Check if a closed polyline self-intersects.
 * Flattens the path then tests all non-adjacent edge pairs.
 * Returns true if any intersection is found.
 */
export function isSelfIntersecting(points: readonly PathPoint[]): boolean {
  if (points.length < 3) return false;

  const poly = flattenPath(points);
  const n = poly.length;
  if (n < 4) return false;

  // Test all non-adjacent edge pairs
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges (share a vertex)
      if (j === n - 1 && i === 0) continue;

      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];

      if (segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) {
        return true;
      }
    }
  }

  return false;
}

/** Test if two line segments (p1→p2) and (p3→p4) intersect (proper crossing only). */
function segmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): boolean {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-10) return false; // parallel

  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;

  // Strict interior intersection (exclude endpoints to avoid false positives at vertices)
  const eps = 1e-6;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}
