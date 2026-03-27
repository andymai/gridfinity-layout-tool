import type { GridUnits } from '@/core/types';
import { calcFractionalPixelSize } from '@/features/grid-editor/utils/fractionalPixels';
import { formatDimension } from '@/shared/utils';

export interface BinLayoutInput {
  /** Bin position x in grid units */
  binX: GridUnits;
  /** Bin position y in grid units */
  binY: GridUnits;
  /** Bin width in grid units */
  binWidth: GridUnits;
  /** Bin depth in grid units */
  binDepth: GridUnits;
  /** Drawer width in grid units */
  drawerWidth: GridUnits;
  /** Drawer depth in grid units */
  drawerDepth: GridUnits;
  /** Fractional edge X placement */
  fractionalEdgeX?: 'start' | 'end';
  /** Fractional edge Y placement */
  fractionalEdgeY?: 'start' | 'end';
  /** Cell size in pixels */
  cellSize: number;
  /** Gap between cells in pixels */
  gap: number;
}

export interface BinLayoutResult {
  dimensionsText: string;
  gridCol: number;
  gridColSpan: number;
  gridRowStart: number;
  gridRowSpan: number;
  binPixelWidth: number;
  binPixelHeight: number;
  binPixelMin: number;
  needsCustomSizing: boolean;
  offsetX: number;
  offsetY: number;
}

/**
 * Pure function that calculates all grid positioning and pixel sizing for a bin.
 * Handles fractional drawer dimensions and fractional bin positions.
 */
export function calculateBinLayout(input: BinLayoutInput): BinLayoutResult {
  const { binX, binY, binWidth, binDepth, drawerWidth, drawerDepth, cellSize, gap } = input;
  const fractionalEdgeX = input.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = input.fractionalEdgeY ?? 'end';

  const dimensionsText = `${formatDimension(binWidth)}×${formatDimension(binDepth)}`;

  // Calculate grid position (always use standard grid, no scaling)
  const hasFractionalX = binX % 1 !== 0;
  const hasFractionalY = binY % 1 !== 0;
  const hasFractionalWidth = binWidth % 1 !== 0;
  const hasFractionalDepth = binDepth % 1 !== 0;
  const hasFractionalDims =
    hasFractionalX || hasFractionalY || hasFractionalWidth || hasFractionalDepth;

  // CSS Grid positioning with configurable fractional edge placement
  const integerWidth = Math.floor(drawerWidth);
  const integerDepth = Math.floor(drawerDepth);
  const hasFractionalDrawerWidth = drawerWidth % 1 !== 0;
  const hasFractionalDrawerDepth = drawerDepth % 1 !== 0;
  const fractionalWidthPart = drawerWidth - integerWidth;
  const fractionalDepthPart = drawerDepth - integerDepth;
  const gridRows = Math.ceil(drawerDepth);

  // Helper: Get CSS column for a grid x coordinate
  const getCssColForX = (x: number): number => {
    if (hasFractionalDrawerWidth && fractionalEdgeX === 'start') {
      if (x < fractionalWidthPart) return 1;
      return Math.floor(x - fractionalWidthPart) + 2;
    }
    return Math.floor(x) + 1;
  };

  // Helper: Get CSS row for a grid y coordinate (y=0 at bottom, CSS row 1 at top)
  const getCssRowForY = (y: number): number => {
    if (hasFractionalDrawerDepth) {
      if (fractionalEdgeY === 'start') {
        if (y < fractionalDepthPart) return gridRows;
        return integerDepth - Math.floor(y - fractionalDepthPart);
      } else {
        if (y >= integerDepth) return 1;
        return integerDepth - Math.floor(y) + 1;
      }
    }
    return integerDepth - Math.floor(y);
  };

  // Calculate CSS column placement
  const binEndX = binX + binWidth;
  const startCol = getCssColForX(binX);
  const endCol = getCssColForX(binEndX > 0 ? binEndX - 0.001 : binEndX);
  const gridCol = startCol;
  const gridColSpan = Math.max(1, endCol - startCol + 1);

  // Calculate CSS row placement
  const binEndY = binY + binDepth;
  const topRow = getCssRowForY(binEndY > 0 ? binEndY - 0.001 : binEndY);
  const bottomRow = getCssRowForY(binY);
  const gridRowStart = topRow;
  const gridRowSpan = Math.max(1, bottomRow - topRow + 1);

  // Calculate actual pixel dimensions using shared fractional pixel utility
  const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
  const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

  const binPixelWidth = calcFractionalPixelSize(binX, binWidth, {
    drawerDimension: drawerWidth,
    fractionalEdge: fractionalEdgeX,
    cellSize,
    gap,
  });

  const binPixelHeight = calcFractionalPixelSize(binY, binDepth, {
    drawerDimension: drawerDepth,
    fractionalEdge: fractionalEdgeY,
    cellSize,
    gap,
  });

  // Need custom sizing when drawer has fractional dimensions or bin has fractional coords
  const needsCustomSizing =
    hasFractionalDims || hasFractionalDrawerWidth || hasFractionalDrawerDepth;

  // Calculate pixel offset for fractional positions
  let offsetX = 0;
  let offsetY = 0;
  if (needsCustomSizing) {
    // X offset
    if (hasFractionalDrawerWidth && fractionalEdgeX === 'start') {
      if (binX < fractionalWidthPart) {
        offsetX = (binX / fractionalWidthPart) * fractionalCellWidth;
      } else {
        const integerX = binX - fractionalWidthPart;
        offsetX = (integerX - Math.floor(integerX)) * (cellSize + gap);
      }
    } else {
      offsetX = (binX - Math.floor(binX)) * (cellSize + gap);
    }

    // Y offset
    if (hasFractionalDrawerDepth && fractionalEdgeY === 'start') {
      if (binEndY <= fractionalDepthPart) {
        offsetY = ((fractionalDepthPart - binEndY) / fractionalDepthPart) * fractionalCellHeight;
      } else {
        const integerY = binEndY - fractionalDepthPart;
        offsetY = (Math.ceil(integerY) - integerY) * (cellSize + gap);
      }
    } else if (hasFractionalDrawerDepth && fractionalEdgeY === 'end') {
      if (binEndY > integerDepth) {
        const fractionalY = binEndY - integerDepth;
        offsetY =
          ((fractionalDepthPart - fractionalY) / fractionalDepthPart) * fractionalCellHeight;
      } else {
        offsetY = (Math.ceil(binEndY) - binEndY) * (cellSize + gap);
      }
    } else {
      offsetY = (Math.ceil(binEndY) - binEndY) * (cellSize + gap);
    }
  }

  return {
    dimensionsText,
    gridCol,
    gridColSpan,
    gridRowStart,
    gridRowSpan,
    binPixelWidth,
    binPixelHeight,
    binPixelMin: Math.min(binPixelWidth, binPixelHeight),
    needsCustomSizing,
    offsetX,
    offsetY,
  };
}
