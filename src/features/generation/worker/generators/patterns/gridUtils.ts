/**
 * Shared grid calculation utilities for wall patterns.
 *
 * Provides common staggered grid logic used by multiple pattern types.
 * Pure math module — no brepjs imports.
 */

import type { PatternCenter } from './types';

/**
 * Configuration for staggered grid generation.
 */
export interface StaggeredGridConfig {
  /** Maximum X extent from center (pattern elements stay within ±maxX) */
  readonly maxX: number;
  /** Maximum Y extent from center (pattern elements stay within ±maxY) */
  readonly maxY: number;
  /** Horizontal spacing between column centers */
  readonly colSpacing: number;
  /** Vertical spacing between row centers */
  readonly rowSpacing: number;
}

/**
 * Calculate center positions for a staggered grid pattern.
 *
 * Creates a honeycomb-style staggered layout where odd rows are offset
 * horizontally by half the column spacing. This provides optimal packing
 * and structural integrity for wall patterns.
 *
 * Both axes are strictly bounded — no element center exceeds ±maxX or ±maxY.
 *
 * @param config Grid configuration with bounds and spacing
 * @returns Array of center positions, or empty array if bounds are invalid
 */
export function calculateStaggeredGrid(config: StaggeredGridConfig): PatternCenter[] {
  const { maxX, maxY, colSpacing, rowSpacing } = config;

  // Validate inputs to prevent division by zero or infinite loops
  if (maxX < 0 || maxY < 0 || colSpacing <= 0 || rowSpacing <= 0) {
    return [];
  }

  const centers: PatternCenter[] = [];

  const startRow = Math.floor(-maxY / rowSpacing);
  const endRow = Math.ceil(maxY / rowSpacing);

  for (let row = startRow; row <= endRow; row++) {
    const y = row * rowSpacing;
    if (Math.abs(y) > maxY) continue;

    // Stagger odd rows horizontally (honeycomb pattern)
    const xOffset = (row & 1) === 1 ? colSpacing / 2 : 0;

    const startCol = Math.ceil((-maxX - xOffset) / colSpacing);
    const endCol = Math.floor((maxX - xOffset) / colSpacing);

    for (let col = startCol; col <= endCol; col++) {
      const x = col * colSpacing + xOffset;
      centers.push({ x, y });
    }
  }

  return centers;
}
