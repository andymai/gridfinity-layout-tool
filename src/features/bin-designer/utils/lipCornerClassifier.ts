/**
 * Classify LIP-tagged triangles into four corner zones based on each
 * triangle centroid's quadrant relative to the lip's outer XY bbox.
 *
 * Shared by the 3MF exporter (flat-vertex STL data) and the 3D preview
 * (indexed BufferGeometry) — both supply a `triangleXY` callback so this
 * module stays geometry-format-agnostic.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { LipCorner } from '../types/featureColors';

/**
 * Compute the centerline of the lip footprint by taking the outer XY
 * bbox of every LIP triangle's centroid. Returns null when no lip exists.
 *
 * Bbox over centroids rather than vertices is deliberate: a single
 * triangle that straddles the bin's center wouldn't shift the split,
 * which keeps the four quadrants symmetric for typical rectangular bins.
 */
export function computeLipBBoxCenter(
  faceGroups: readonly FaceGroupData[],
  triangleXY: (triangleIndex: number) => { x: number; y: number }
): { cx: number; cy: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let any = false;

  for (const g of faceGroups) {
    if (g.tag !== FeatureTag.LIP) continue;
    const triStart = g.start / 3;
    const triEnd = triStart + g.count / 3;
    for (let i = triStart; i < triEnd; i++) {
      const { x, y } = triangleXY(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      any = true;
    }
  }

  if (!any) return null;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * Assign a centroid to one of the four lip corners. Centroids on the
 * exact centerline tie to the right/back side — deterministic regardless
 * of float drift, and good enough since the lip never has triangles
 * whose centroid is exactly at the bin center.
 *
 * Front = lower Y (the bin face oriented toward the camera in the
 * preview), Right = higher X.
 */
export function classifyLipCorner(
  centroidX: number,
  centroidY: number,
  cx: number,
  cy: number
): LipCorner {
  const right = centroidX >= cx;
  const back = centroidY >= cy;
  if (back) return right ? 'backRight' : 'backLeft';
  return right ? 'frontRight' : 'frontLeft';
}
