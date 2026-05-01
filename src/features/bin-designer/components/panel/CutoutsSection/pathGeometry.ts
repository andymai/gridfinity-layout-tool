/**
 * Geometry utilities for bezier path cutouts.
 *
 * Bezier evaluation, flattening, triangulation, and per-segment
 * operations live in focused sibling modules; this file holds the
 * lightweight point-array editing helpers (insert, remove, scale,
 * translate, clamp, etc.) and re-exports the rest.
 *
 * All coordinates are in mm, Y-up, matching the cutout editor coordinate system.
 *
 * Sub-modules:
 *   - `pathGeometryBezier`         — cubic bezier eval + path flattening
 *   - `pathGeometryTriangulation`  — earclip triangulation
 *   - `pathGeometrySegments`       — segment hit-testing, split, self-intersection
 */

import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import type { PathPoint } from '@/features/bin-designer/types';
import type { Bounds } from './geometry';
import { flattenPath, type Point2D } from './pathGeometryBezier';

export { MIN_PATH_POINTS };
// DEFAULT_FLATTEN_TOLERANCE stays internal to pathGeometryBezier — it was
// a private constant in the pre-split file and has no current consumers.
export { cubicBezier, flattenPath, type Point2D } from './pathGeometryBezier';
export { triangulatePath } from './pathGeometryTriangulation';
export {
  findNearestSegment,
  evaluateSegmentPoint,
  flattenSegment,
  splitBezierSegment,
  isSelfIntersecting,
} from './pathGeometrySegments';

/** Maximum number of path points to prevent performance issues */
export const MAX_PATH_POINTS = 200;

/** Distance threshold in mm for snapping to close a path */
export const CLOSE_SNAP_THRESHOLD = 5;

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
