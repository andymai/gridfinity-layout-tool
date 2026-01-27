/**
 * Print Bin Layout Calculations
 *
 * Extracted utility for computing CSS grid positioning and pixel sizing
 * for bins in the print view. Handles fractional drawer dimensions.
 */

import { useMemo } from 'react';
import type { Bin, Drawer } from '@/core/types';

const FLOAT_EPSILON = 0.001;

export interface PrintBinLayoutResult {
  gridCol: number;
  colSpan: number;
  gridRow: number;
  rowSpan: number;
  pixelWidth: number | undefined;
  pixelHeight: number | undefined;
  offsetX: number;
  offsetY: number;
  needsCustomSizing: boolean;
}

/**
 * Calculate print-friendly text colors based on background luminance.
 * Uses hardcoded colors instead of CSS variables for print compatibility.
 */
export function getPrintTextColors(hexColor: string): { primary: string; secondary: string } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5
    ? { primary: 'rgba(0, 0, 0, 0.85)', secondary: 'rgba(0, 0, 0, 0.6)' }
    : { primary: 'rgba(255, 255, 255, 0.95)', secondary: 'rgba(255, 255, 255, 0.75)' };
}

/**
 * Calculate CSS grid column for a grid x coordinate.
 */
function getCssCol(
  x: number,
  hasFractionalWidth: boolean,
  fractionalEdgeX: 'start' | 'end',
  fractionalWidthPart: number
): number {
  if (hasFractionalWidth && fractionalEdgeX === 'start') {
    if (x < fractionalWidthPart) return 1;
    return Math.floor(x - fractionalWidthPart) + 2;
  }
  return Math.floor(x) + 1;
}

/**
 * Calculate CSS grid row for a grid y coordinate.
 * Grid y=0 is bottom, CSS row 1 is top.
 */
function getCssRow(
  y: number,
  integerDepth: number,
  gridRows: number,
  hasFractionalDepth: boolean,
  fractionalEdgeY: 'start' | 'end',
  fractionalDepthPart: number
): number {
  if (hasFractionalDepth) {
    if (fractionalEdgeY === 'start') {
      if (y < fractionalDepthPart) return gridRows;
      return integerDepth - Math.floor(y - fractionalDepthPart);
    }
    if (y >= integerDepth) return 1;
    return integerDepth - Math.floor(y) + 1;
  }
  return integerDepth - Math.floor(y);
}

/**
 * Calculate pixel size for a dimension accounting for fractional edges.
 */
function calcPixelSize(
  position: number,
  size: number,
  integerDimension: number,
  fractionalPart: number,
  hasFractional: boolean,
  fractionalEdge: 'start' | 'end',
  cellSize: number,
  gap: number
): number | undefined {
  const hasFractionalPosition = position % 1 !== 0 || size % 1 !== 0;
  if (!hasFractionalPosition && !hasFractional) {
    return undefined;
  }

  const fractionalCellSize = fractionalPart * (cellSize + gap) - gap;
  const end = position + size;

  if (!hasFractional) {
    return size * cellSize + Math.max(0, size - 1) * gap;
  }

  if (fractionalEdge === 'start') {
    const inFractional = Math.max(0, Math.min(end, fractionalPart) - Math.max(position, 0));
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
  }

  const inInteger = Math.max(0, Math.min(end, integerDimension) - position);
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

/**
 * Calculate offset for fractional positioning within a cell.
 */
function calcOffset(
  position: number,
  size: number,
  integerDimension: number,
  fractionalPart: number,
  hasFractional: boolean,
  fractionalEdge: 'start' | 'end',
  cellSize: number,
  gap: number,
  isYAxis: boolean
): number {
  if (!hasFractional && position % 1 === 0) return 0;

  const fractionalCellSize = fractionalPart * (cellSize + gap) - gap;
  const end = position + size;

  if (isYAxis) {
    // Y offset is from top of cell
    if (hasFractional && fractionalEdge === 'start') {
      if (end <= fractionalPart) {
        return ((fractionalPart - end) / fractionalPart) * fractionalCellSize;
      }
      const integerY = end - fractionalPart;
      return (Math.ceil(integerY) - integerY) * (cellSize + gap);
    }
    if (hasFractional && fractionalEdge === 'end') {
      if (end > integerDimension) {
        const fractionalY = end - integerDimension;
        return ((fractionalPart - fractionalY) / fractionalPart) * fractionalCellSize;
      }
      return (Math.ceil(end) - end) * (cellSize + gap);
    }
    return (Math.ceil(end) - end) * (cellSize + gap);
  }

  // X offset
  if (hasFractional && fractionalEdge === 'start') {
    if (position < fractionalPart) {
      return (position / fractionalPart) * fractionalCellSize;
    }
    const integerX = position - fractionalPart;
    return (integerX - Math.floor(integerX)) * (cellSize + gap);
  }
  return (position - Math.floor(position)) * (cellSize + gap);
}

/**
 * Hook to calculate print bin layout.
 * Memoized to prevent recalculation on unrelated rerenders.
 */
export function usePrintBinLayout(
  bin: Bin,
  drawer: Drawer,
  cellSize: number,
  gap: number
): PrintBinLayoutResult {
  return useMemo(() => {
    const integerWidth = Math.floor(drawer.width);
    const integerDepth = Math.floor(drawer.depth);
    const hasFractionalWidth = drawer.width % 1 !== 0;
    const hasFractionalDepth = drawer.depth % 1 !== 0;
    const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
    const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';
    const fractionalWidthPart = drawer.width - integerWidth;
    const fractionalDepthPart = drawer.depth - integerDepth;
    const gridRows = Math.ceil(drawer.depth);

    const binEndX = bin.x + bin.width;
    const binEndY = bin.y + bin.depth;

    // CSS grid positioning
    const startCol = getCssCol(bin.x, hasFractionalWidth, fractionalEdgeX, fractionalWidthPart);
    const endCol = getCssCol(
      binEndX > 0 ? binEndX - 0.001 : binEndX,
      hasFractionalWidth,
      fractionalEdgeX,
      fractionalWidthPart
    );
    const topRow = getCssRow(
      binEndY > 0 ? binEndY - 0.001 : binEndY,
      integerDepth,
      gridRows,
      hasFractionalDepth,
      fractionalEdgeY,
      fractionalDepthPart
    );
    const bottomRow = getCssRow(
      bin.y,
      integerDepth,
      gridRows,
      hasFractionalDepth,
      fractionalEdgeY,
      fractionalDepthPart
    );

    const hasFractionalBin =
      bin.x % 1 !== 0 || bin.y % 1 !== 0 || bin.width % 1 !== 0 || bin.depth % 1 !== 0;
    const needsCustomSizing = hasFractionalBin || hasFractionalWidth || hasFractionalDepth;

    return {
      gridCol: startCol,
      colSpan: Math.max(1, endCol - startCol + 1),
      gridRow: topRow,
      rowSpan: Math.max(1, bottomRow - topRow + 1),
      pixelWidth: calcPixelSize(
        bin.x,
        bin.width,
        integerWidth,
        fractionalWidthPart,
        hasFractionalWidth,
        fractionalEdgeX,
        cellSize,
        gap
      ),
      pixelHeight: calcPixelSize(
        bin.y,
        bin.depth,
        integerDepth,
        fractionalDepthPart,
        hasFractionalDepth,
        fractionalEdgeY,
        cellSize,
        gap
      ),
      offsetX: needsCustomSizing
        ? calcOffset(
            bin.x,
            bin.width,
            integerWidth,
            fractionalWidthPart,
            hasFractionalWidth,
            fractionalEdgeX,
            cellSize,
            gap,
            false
          )
        : 0,
      offsetY: needsCustomSizing
        ? calcOffset(
            bin.y,
            bin.depth,
            integerDepth,
            fractionalDepthPart,
            hasFractionalDepth,
            fractionalEdgeY,
            cellSize,
            gap,
            true
          )
        : 0,
      needsCustomSizing,
    };
  }, [
    bin.x,
    bin.y,
    bin.width,
    bin.depth,
    drawer.width,
    drawer.depth,
    drawer.fractionalEdgeX,
    drawer.fractionalEdgeY,
    cellSize,
    gap,
  ]);
}
