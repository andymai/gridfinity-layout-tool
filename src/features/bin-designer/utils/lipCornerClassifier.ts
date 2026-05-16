/**
 * Both the 3MF exporter (flat-vertex STL) and the 3D preview (indexed
 * BufferGeometry) supply a `triangleXY` callback so this module stays
 * geometry-format-agnostic.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { LipCorner } from '../types/featureColors';

/**
 * Compute the lip footprint's centerline by taking the outer XY bbox
 * of LIP triangle *centroids* (not vertices). A single triangle that
 * straddles the bin's center doesn't shift the split, which keeps the
 * four quadrants symmetric for rectangular bins. Returns null when no
 * lip exists.
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
 * Front = lower Y (camera-facing face in the preview); Right = higher X.
 * Centroids on the exact centerline tie to back/right — deterministic
 * regardless of float drift.
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
