import type { Bin, Category, Drawer } from '../../core/types';
import type { PrintViewSettings } from '../../core/store/settings';
import { DEFAULT_CATEGORY_COLOR } from '../../core/constants';

interface PrintBinProps {
  bin: Bin;
  category: Category | undefined;
  drawer: Drawer;
  cellSize: number;
  gap: number;
  settings: PrintViewSettings;
}

/**
 * Calculate print-friendly text colors based on background luminance.
 * Uses hardcoded colors instead of CSS variables for print compatibility.
 */
function getPrintTextColors(hexColor: string): { primary: string; secondary: string } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (luminance > 0.5) {
    return {
      primary: 'rgba(0, 0, 0, 0.85)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    };
  } else {
    return {
      primary: 'rgba(255, 255, 255, 0.95)',
      secondary: 'rgba(255, 255, 255, 0.75)',
    };
  }
}

/**
 * Format custom properties for display.
 * Returns a truncated comma-separated string.
 */
function formatCustomProperties(props: Record<string, string> | undefined): string {
  if (!props) return '';
  const entries = Object.entries(props).slice(0, 3); // Limit to 3 properties
  return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}

/**
 * Simplified bin component for print view.
 * Renders bin with configurable properties based on settings.
 */
export function PrintBin({
  bin,
  category,
  drawer,
  cellSize,
  gap,
  settings,
}: PrintBinProps) {
  const color = settings.showCategoryColor
    ? category?.color ?? DEFAULT_CATEGORY_COLOR
    : '#e5e7eb'; // Light gray when color disabled
  const textColors = getPrintTextColors(color);

  // Calculate grid position (CSS Grid is 1-indexed)
  // Grid y=0 is bottom, but CSS row 1 is top
  const integerWidth = Math.floor(drawer.width);
  const integerDepth = Math.floor(drawer.depth);
  const hasFractionalDrawerWidth = drawer.width % 1 !== 0;
  const hasFractionalDrawerDepth = drawer.depth % 1 !== 0;
  const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';
  const fractionalWidthPart = drawer.width - integerWidth;
  const fractionalDepthPart = drawer.depth - integerDepth;
  const gridRows = Math.ceil(drawer.depth);

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
  const binEndX = bin.x + bin.width;
  const startCol = getCssColForX(bin.x);
  const endCol = getCssColForX(binEndX > 0 ? binEndX - 0.001 : binEndX);
  const gridCol = startCol;
  const colSpan = Math.max(1, endCol - startCol + 1);

  // Calculate CSS row placement
  const binEndY = bin.y + bin.depth;
  const topRow = getCssRowForY(binEndY > 0 ? binEndY - 0.001 : binEndY);
  const bottomRow = getCssRowForY(bin.y);
  const gridRow = topRow;
  const rowSpan = Math.max(1, bottomRow - topRow + 1);

  // Calculate pixel dimensions accounting for fractional drawer cells
  const hasFractionalBin =
    bin.x % 1 !== 0 || bin.y % 1 !== 0 || bin.width % 1 !== 0 || bin.depth % 1 !== 0;
  const needsCustomSizing = hasFractionalBin || hasFractionalDrawerWidth || hasFractionalDrawerDepth;

  // Calculate fractional cell sizes in pixels
  const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
  const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

  // Calculate pixel width accounting for fractional edge
  let pixelWidth: number | undefined;
  if (!needsCustomSizing) {
    pixelWidth = undefined;
  } else if (!hasFractionalDrawerWidth) {
    pixelWidth = bin.width * cellSize + Math.max(0, bin.width - 1) * gap;
  } else if (fractionalEdgeX === 'start') {
    const inFractional = Math.max(0, Math.min(binEndX, fractionalWidthPart) - Math.max(bin.x, 0));
    const inInteger = bin.width - inFractional;
    let width = 0;
    if (inFractional > 0) {
      width += (inFractional / fractionalWidthPart) * fractionalCellWidth;
    }
    if (inInteger > 0) {
      if (inFractional > 0) width += gap;
      width += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
    }
    pixelWidth = width;
  } else {
    const inInteger = Math.max(0, Math.min(binEndX, integerWidth) - bin.x);
    const inFractional = bin.width - inInteger;
    let width = 0;
    if (inInteger > 0) {
      width += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
    }
    if (inFractional > 0) {
      if (inInteger > 0) width += gap;
      width += (inFractional / fractionalWidthPart) * fractionalCellWidth;
    }
    pixelWidth = width;
  }

  // Calculate pixel height accounting for fractional edge
  let pixelHeight: number | undefined;
  if (!needsCustomSizing) {
    pixelHeight = undefined;
  } else if (!hasFractionalDrawerDepth) {
    pixelHeight = bin.depth * cellSize + Math.max(0, bin.depth - 1) * gap;
  } else if (fractionalEdgeY === 'start') {
    const inFractional = Math.max(0, Math.min(binEndY, fractionalDepthPart) - Math.max(bin.y, 0));
    const inInteger = bin.depth - inFractional;
    let height = 0;
    if (inFractional > 0) {
      height += (inFractional / fractionalDepthPart) * fractionalCellHeight;
    }
    if (inInteger > 0) {
      if (inFractional > 0) height += gap;
      height += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
    }
    pixelHeight = height;
  } else {
    const inInteger = Math.max(0, Math.min(binEndY, integerDepth) - bin.y);
    const inFractional = bin.depth - inInteger;
    let height = 0;
    if (inInteger > 0) {
      height += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
    }
    if (inFractional > 0) {
      if (inInteger > 0) height += gap;
      height += (inFractional / fractionalDepthPart) * fractionalCellHeight;
    }
    pixelHeight = height;
  }

  // Calculate pixel offsets for fractional positioning within the cell
  let offsetX = 0;
  let offsetY = 0;
  if (needsCustomSizing) {
    // X offset
    if (hasFractionalDrawerWidth && fractionalEdgeX === 'start') {
      if (bin.x < fractionalWidthPart) {
        offsetX = (bin.x / fractionalWidthPart) * fractionalCellWidth;
      } else {
        const integerX = bin.x - fractionalWidthPart;
        offsetX = (integerX - Math.floor(integerX)) * (cellSize + gap);
      }
    } else {
      offsetX = (bin.x - Math.floor(bin.x)) * (cellSize + gap);
    }

    // Y offset (from top of cell)
    if (hasFractionalDrawerDepth && fractionalEdgeY === 'start') {
      if (binEndY <= fractionalDepthPart) {
        offsetY = (fractionalDepthPart - binEndY) / fractionalDepthPart * fractionalCellHeight;
      } else {
        const integerY = binEndY - fractionalDepthPart;
        offsetY = (Math.ceil(integerY) - integerY) * (cellSize + gap);
      }
    } else if (hasFractionalDrawerDepth && fractionalEdgeY === 'end') {
      if (binEndY > integerDepth) {
        const fractionalY = binEndY - integerDepth;
        offsetY = (fractionalDepthPart - fractionalY) / fractionalDepthPart * fractionalCellHeight;
      } else {
        offsetY = (Math.ceil(binEndY) - binEndY) * (cellSize + gap);
      }
    } else {
      offsetY = (Math.ceil(binEndY) - binEndY) * (cellSize + gap);
    }
  }

  // Determine what text to display based on settings
  const wantsLabel = settings.showLabel && bin.label;
  const showSize = settings.showSize;
  const showHeight = settings.showHeight;
  const showNotes = settings.showNotes && bin.notes;
  const showCustomProps =
    settings.showCustomProperties &&
    bin.customProperties &&
    Object.keys(bin.customProperties).length > 0;

  // Calculate bin pixel size for font scaling
  const binPixelWidth = pixelWidth ?? bin.width * cellSize + (bin.width - 1) * gap;
  const binPixelHeight = pixelHeight ?? bin.depth * cellSize + (bin.depth - 1) * gap;
  const minDim = Math.min(binPixelWidth, binPixelHeight);

  // Format dimensions - show decimal if fractional
  const formatDim = (val: number) => (val % 1 === 0 ? val.toString() : val.toFixed(1));
  const dimensionsText = `${formatDim(bin.width)}×${formatDim(bin.depth)}`;

  // Smart rotation: use taller dimension for text if significantly taller
  const shouldRotate = bin.depth > bin.width * 1.5;

  // Available width for text (conservative: 75% of bin width to account for padding)
  const rawAvailableWidth = shouldRotate ? binPixelHeight : binPixelWidth;
  const effectiveAvailableWidth = rawAvailableWidth * 0.75;

  // Font size calculations
  const minFontSize = 7;
  const maxFontSize = Math.max(7, Math.min(14, minDim * 0.28));

  // Calculate if label fits and at what font size
  let labelFits = false;
  let labelFontSize = maxFontSize;

  if (wantsLabel && bin.label) {
    const labelLength = bin.label.length;
    const neededFontSize = effectiveAvailableWidth / (labelLength * 0.6);

    if (neededFontSize >= minFontSize) {
      labelFits = true;
      labelFontSize = Math.max(minFontSize, Math.min(Math.floor(neededFontSize), maxFontSize));
    }
  }

  const primaryFontSize = labelFits ? labelFontSize : maxFontSize;
  const secondaryFontSize = Math.max(6, Math.min(Math.round(primaryFontSize * 0.75), 12));
  const smallFontSize = Math.max(5, Math.round(primaryFontSize * 0.65));

  // Visibility thresholds
  const rawAvailableHeight = shouldRotate ? binPixelWidth : binPixelHeight;
  const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

  // Show label if it fits, otherwise show dimensions as primary
  const showLabel = wantsLabel && labelFits;
  const primaryText = showLabel && bin.label ? bin.label : (showSize ? dimensionsText : null);
  const secondaryText = showLabel && showSize && hasSpaceForSecondary ? dimensionsText : null;

  // Hide text on very small bins
  const showText = minDim > 24;

  return (
    <div
      className="print-bin"
      style={{
        gridColumn: `${gridCol} / span ${colSpan}`,
        gridRow: `${gridRow} / span ${rowSpan}`,
        backgroundColor: color,
        ...(needsCustomSizing
          ? {
              width: pixelWidth,
              height: pixelHeight,
              marginLeft: offsetX,
              marginTop: offsetY,
            }
          : {}),
      }}
    >
      {showText && (
        <div
          className="print-bin-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: '2px',
            boxSizing: 'border-box',
            transform: shouldRotate ? 'rotate(-90deg)' : 'none',
            // When rotated, swap effective width/height for layout
            ...(shouldRotate
              ? {
                  width: binPixelHeight,
                  height: binPixelWidth,
                }
              : {}),
          }}
        >
          {/* Primary text (label if fits, otherwise dimensions) */}
          {primaryText && (
            <div
              className="print-bin-primary"
              style={{
                color: textColors.primary,
                fontSize: `${primaryFontSize}px`,
                fontWeight: showLabel ? 500 : 600,
                fontFamily: 'ui-monospace, monospace',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {primaryText}
            </div>
          )}

          {/* Secondary text (dimensions when label is primary) */}
          {secondaryText && (
            <div
              className="print-bin-secondary"
              style={{
                color: textColors.secondary,
                fontSize: `${secondaryFontSize}px`,
                fontFamily: 'ui-monospace, monospace',
                lineHeight: 1.2,
                marginTop: '1px',
              }}
            >
              {secondaryText}
            </div>
          )}

          {/* Height */}
          {showHeight && (
            <div
              className="print-bin-height"
              style={{
                color: textColors.secondary,
                fontSize: `${smallFontSize}px`,
                marginTop: '1px',
              }}
            >
              {bin.height}u
            </div>
          )}

          {/* Notes */}
          {showNotes && (
            <div
              className="print-bin-notes"
              style={{
                color: textColors.secondary,
                fontSize: `${smallFontSize}px`,
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
              title={bin.notes}
            >
              {bin.notes}
            </div>
          )}

          {/* Custom Properties */}
          {showCustomProps && (
            <div
              className="print-bin-custom-props"
              style={{
                color: textColors.secondary,
                fontSize: `${Math.round(smallFontSize * 0.85)}px`,
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {formatCustomProperties(bin.customProperties)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
