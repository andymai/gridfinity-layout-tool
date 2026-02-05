/**
 * Geometry utilities for cutout positioning and bounds computation.
 */

import type { Cutout } from '@/features/bin-designer/types';

/** Axis-aligned bounding box */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Get the effective bounding box of a cutout, accounting for shape type.
 * Circles use diameter for both width and depth.
 */
export function getEffectiveBounds(cutout: Cutout): Bounds {
  if (cutout.shape === 'circle') {
    return {
      minX: cutout.x,
      minY: cutout.y,
      maxX: cutout.x + cutout.width,
      maxY: cutout.y + cutout.width,
    };
  }
  return {
    minX: cutout.x,
    minY: cutout.y,
    maxX: cutout.x + cutout.width,
    maxY: cutout.y + cutout.depth,
  };
}

/**
 * Compute the combined bounding box of multiple cutouts.
 */
export function computeBounds(cutouts: readonly Cutout[]): Bounds {
  if (cutouts.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cutout of cutouts) {
    const b = getEffectiveBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Clamp a cutout position to keep it within the bin interior.
 */
export function clampPosition(
  cutout: Cutout,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  const effectiveW = cutout.shape === 'circle' ? cutout.width : cutout.width;
  const effectiveD = cutout.shape === 'circle' ? cutout.width : cutout.depth;
  return {
    x: Math.max(0, Math.min(cutout.x, binWidth - effectiveW)),
    y: Math.max(0, Math.min(cutout.y, binDepth - effectiveD)),
  };
}

/**
 * Get the effective width of a cutout (diameter for circles).
 */
export function getEffectiveWidth(cutout: Cutout): number {
  return cutout.width;
}

/**
 * Get the effective depth of a cutout (diameter for circles).
 */
export function getEffectiveDepth(cutout: Cutout): number {
  return cutout.shape === 'circle' ? cutout.width : cutout.depth;
}
