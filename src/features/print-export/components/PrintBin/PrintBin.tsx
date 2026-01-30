import type { Bin, Category, Drawer } from '@/core/types';
import type { PrintViewSettings } from '@/core/store/settings';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { usePrintBinLayout, getPrintTextColors } from '../printBinLayout';

interface PrintBinProps {
  bin: Bin;
  category: Category | undefined;
  drawer: Drawer;
  cellSize: number;
  gap: number;
  settings: PrintViewSettings;
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
export function PrintBin({ bin, category, drawer, cellSize, gap, settings }: PrintBinProps) {
  const color = settings.showCategoryColor
    ? (category?.color ?? DEFAULT_CATEGORY_COLOR)
    : '#e5e7eb'; // Light gray when color disabled
  const textColors = getPrintTextColors(color);

  // Use extracted layout calculation
  const layout = usePrintBinLayout(bin, drawer, cellSize, gap);
  const {
    gridCol,
    colSpan,
    gridRow,
    rowSpan,
    pixelWidth,
    pixelHeight,
    offsetX,
    offsetY,
    needsCustomSizing,
  } = layout;

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
  const primaryText = showLabel && bin.label ? bin.label : showSize ? dimensionsText : null;
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
