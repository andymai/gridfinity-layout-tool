import type { Bin, Category, Drawer } from '../../types';
import type { PrintViewSettings } from '../../store/settings';
import { DEFAULT_CATEGORY_COLOR } from '../../constants';

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
  const integerDepth = Math.floor(drawer.depth);
  const gridCol = Math.floor(bin.x) + 1;
  const gridRow = integerDepth - Math.floor(bin.y + bin.depth) + 1;
  const colSpan = Math.ceil(bin.x + bin.width) - Math.floor(bin.x);
  const rowSpan = Math.ceil(bin.y + bin.depth) - Math.floor(bin.y);

  // Calculate pixel dimensions for fractional bins
  const hasFractional =
    bin.x % 1 !== 0 || bin.y % 1 !== 0 || bin.width % 1 !== 0 || bin.depth % 1 !== 0;
  const toPixels = (units: number) => units * cellSize + Math.max(0, units - 1) * gap;
  const pixelWidth = hasFractional ? toPixels(bin.width) : undefined;
  const pixelHeight = hasFractional ? toPixels(bin.depth) : undefined;

  // Calculate offsets for fractional positioning
  const fractionalX = bin.x - Math.floor(bin.x);
  const fractionalYFromTop = Math.ceil(bin.y + bin.depth) - (bin.y + bin.depth);
  const offsetX = hasFractional ? fractionalX * (cellSize + gap) : 0;
  const offsetY = hasFractional ? fractionalYFromTop * (cellSize + gap) : 0;

  // Determine what text to display
  const showLabel = settings.showLabel && bin.label;
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

  // Scale font based on bin size
  const baseFontSize = Math.max(7, Math.min(14, minDim / 4));
  const labelFontSize = baseFontSize;
  const sizeFontSize = baseFontSize * 0.8;
  const smallFontSize = baseFontSize * 0.65;

  // Hide text on very small bins
  const showText = minDim > 30;

  return (
    <div
      className="print-bin"
      style={{
        gridColumn: `${gridCol} / span ${colSpan}`,
        gridRow: `${gridRow} / span ${rowSpan}`,
        backgroundColor: color,
        ...(hasFractional
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
        <>
          {/* Label */}
          {showLabel && (
            <div
              className="print-bin-label"
              style={{
                color: textColors.primary,
                fontSize: `${labelFontSize}px`,
              }}
            >
              {bin.label}
            </div>
          )}

          {/* Size (width x depth) */}
          {showSize && (
            <div
              className="print-bin-size"
              style={{
                color: textColors.secondary,
                fontSize: `${sizeFontSize}px`,
              }}
            >
              {bin.width}x{bin.depth}
            </div>
          )}

          {/* Height */}
          {showHeight && (
            <div
              className="print-bin-height"
              style={{
                color: textColors.secondary,
                fontSize: `${smallFontSize}px`,
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
                fontSize: `${smallFontSize * 0.85}px`,
              }}
            >
              {formatCustomProperties(bin.customProperties)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
