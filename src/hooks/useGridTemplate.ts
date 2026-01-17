import { useMemo } from 'react';
import type { Drawer } from '../types';

/**
 * Grid Template Hook
 *
 * Computes CSS Grid template strings for drawer layouts with fractional (half-bin) support.
 * Centralizes the grid template calculation logic used across multiple components:
 * - GridCanvas.tsx
 * - PrintLayout.tsx
 * - Staging.tsx
 *
 * @example
 * ```tsx
 * const { gridTemplateColumns, gridTemplateRows } = useGridTemplate({
 *   drawer,
 *   cellSize: 32,
 *   gap: 4,
 * });
 *
 * <div style={{ display: 'grid', gridTemplateColumns, gridTemplateRows, gap }}>
 *   {cells}
 * </div>
 * ```
 */

export interface GridTemplateState {
  /** CSS gridTemplateColumns value */
  gridTemplateColumns: string;
  /** CSS gridTemplateRows value */
  gridTemplateRows: string;

  // Fractional metadata (useful for cell positioning)
  /** Number of integer width units */
  integerWidth: number;
  /** Number of integer depth units */
  integerDepth: number;
  /** Whether drawer has fractional width (e.g., 10.5) */
  hasFractionalWidth: boolean;
  /** Whether drawer has fractional depth (e.g., 8.5) */
  hasFractionalDepth: boolean;
  /** Position of fractional edge on X axis ('start' = left, 'end' = right) */
  fractionalEdgeX: 'start' | 'end';
  /** Position of fractional edge on Y axis ('start' = bottom, 'end' = top) */
  fractionalEdgeY: 'start' | 'end';
  /** Fractional column width in pixels (0 if no fractional width) */
  fractionalCellWidth: number;
  /** Fractional row height in pixels (0 if no fractional depth) */
  fractionalCellHeight: number;

  // Grid dimensions
  /** Total columns in CSS grid (including fractional) */
  gridCols: number;
  /** Total rows in CSS grid (including fractional) */
  gridRows: number;

  // Cell positioning helpers
  /**
   * Get CSS column for an integer cell index (0-indexed x coordinate)
   * Accounts for fractional column at start if present
   */
  getCssColForCell: (x: number) => number;
  /**
   * Get CSS row for an integer cell index (0-indexed y coordinate, y=0 is bottom)
   * Accounts for fractional row at top/bottom if present
   */
  getCssRowForCell: (y: number) => number;
}

export interface UseGridTemplateOptions {
  /** Drawer dimensions */
  drawer: Drawer;
  /** Cell size in pixels (already scaled by zoom if applicable) */
  cellSize: number;
  /** Gap between cells in pixels */
  gap: number;
}

export function useGridTemplate(options: UseGridTemplateOptions): GridTemplateState {
  const { drawer, cellSize, gap } = options;

  return useMemo(() => {
    // Integer and fractional parts
    const integerWidth = Math.floor(drawer.width);
    const integerDepth = Math.floor(drawer.depth);
    const hasFractionalWidth = drawer.width % 1 !== 0;
    const hasFractionalDepth = drawer.depth % 1 !== 0;

    // Fractional edge positions (defaults to 'end')
    const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
    const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';

    // Total grid dimensions
    const gridCols = Math.ceil(drawer.width);
    const gridRows = Math.ceil(drawer.depth);

    // Fractional cell dimensions (accounting for gap)
    const fractionalWidthPart = drawer.width - integerWidth;
    const fractionalDepthPart = drawer.depth - integerDepth;
    const fractionalCellWidth = hasFractionalWidth
      ? fractionalWidthPart * (cellSize + gap) - gap
      : 0;
    const fractionalCellHeight = hasFractionalDepth
      ? fractionalDepthPart * (cellSize + gap) - gap
      : 0;

    // Generate CSS grid template for columns
    const gridTemplateColumns = hasFractionalWidth
      ? fractionalEdgeX === 'start'
        ? `${fractionalCellWidth}px repeat(${integerWidth}, ${cellSize}px)` // Fractional at left
        : `repeat(${integerWidth}, ${cellSize}px) ${fractionalCellWidth}px` // Fractional at right
      : `repeat(${gridCols}, ${cellSize}px)`;

    // Generate CSS grid template for rows
    // Note: CSS grid row 1 is at top, but our coordinate system has y=0 at bottom
    const gridTemplateRows = hasFractionalDepth
      ? fractionalEdgeY === 'end'
        ? `${fractionalCellHeight}px repeat(${integerDepth}, ${cellSize}px)` // Fractional at top (CSS row 1)
        : `repeat(${integerDepth}, ${cellSize}px) ${fractionalCellHeight}px` // Fractional at bottom (CSS row last)
      : `repeat(${gridRows}, ${cellSize}px)`;

    // Helper: Get CSS column for integer cell index x (0-indexed)
    const getCssColForCell = (x: number): number => {
      if (hasFractionalWidth && fractionalEdgeX === 'start') {
        return x + 2; // +1 for 1-indexed, +1 to skip fractional col at start
      }
      return x + 1; // +1 for 1-indexed CSS grid
    };

    // Helper: Get CSS row for integer cell index y (0-indexed, y=0 is bottom)
    const getCssRowForCell = (y: number): number => {
      if (hasFractionalDepth) {
        if (fractionalEdgeY === 'start') {
          // Fractional row at bottom (CSS row = gridRows), integer rows above
          return integerDepth - y;
        } else {
          // Fractional row at top (CSS row = 1), integer rows below
          return integerDepth - y + 1;
        }
      }
      // No fractional depth: simple reversal (y=0 bottom -> CSS row = integerDepth)
      return integerDepth - y;
    };

    return {
      gridTemplateColumns,
      gridTemplateRows,
      integerWidth,
      integerDepth,
      hasFractionalWidth,
      hasFractionalDepth,
      fractionalEdgeX,
      fractionalEdgeY,
      fractionalCellWidth,
      fractionalCellHeight,
      gridCols,
      gridRows,
      getCssColForCell,
      getCssRowForCell,
    };
  }, [
    drawer.width,
    drawer.depth,
    drawer.fractionalEdgeX,
    drawer.fractionalEdgeY,
    cellSize,
    gap,
  ]);
}
