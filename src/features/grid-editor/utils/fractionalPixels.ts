/**
 * Fractional Pixel Calculations
 *
 * Shared utility for computing pixel dimensions of grid elements that may
 * span both fractional and integer columns/rows. Used by Overlay.tsx (for
 * interaction previews) and Bin.tsx (for bin sizing).
 *
 * When a drawer has non-integer dimensions (e.g., 10.5 units wide), one
 * column/row is narrower than the others. Bins spanning the fractional
 * boundary need proportional pixel sizing.
 */

/**
 * Convert grid units to pixels, accounting for gaps between cells.
 * Standard calculation used throughout grid rendering.
 *
 * @param units - Size in grid units
 * @param cellSize - Cell size in pixels
 * @param gap - Gap between cells in pixels
 * @returns Pixel size
 */
export function toPixels(units: number, cellSize: number, gap: number): number {
  return units * cellSize + Math.max(0, units - 1) * gap;
}

/**
 * Epsilon for floating-point gap count calculation.
 * Prevents Math.floor from under-counting due to values like 1.9999999999.
 */
const FLOAT_EPSILON = 0.001;

export interface FractionalGridContext {
  /** Full drawer dimension in grid units (e.g., 10.5) */
  drawerDimension: number;
  /** Which edge the fractional column/row is on */
  fractionalEdge: 'start' | 'end';
  /** Cell size in pixels */
  cellSize: number;
  /** Gap between cells in pixels */
  gap: number;
}

/**
 * Calculate the pixel size of a region along one axis, accounting for
 * fractional edge columns/rows.
 *
 * @param position - Start position in grid units (x or y)
 * @param size - Size in grid units (width or depth)
 * @param ctx - Grid context (drawer dimension, edge, cell size, gap)
 * @returns Pixel size of the region
 */
export function calcFractionalPixelSize(
  position: number,
  size: number,
  ctx: FractionalGridContext
): number {
  const { drawerDimension, fractionalEdge, cellSize, gap } = ctx;
  const integerDimension = Math.floor(drawerDimension);
  const fractionalPart = drawerDimension - integerDimension;
  const hasFractional = fractionalPart > 0;

  // Standard case: no fractional dimension
  if (!hasFractional) {
    return size * cellSize + Math.max(0, size - 1) * gap;
  }

  const fractionalCellSize = fractionalPart * (cellSize + gap) - gap;
  const regionEnd = position + size;

  if (fractionalEdge === 'start') {
    // Fractional region at [0, fractionalPart)
    const inFractional = Math.max(0, Math.min(regionEnd, fractionalPart) - Math.max(position, 0));
    const inInteger = size - inFractional;

    let pixels = 0;
    if (inFractional > 0) {
      pixels += (inFractional / fractionalPart) * fractionalCellSize;
    }
    if (inInteger > 0) {
      if (inFractional > 0) pixels += gap;
      pixels += inInteger * cellSize + Math.max(0, Math.floor(inInteger + FLOAT_EPSILON) - 1) * gap;
    }
    return pixels;
  } else {
    // Fractional region at [integerDimension, drawerDimension)
    const inInteger = Math.max(0, Math.min(regionEnd, integerDimension) - position);
    const inFractional = size - inInteger;

    let pixels = 0;
    if (inInteger > 0) {
      pixels += inInteger * cellSize + Math.max(0, Math.floor(inInteger + FLOAT_EPSILON) - 1) * gap;
    }
    if (inFractional > 0) {
      if (inInteger > 0) pixels += gap;
      pixels += (inFractional / fractionalPart) * fractionalCellSize;
    }
    return pixels;
  }
}
