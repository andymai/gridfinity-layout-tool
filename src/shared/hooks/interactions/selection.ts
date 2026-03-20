import type { Bin, GridUnits, Rect } from '@/core/types';
import { clamp } from '@/shared/utils/validation';

/**
 * Calculate the bounding box of multiple bins.
 * Returns the smallest rectangle that contains all bins.
 */
export function getSelectionBounds(bins: Bin[]): Rect {
  if (bins.length === 0) {
    return { x: 0 as GridUnits, y: 0 as GridUnits, width: 0 as GridUnits, depth: 0 as GridUnits };
  }

  const minX = Math.min(...bins.map((b) => b.x)) as GridUnits;
  const minY = Math.min(...bins.map((b) => b.y)) as GridUnits;
  const maxX = Math.max(...bins.map((b) => b.x + b.width)) as GridUnits;
  const maxY = Math.max(...bins.map((b) => b.y + b.depth)) as GridUnits;

  return {
    x: minX,
    y: minY,
    width: (maxX - minX) as GridUnits,
    depth: (maxY - minY) as GridUnits,
  };
}

/**
 * Calculate a group-constrained delta that keeps the entire selection within grid bounds.
 * Instead of clamping each bin individually (which destroys relative positions),
 * this computes a single delta that can be applied uniformly to all bins.
 *
 * @param bins - Array of bins being moved
 * @param rawDeltaX - Unconstrained X movement
 * @param rawDeltaY - Unconstrained Y movement
 * @param drawer - Drawer dimensions for bounds checking
 * @returns Constrained delta that keeps all bins within bounds
 */
export function constrainGroupDelta(
  bins: Bin[],
  rawDeltaX: number,
  rawDeltaY: number,
  drawer: { width: number; depth: number }
): { deltaX: number; deltaY: number } {
  if (bins.length === 0) {
    return { deltaX: 0, deltaY: 0 };
  }

  const bounds = getSelectionBounds(bins);

  // Calculate maximum movement in each direction that keeps group in bounds
  const maxDeltaRight = drawer.width - (bounds.x + bounds.width);
  const maxDeltaLeft = -(bounds.x as number);
  const maxDeltaUp = drawer.depth - (bounds.y + bounds.depth);
  const maxDeltaDown = -(bounds.y as number);

  return {
    deltaX: clamp(rawDeltaX, maxDeltaLeft, maxDeltaRight),
    deltaY: clamp(rawDeltaY, maxDeltaDown, maxDeltaUp),
  };
}

/**
 * Apply a uniform delta to all bins and return their new positions.
 * This preserves the relative arrangement of bins.
 *
 * @param bins - Array of bins being moved
 * @param deltaX - X movement to apply
 * @param deltaY - Y movement to apply
 * @returns Map of bin IDs to their new positions
 */
export function applyGroupDelta(
  bins: Bin[],
  deltaX: number,
  deltaY: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  for (const bin of bins) {
    positions.set(bin.id, {
      x: bin.x + deltaX,
      y: bin.y + deltaY,
    });
  }

  return positions;
}
