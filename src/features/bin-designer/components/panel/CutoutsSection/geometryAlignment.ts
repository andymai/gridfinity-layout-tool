/**
 * Alignment guides + multi-cutout layout helpers.
 *
 * `findAlignmentGuides` powers the dotted snap-line overlay during
 * drag/resize. `distribute*` and `centerInBin` are the discrete
 * "align/distribute" toolbar actions — each returns a positions-only
 * patch map so callers can apply via `updateCutoutsBatch`.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { type Bounds, computeBounds, getEffectiveBounds, getEffectiveDepth } from './geometryCore';

/** A guide line indicating alignment between cutouts */
export interface AlignmentGuide {
  /** Whether this is a horizontal (Y-axis) or vertical (X-axis) guide */
  readonly axis: 'x' | 'y';
  /** Position of the guide line in mm */
  readonly position: number;
}

/** Snap threshold in mm — within this range, cutout snaps to guide */
export const GUIDE_SNAP_THRESHOLD = 1;

/**
 * Find alignment guides between the moving cutouts and stationary cutouts.
 * Checks edges (min/max) and centers of each axis.
 */
export function findAlignmentGuides(
  movingBounds: Bounds,
  stationaryCutouts: readonly Cutout[],
  threshold: number = GUIDE_SNAP_THRESHOLD
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];

  // Key positions of the moving cutout(s)
  const movingCenterX = (movingBounds.minX + movingBounds.maxX) / 2;
  const movingCenterY = (movingBounds.minY + movingBounds.maxY) / 2;
  const movingXPositions = [movingBounds.minX, movingCenterX, movingBounds.maxX];
  const movingYPositions = [movingBounds.minY, movingCenterY, movingBounds.maxY];

  for (const cutout of stationaryCutouts) {
    const b = getEffectiveBounds(cutout);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const xPositions = [b.minX, cx, b.maxX];
    const yPositions = [b.minY, cy, b.maxY];

    // Check X alignment (vertical guide lines)
    for (const mx of movingXPositions) {
      for (const sx of xPositions) {
        if (Math.abs(mx - sx) < threshold) {
          guides.push({ axis: 'x', position: sx });
        }
      }
    }

    // Check Y alignment (horizontal guide lines)
    for (const my of movingYPositions) {
      for (const sy of yPositions) {
        if (Math.abs(my - sy) < threshold) {
          guides.push({ axis: 'y', position: sy });
        }
      }
    }
  }

  // Deduplicate guides at same position
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.axis}:${g.position.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Distribute cutouts evenly along the horizontal axis.
 * Spaces cutouts so there's equal gap between each.
 */
export function distributeHorizontally(
  cutouts: readonly Cutout[],
  _binWidth: number
): Record<string, { x: number }> {
  if (cutouts.length < 3) return {};

  // Sort by current X position
  const sorted = [...cutouts].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Total space between leftmost left edge and rightmost right edge
  const totalSpan = last.x + last.width - first.x;
  const totalWidths = sorted.reduce((sum, c) => sum + c.width, 0);
  const gap = (totalSpan - totalWidths) / (sorted.length - 1);

  const result: Record<string, { x: number }> = {};
  let currentX = first.x;
  for (const cutout of sorted) {
    result[cutout.id] = { x: currentX };
    currentX += cutout.width + gap;
  }
  return result;
}

/**
 * Distribute cutouts evenly along the vertical axis.
 */
export function distributeVertically(
  cutouts: readonly Cutout[],
  _binDepth: number
): Record<string, { y: number }> {
  if (cutouts.length < 3) return {};

  const sorted = [...cutouts].sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = last.y + getEffectiveDepth(last) - first.y;
  const totalDepths = sorted.reduce((sum, c) => sum + getEffectiveDepth(c), 0);
  const gap = (totalSpan - totalDepths) / (sorted.length - 1);

  const result: Record<string, { y: number }> = {};
  let currentY = first.y;
  for (const cutout of sorted) {
    result[cutout.id] = { y: currentY };
    currentY += getEffectiveDepth(cutout) + gap;
  }
  return result;
}

/**
 * Center a group of cutouts within the bin.
 */
export function centerInBin(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number
): Record<string, { x: number; y: number }> {
  if (cutouts.length === 0) return {};

  const bounds = computeBounds(cutouts);
  const groupW = bounds.maxX - bounds.minX;
  const groupH = bounds.maxY - bounds.minY;
  const dx = (binWidth - groupW) / 2 - bounds.minX;
  const dy = (binDepth - groupH) / 2 - bounds.minY;

  const result: Record<string, { x: number; y: number }> = {};
  for (const cutout of cutouts) {
    result[cutout.id] = { x: cutout.x + dx, y: cutout.y + dy };
  }
  return result;
}
