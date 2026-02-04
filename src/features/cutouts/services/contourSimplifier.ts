/**
 * Contour simplification using the Douglas-Peucker algorithm.
 *
 * Reduces the number of points in a contour while preserving overall shape.
 * This is essential for traced tool outlines to ensure:
 * 1. Reasonable storage size in IndexedDB
 * 2. Fast CSG operations during bin generation
 * 3. Smooth 3D rendering without excessive triangles
 */

import type { NormalizedPoint } from '../types';
import { MAX_CONTOUR_POINTS } from '../types';

/**
 * Calculate perpendicular distance from a point to a line segment.
 *
 * @param point The point to measure from
 * @param lineStart Start of the line segment
 * @param lineEnd End of the line segment
 * @returns Distance from point to line
 */
function perpendicularDistance(
  point: NormalizedPoint,
  lineStart: NormalizedPoint,
  lineEnd: NormalizedPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line is actually a point
  if (dx === 0 && dy === 0) {
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  // Normalized line length squared
  const lineLengthSquared = dx * dx + dy * dy;

  // Calculate perpendicular distance using cross product
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );

  return numerator / Math.sqrt(lineLengthSquared);
}

/**
 * Douglas-Peucker algorithm for polyline simplification.
 *
 * Recursively simplifies a polyline by removing points that are within
 * epsilon distance of the line between the endpoints. Points beyond
 * epsilon are kept, and the algorithm recurses on the resulting segments.
 *
 * Time complexity: O(n²) worst case, O(n log n) average
 *
 * @param points Array of points to simplify
 * @param epsilon Maximum distance tolerance for point removal
 * @returns Simplified array of points
 */
export function douglasPeucker(
  points: ReadonlyArray<NormalizedPoint>,
  epsilon: number
): NormalizedPoint[] {
  if (points.length < 3) {
    return [...points];
  }

  // Find the point with the maximum distance from the line
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance exceeds epsilon, recursively simplify both halves
  if (maxDistance > epsilon) {
    const leftHalf = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const rightHalf = douglasPeucker(points.slice(maxIndex), epsilon);

    // Concatenate, removing the duplicate point at the junction
    return [...leftHalf.slice(0, -1), ...rightHalf];
  }

  // All intermediate points are within tolerance - keep only endpoints
  return [start, end];
}

/**
 * Simplify a contour using Douglas-Peucker algorithm.
 *
 * Ensures the output doesn't exceed MAX_CONTOUR_POINTS by progressively
 * increasing epsilon until the constraint is satisfied.
 *
 * @param points Original contour points (normalized 0-1 coordinates)
 * @param epsilon Initial simplification tolerance (default 0.005)
 * @returns Simplified contour points
 */
export function simplifyContour(
  points: ReadonlyArray<NormalizedPoint>,
  epsilon = 0.005
): NormalizedPoint[] {
  if (points.length <= 3) {
    return [...points];
  }

  let simplified = douglasPeucker(points, epsilon);

  // Progressively increase epsilon until we're under the limit
  let currentEpsilon = epsilon;
  while (simplified.length > MAX_CONTOUR_POINTS && currentEpsilon < 1) {
    currentEpsilon *= 1.5;
    simplified = douglasPeucker(points, currentEpsilon);
  }

  // Ensure we have at least 3 points for a valid closed contour
  if (simplified.length < 3 && points.length >= 3) {
    // Fall back to first, middle, and last points
    return [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  }

  return simplified;
}

/**
 * Calculate the total path length of a contour.
 *
 * @param points Contour points
 * @returns Sum of distances between consecutive points
 */
export function contourPathLength(points: ReadonlyArray<NormalizedPoint>): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Calculate the area of a closed contour using the shoelace formula.
 *
 * @param points Contour points (assumes closed polygon)
 * @returns Absolute area value
 */
export function contourArea(points: ReadonlyArray<NormalizedPoint>): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}
