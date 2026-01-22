import { useMemo } from 'react';
import type { Drawer } from '@/core/types';

/**
 * Grid Axis Labels Hook
 *
 * Pure computation of axis label arrays and sizing for the grid.
 * Handles both integer and fractional (half-bin) dimensions.
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface GridAxisLabelsState {
  /** Row labels (1-indexed, reversed for visual display, includes fractional edge) */
  rowLabels: (number | string)[];
  /** Column labels (1-indexed, includes fractional edge) */
  columnLabels: (number | string)[];
  /** Width of row label column in pixels */
  labelWidth: number;
  /** Height of column label row in pixels */
  columnLabelHeight: number;
  /** Font size for labels (0 when cells too small to show text) */
  labelFontSize: number;
  /** Whether axis labels should be visible (based on zoom level) */
  axisLabelsVisible: boolean;
  /** Whether drawer has fractional width (e.g., 10.5) */
  hasFractionalWidth: boolean;
  /** Whether drawer has fractional depth (e.g., 8.5) */
  hasFractionalDepth: boolean;
  /** Position of fractional edge on X axis ('start' = left, 'end' = right) */
  fractionalEdgeX: 'start' | 'end';
  /** Position of fractional edge on Y axis ('start' = bottom, 'end' = top) */
  fractionalEdgeY: 'start' | 'end';
  /** Number of integer width units */
  integerWidth: number;
  /** Number of integer depth units */
  integerDepth: number;
}

export interface UseGridAxisLabelsOptions {
  /** Drawer dimensions */
  drawer: Drawer;
  /** Current zoom level */
  zoom: number;
  /** Cell size in pixels (already scaled by zoom) */
  cellSize: number;
}

export function useGridAxisLabels(options: UseGridAxisLabelsOptions): GridAxisLabelsState {
  const { drawer, zoom, cellSize } = options;

  return useMemo(() => {
    // Label sizing - must match cellSize for alignment, hide when too small
    const labelWidth = Math.max(16, Math.round(20 * zoom));
    const columnLabelHeight = Math.max(16, Math.round(20 * zoom));
    const labelFontSize = cellSize < 14 ? 0 : Math.max(8, Math.round(10 * zoom));
    const axisLabelsVisible = cellSize >= 12;

    // Fractional edge positions
    const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
    const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';

    // Integer and fractional parts
    const integerWidth = Math.floor(drawer.width);
    const integerDepth = Math.floor(drawer.depth);
    const hasFractionalWidth = drawer.width % 1 !== 0;
    const hasFractionalDepth = drawer.depth % 1 !== 0;

    // Generate column labels (1-indexed, displayed at bottom)
    // Include fractional edge label when drawer has fractional width
    // Position depends on fractionalEdgeX setting ('start' = left, 'end' = right)
    const columnLabels: (number | string)[] = Array.from({ length: integerWidth }, (_, i) => i + 1);
    if (hasFractionalWidth) {
      if (fractionalEdgeX === 'start') {
        columnLabels.unshift('+.5'); // Fractional at left
      } else {
        columnLabels.push('+.5'); // Fractional at right (default)
      }
    }

    // Generate row labels (1-indexed, displayed on left)
    // Visual row at top = highest Y coordinate (drawer.depth)
    // Bottom row = Y coordinate 1
    // Include fractional edge label when drawer has fractional depth
    // Position depends on fractionalEdgeY setting ('start' = bottom, 'end' = top)
    const rowLabels: (number | string)[] = Array.from(
      { length: integerDepth },
      (_, i) => integerDepth - i
    );
    if (hasFractionalDepth) {
      if (fractionalEdgeY === 'end') {
        rowLabels.unshift('+.5'); // Fractional at top (CSS row 1)
      } else {
        rowLabels.push('+.5'); // Fractional at bottom
      }
    }

    return {
      rowLabels,
      columnLabels,
      labelWidth,
      columnLabelHeight,
      labelFontSize,
      axisLabelsVisible,
      hasFractionalWidth,
      hasFractionalDepth,
      fractionalEdgeX,
      fractionalEdgeY,
      integerWidth,
      integerDepth,
    };
  }, [drawer.width, drawer.depth, drawer.fractionalEdgeX, drawer.fractionalEdgeY, zoom, cellSize]);
}
