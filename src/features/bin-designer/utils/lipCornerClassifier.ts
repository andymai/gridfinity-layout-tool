/**
 * Lip color classification: maps a lip triangle to a grid cell
 * (XY corner quadrant × Z height band). Both the 3MF exporter (flat-vertex
 * STL) and the 3D preview (indexed BufferGeometry) supply a `triangleXYZ`
 * callback so this module stays geometry-format-agnostic.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { collapseLipCell } from '../types/featureColors';
import type { LipCorner, LipBand, LipAxisCount, LipCellZone } from '../types/featureColors';

/** Lip footprint geometry needed to classify a triangle into a grid cell. */
export interface LipGeom {
  readonly cx: number;
  readonly cy: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Compute the lip footprint's center and Z extent from LIP triangle
 * *centroids* (not vertices). Centroids keep a triangle that straddles an
 * axis from shifting the split, so the quadrants stay symmetric for
 * rectangular bins and the band range hugs the actual lip skirt. Returns
 * null when no lip exists.
 */
export function computeLipGeom(
  faceGroups: readonly FaceGroupData[],
  triangleXYZ: (triangleIndex: number) => { x: number; y: number; z: number }
): LipGeom | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let any = false;

  for (const g of faceGroups) {
    if (g.tag !== FeatureTag.LIP) continue;
    const triStart = g.start / 3;
    const triEnd = triStart + g.count / 3;
    for (let i = triStart; i < triEnd; i++) {
      const { x, y, z } = triangleXYZ(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      any = true;
    }
  }

  if (!any) return null;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minZ, maxZ };
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

/**
 * Band index for a centroid Z within [minZ, maxZ], split into `bands` equal
 * slices (0 = bottom). Clamps at the top so a centroid exactly at maxZ lands
 * in the last band rather than overflowing.
 */
export function classifyLipBand(
  centroidZ: number,
  minZ: number,
  maxZ: number,
  bands: LipAxisCount
): LipBand {
  if (bands <= 1 || maxZ <= minZ) return 0;
  const t = (centroidZ - minZ) / (maxZ - minZ);
  const idx = Math.floor(t * bands);
  const clamped = idx < 0 ? 0 : idx > bands - 1 ? bands - 1 : idx;
  return clamped as LipBand;
}

/**
 * Classify a lip triangle centroid into the canonical grid cell for the
 * active corner/band counts. The single source of truth shared by the
 * splitter, preview, exporter, and hit-test resolver.
 */
export function classifyLipCell(
  x: number,
  y: number,
  z: number,
  geom: LipGeom,
  counts: { corners: LipAxisCount; bands: LipAxisCount }
): LipCellZone {
  const corner = classifyLipCorner(x, y, geom.cx, geom.cy);
  const band = classifyLipBand(z, geom.minZ, geom.maxZ, counts.bands);
  return collapseLipCell(corner, band, counts);
}
