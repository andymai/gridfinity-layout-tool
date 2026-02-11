import { memo } from 'react';
import type { PackedBin } from '@/features/staging/utils/packing';
import { clamp, getBinTextColors } from '@/shared/utils';
import { useTranslation } from '@/i18n';

/** Format dimension for display - show decimal only if fractional */
const formatDim = (val: number): string => (val % 1 === 0 ? val.toString() : val.toFixed(1));

interface StagingBinProps {
  bin: PackedBin;
  categoryColor: string;
  isSelected: boolean;
  isDragging: boolean;
  isHovered: boolean;
  isTouchDevice: boolean;
  cellSize: number;
  gap: number;
  gridHeight: number;
  hasFractionalWidth: boolean;
  integerWidth: number;
  fractionalWidthPart: number;
  fractionalCellWidth: number;
  onBinClick: (binId: string, e: React.MouseEvent) => void;
  onBinPointerDown: (binId: string, e: React.PointerEvent) => void;
  onBinPointerMove: (e: React.PointerEvent) => void;
  onBinPointerEnd: () => void;
  onBinContextMenu: (binId: string, e: React.MouseEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onRotate: (binId: string) => void;
}

/**
 * Calculate pixel width for a bin accounting for fractional column widths.
 */
function calcBinPixelWidth(
  x: number,
  width: number,
  cellSize: number,
  gap: number,
  hasFractionalWidth: boolean,
  integerWidth: number,
  fractionalWidthPart: number,
  fractionalCellWidth: number
): number {
  if (!hasFractionalWidth) {
    return width * cellSize + Math.max(0, width - 1) * gap;
  }
  const binEndX = x + width;
  const inInteger = Math.max(0, Math.min(binEndX, integerWidth) - x);
  const inFractional = width - inInteger;
  let pixelWidth = 0;
  if (inInteger > 0) {
    pixelWidth += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
  }
  if (inFractional > 0) {
    if (inInteger > 0) pixelWidth += gap;
    pixelWidth += (inFractional / fractionalWidthPart) * fractionalCellWidth;
  }
  return pixelWidth;
}

/**
 * Calculate pixel height for a bin with fractional depth.
 * A 0.5 depth bin = 0.5 * cellSize (no gaps since it doesn't span multiple cells).
 * A 1.5 depth bin = 1 * cellSize + gap + 0.5 * cellSize.
 */
function calcBinPixelHeight(depth: number, cellSize: number, gap: number): number {
  const integerPart = Math.floor(depth);
  const fractionalPart = depth - integerPart;

  let height = 0;
  if (integerPart > 0) {
    height += integerPart * cellSize + (integerPart - 1) * gap;
  }
  if (fractionalPart > 0) {
    if (integerPart > 0) height += gap;
    height += fractionalPart * cellSize;
  }
  return height;
}

/**
 * A single bin rendered inside the staging area grid.
 * Includes adaptive label sizing that mirrors the main Grid/Bin.tsx approach.
 */
export const StagingBin = memo(function StagingBin({
  bin,
  categoryColor,
  isSelected,
  isDragging,
  isHovered,
  isTouchDevice,
  cellSize,
  gap,
  gridHeight,
  hasFractionalWidth,
  integerWidth,
  fractionalWidthPart,
  fractionalCellWidth,
  onBinClick,
  onBinPointerDown,
  onBinPointerMove,
  onBinPointerEnd,
  onBinContextMenu,
  onPointerEnter,
  onPointerLeave,
  onRotate,
}: StagingBinProps) {
  const t = useTranslation();
  const textColors = getBinTextColors(categoryColor);

  // Check if bin has fractional dimensions
  const hasFractionalBin = bin.width % 1 !== 0 || bin.depth % 1 !== 0;
  // Calculate CSS grid span (use ceiling for fractional bins)
  const gridColSpan = Math.ceil(bin.x + bin.width) - Math.floor(bin.x);
  const gridRowSpan = Math.ceil(bin.y + bin.depth) - Math.floor(bin.y);

  // Always calculate pixel dimensions for adaptive label sizing
  const actualBinPixelWidth =
    hasFractionalBin || hasFractionalWidth
      ? calcBinPixelWidth(
          bin.x,
          bin.width,
          cellSize,
          gap,
          hasFractionalWidth,
          integerWidth,
          fractionalWidthPart,
          fractionalCellWidth
        )
      : bin.width * cellSize + Math.max(0, bin.width - 1) * gap;
  const actualBinPixelHeight = hasFractionalBin
    ? calcBinPixelHeight(bin.depth, cellSize, gap)
    : bin.depth * cellSize + Math.max(0, bin.depth - 1) * gap;

  // Only override CSS grid sizing for fractional bins
  const cssWidthOverride = hasFractionalBin || hasFractionalWidth ? actualBinPixelWidth : undefined;
  const cssHeightOverride = hasFractionalBin ? actualBinPixelHeight : undefined;

  // Calculate grid row start (must be integer for valid CSS Grid)
  const gridRowStart = gridHeight - Math.ceil(bin.y + bin.depth) + 1;

  // ========== ADAPTIVE LABEL SYSTEM (matches Grid/Bin.tsx) ==========
  const dimensionsText = `${formatDim(bin.width)}×${formatDim(bin.depth)}`;
  const hasLabel = !!bin.label;

  // Smart rotation: use taller dimension for text if significantly taller
  const shouldRotate = bin.depth > bin.width * 1.5;

  // Font size constraints based on bin pixel size
  const binPixelMin = Math.min(actualBinPixelWidth, actualBinPixelHeight);
  const maxFontSize = clamp(Math.round(binPixelMin * 0.28), 9, 20);
  const minFontSize = 9;

  // Available width for text (75% of bin width to account for padding)
  const rawAvailableWidth = shouldRotate ? actualBinPixelHeight : actualBinPixelWidth;
  const effectiveAvailableWidth = rawAvailableWidth * 0.75;

  // Calculate if label fits and at what font size
  let labelFits = false;
  let labelFontSize = maxFontSize;

  if (hasLabel && bin.label) {
    const labelLength = bin.label.length;
    // textWidth = labelLength * fontSize * 0.6 (monospace assumption)
    const neededFontSize = effectiveAvailableWidth / (labelLength * 0.6);
    if (neededFontSize >= minFontSize) {
      labelFits = true;
      labelFontSize = clamp(Math.floor(neededFontSize), minFontSize, maxFontSize);
    }
  }

  // Calculate font sizes
  const primaryFontSize = labelFits ? labelFontSize : maxFontSize;
  const secondaryFontSize = clamp(Math.round(primaryFontSize * 0.75), 8, 14);

  // Visibility thresholds
  const showAnyText = binPixelMin >= 24;
  const rawAvailableHeight = shouldRotate ? actualBinPixelWidth : actualBinPixelHeight;
  const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

  // Show label if it fits, otherwise show dimensions
  const showLabel = hasLabel && labelFits;
  const primaryText = showLabel && bin.label ? bin.label : dimensionsText;
  const secondaryText = showLabel && hasSpaceForSecondary ? dimensionsText : null;

  // Letter-spacing for small text
  const letterSpacing = primaryFontSize < 11 ? '0.02em' : 'normal';

  // Elevate z-index when hovered/selected so rotate button appears above other bins
  const isElevated = isHovered || isSelected;

  return (
    <div
      data-staging-bin-id={bin.id}
      className={`relative flex flex-col items-center justify-center transition-all duration-150 cursor-move rounded-sm touch-none ${
        isElevated ? 'z-20' : 'z-10'
      } ${
        isDragging
          ? 'bg-transparent border-2 border-dashed border-accent pointer-events-none'
          : isSelected
            ? 'border border-[var(--border-on-color)] shadow-sm ring-2 ring-selection-ring'
            : 'border border-[var(--border-on-color)] shadow-sm'
      }`}
      style={{
        gridColumn: `${bin.x + 1} / span ${gridColSpan}`,
        gridRow: `${gridRowStart} / span ${gridRowSpan}`,
        // Align fractional-depth bins to bottom of their grid cell
        alignSelf: hasFractionalBin && bin.depth < 1 ? 'end' : undefined,
        ...(!isDragging && { backgroundColor: categoryColor }),
        // Override size for fractional bins
        ...(cssWidthOverride !== undefined && { width: cssWidthOverride }),
        ...(cssHeightOverride !== undefined && { height: cssHeightOverride }),
      }}
      onClick={(e) => onBinClick(bin.id, e)}
      onPointerDown={(e) => onBinPointerDown(bin.id, e)}
      onPointerMove={onBinPointerMove}
      onPointerUp={onBinPointerEnd}
      onPointerCancel={onBinPointerEnd}
      onContextMenu={(e) => onBinContextMenu(bin.id, e)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      title={t('staging.binTooltip', {
        label: bin.label || t('staging.unlabeled'),
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
      })}
    >
      {/* Adaptive label: primary (label or dimensions) + optional secondary */}
      {!isDragging && showAnyText && (
        <div
          className="text-center pointer-events-none select-none flex flex-col items-center justify-center px-1"
          style={{
            transform: shouldRotate ? 'rotate(-90deg)' : 'none',
            width: shouldRotate ? `${(bin.depth / bin.width) * 90}%` : 'auto',
          }}
        >
          {/* Primary text (label if set, otherwise dimensions) */}
          <div
            className="flex items-center justify-center gap-0.5 leading-tight whitespace-nowrap font-mono"
            style={{
              color: textColors.primary,
              fontSize: `${primaryFontSize}px`,
              fontWeight: showLabel ? 500 : 600,
              textShadow: `0 1px 2px ${textColors.shadow}`,
              letterSpacing,
            }}
          >
            {primaryText}
          </div>
          {/* Secondary text (dimensions when label is primary) */}
          {secondaryText && (
            <div
              className="leading-tight font-mono"
              style={{
                color: textColors.secondary,
                fontSize: `${secondaryFontSize}px`,
                fontWeight: 'normal',
                textShadow: `0 1px 1px ${textColors.shadow}`,
                marginTop: 1,
              }}
            >
              {secondaryText}
            </div>
          )}
        </div>
      )}

      {/* Rotate button - desktop only, visible on hover or selection */}
      {!isTouchDevice && !isDragging && (isHovered || isSelected) && (
        <div
          className="absolute transition-opacity duration-150"
          style={{
            right: -22,
            top: -22,
            width: 44,
            height: 44,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRotate(bin.id);
          }}
          title={t('staging.rotateBin')}
        >
          <div
            className="flex items-center justify-center transition-transform hover:scale-110"
            style={{
              width: 32,
              height: 32,
              background: 'var(--selection-ring)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-md)',
              cursor: 'pointer',
            }}
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});
