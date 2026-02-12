/**
 * Geometry utilities for bezier path cutouts.
 *
 * Provides bezier math, path flattening (bezier → polyline),
 * triangulation, bounds computation, point manipulation, and hit testing.
 *
 * All coordinates are in mm, Y-up, matching the cutout editor coordinate system.
 */

import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import type { PathPoint } from '@/features/bin-designer/types';
import type { Bounds } from './geometry';

export { MIN_PATH_POINTS };

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of path points to prevent performance issues */
export const MAX_PATH_POINTS = 200;

/** Distance threshold in mm for snapping to close a path */
export const CLOSE_SNAP_THRESHOLD = 5;

/** Default bezier flattening tolerance in mm */
const DEFAULT_FLATTEN_TOLERANCE = 0.1;

// ─── Bezier Math ────────────────────────────────────────────────────────────

interface Point2D {
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

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Path Flattening ────────────────────────────────────────────────────────

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

// ─── Triangulation ──────────────────────────────────────────────────────────

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

// ─── Path Bounds ────────────────────────────────────────────────────────────

/** Compute the axis-aligned bounding box of a path's vertices. */
export function getPathBounds(points: readonly PathPoint[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  // For accuracy with bezier curves, flatten first
  const flat = flattenPath(points);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const p of flat) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

// ─── Path Point Operations ──────────────────────────────────────────────────

/** Scale all path points proportionally around an origin. */
export function scalePathPoints(
  points: readonly PathPoint[],
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number
): PathPoint[] {
  return points.map((pt) => ({
    ...pt,
    x: originX + (pt.x - originX) * scaleX,
    y: originY + (pt.y - originY) * scaleY,
    handleIn: pt.handleIn ? { dx: pt.handleIn.dx * scaleX, dy: pt.handleIn.dy * scaleY } : null,
    handleOut: pt.handleOut ? { dx: pt.handleOut.dx * scaleX, dy: pt.handleOut.dy * scaleY } : null,
  }));
}

/** Translate all path points by a delta. */
export function translatePathPoints(
  points: readonly PathPoint[],
  dx: number,
  dy: number
): PathPoint[] {
  return points.map((pt) => ({
    ...pt,
    x: pt.x + dx,
    y: pt.y + dy,
  }));
}

/** Insert a new point into a path at the given index. */
export function insertPoint(
  points: readonly PathPoint[],
  index: number,
  point: PathPoint
): PathPoint[] {
  const result = [...points];
  result.splice(index, 0, point);
  return result;
}

/** Remove a point from a path at the given index. Requires 3+ points to remain. */
export function removePoint(points: readonly PathPoint[], index: number): PathPoint[] | null {
  if (points.length <= MIN_PATH_POINTS) return null;
  const result = [...points];
  result.splice(index, 1);
  return result;
}

/** Update a single point's properties. */
export function updatePoint(
  points: readonly PathPoint[],
  index: number,
  updates: Partial<PathPoint>
): PathPoint[] {
  return points.map((pt, i) => (i === index ? { ...pt, ...updates } : pt));
}

/**
 * Enforce handle symmetry on a point.
 * When symmetric, handleOut = -handleIn (mirrored through the point).
 */
export function enforceSymmetry(point: PathPoint, changedHandle: 'in' | 'out'): PathPoint {
  if (!point.symmetric) return point;

  if (changedHandle === 'out' && point.handleOut) {
    return {
      ...point,
      handleIn: { dx: -point.handleOut.dx, dy: -point.handleOut.dy },
    };
  }
  if (changedHandle === 'in' && point.handleIn) {
    return {
      ...point,
      handleOut: { dx: -point.handleIn.dx, dy: -point.handleIn.dy },
    };
  }
  return point;
}

// ─── Hit Testing ────────────────────────────────────────────────────────────

/** Check if a point is within threshold distance of a target. */
export function isNearPoint(
  px: number,
  py: number,
  tx: number,
  ty: number,
  threshold: number
): boolean {
  return (px - tx) ** 2 + (py - ty) ** 2 <= threshold * threshold;
}

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

// ─── Angle Snapping ─────────────────────────────────────────────────────────

/**
 * Constrain an angle to the nearest 45-degree increment.
 * Used with Shift key during pen tool drawing.
 */
export function snapAngle45(fromX: number, fromY: number, toX: number, toY: number): Point2D {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.001) return { x: toX, y: toY };

  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: fromX + length * Math.cos(snapped),
    y: fromY + length * Math.sin(snapped),
  };
}

/**
 * Create a corner PathPoint (no bezier handles).
 */
export function cornerPoint(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: true };
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

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Clamp all path points and their bezier handles to stay within bin bounds.
 * Points are clamped to [0, width] × [0, depth]. Handles are shortened
 * so their absolute position stays in bounds.
 */
export function clampPathToBounds(
  points: readonly PathPoint[],
  width: number,
  depth: number
): PathPoint[] {
  return points.map((pt) => {
    const x = Math.max(0, Math.min(pt.x, width));
    const y = Math.max(0, Math.min(pt.y, depth));

    let handleIn = pt.handleIn;
    if (handleIn) {
      const hx = Math.max(0, Math.min(x + handleIn.dx, width)) - x;
      const hy = Math.max(0, Math.min(y + handleIn.dy, depth)) - y;
      handleIn = { dx: hx, dy: hy };
    }

    let handleOut = pt.handleOut;
    if (handleOut) {
      const hx = Math.max(0, Math.min(x + handleOut.dx, width)) - x;
      const hy = Math.max(0, Math.min(y + handleOut.dy, depth)) - y;
      handleOut = { dx: hx, dy: hy };
    }

    return { ...pt, x, y, handleIn, handleOut };
  });
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
