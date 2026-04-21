/**
 * Polygon-mask containment checks for cutouts.
 *
 * The cutout editor accepts placements only where every mask cell the cutout
 * covers is filled. Wall-thickness offset between interior and outer grid
 * coords is ignored — it's <5% of a mask cell and this check is purely UX
 * (the generator silently clips out-of-polygon geometry regardless).
 */

import type { Cutout } from '@/features/bin-designer/types';
import { MASK_CELLS_PER_UNIT, type CellMask } from '@/shared/utils/cellMask';
import { getRotatedBounds } from './geometry';
import { getPathBounds } from './pathGeometry';

/** Tolerance for mask-cell boundary rounding (mm). */
const MASK_FIT_EPSILON = 0.01;

/**
 * Check whether an axis-aligned rectangle (in bin-interior mm) lies entirely
 * within the filled region of a cellMask polygon.
 *
 * Every mask cell the rect overlaps must be filled — straddling an unfilled
 * cell (a concave notch) is rejected.
 */
export function rectFitsInMask(
  mask: CellMask,
  xMm: number,
  yMm: number,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number
): boolean {
  const cellMm = gridUnitMm / MASK_CELLS_PER_UNIT;
  const colStart = Math.floor((xMm + MASK_FIT_EPSILON) / cellMm);
  const rowStart = Math.floor((yMm + MASK_FIT_EPSILON) / cellMm);
  const colEnd = Math.ceil((xMm + widthMm - MASK_FIT_EPSILON) / cellMm);
  const rowEnd = Math.ceil((yMm + depthMm - MASK_FIT_EPSILON) / cellMm);
  if (colStart < 0 || rowStart < 0 || colEnd > mask.cols || rowEnd > mask.rows) {
    return false;
  }
  for (let r = rowStart; r < rowEnd; r++) {
    for (let c = colStart; c < colEnd; c++) {
      if (mask.cells[r * mask.cols + c] !== 1) return false;
    }
  }
  return true;
}

/**
 * Check whether a cutout's effective AABB fits within the mask polygon.
 *
 * Uses `getRotatedBounds()` for rectangles/ellipses and `getPathBounds()` for
 * path cutouts — all shapes are validated via their axis-aligned bounding box
 * for consistency with the existing bin-bound clamping.
 */
export function cutoutFitsInMask(cutout: Cutout, mask: CellMask, gridUnitMm: number): boolean {
  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;
  if (cutout.shape === 'path' && cutout.path) {
    const b = getPathBounds(cutout.path);
    minX = b.minX;
    minY = b.minY;
    maxX = b.maxX;
    maxY = b.maxY;
  } else {
    const b = getRotatedBounds(cutout);
    minX = b.minX;
    minY = b.minY;
    maxX = b.maxX;
    maxY = b.maxY;
  }
  return rectFitsInMask(mask, minX, minY, maxX - minX, maxY - minY, gridUnitMm);
}
