import { memo, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useInteractionStore } from '@/core/store';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getBinTextColors } from '@/shared/utils';
import { ResizeHandles } from '../ResizeHandles';
import { calculateBinLayout } from './calculateBinLayout';
import { calculateBinText } from './calculateBinText';
import { BinBadge } from './BinBadge';
import { ICON_PATHS, WARNING_ICON } from './binConstants';
import type { BinProps } from './binPropsAreEqual';
import { binPropsAreEqual } from './binPropsAreEqual';
import { useBinHighlighting } from './useBinHighlighting';
import { useBinSelection } from './useBinSelection';
import { useBinPointerInteraction } from './useBinPointerInteraction';

export type { BinProps } from './binPropsAreEqual';

/**
 * Single bin with selection ring and resize handles.
 * Features improved selection states with glow effect and refined handles.
 */
function BinComponent({
  bin,
  category,
  layer,
  drawer,
  cellSize,
  gap = 1,
  isGhost,
  isSelected,
  onStartDrag,
  onStartResize,
}: BinProps) {
  const t = useTranslation();
  const { isTouchDevice } = useResponsive();

  const {
    selectedBinIds,
    focusedBinId,
    setSelectedBin,
    toggleSelection,
    setFocusedBin,
    showQuickLabel,
  } = useBinSelection();

  const interaction = useInteractionStore((state) => state.interaction);

  const {
    isCategoryHighlighted,
    isAnyCategoryHighlighted,
    isRowColHighlighted,
    isAnyRowColHighlighted,
  } = useBinHighlighting({
    binX: bin.x,
    binY: bin.y,
    binWidth: bin.width,
    binDepth: bin.depth,
    categoryId: bin.category,
  });

  const { printBedSize, gridUnitMm } = useLayoutStore(
    useShallow((state) => ({
      printBedSize: state.layout.printBedSize,
      gridUnitMm: state.layout.gridUnitMm,
    }))
  );

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleContextMenu,
    handleResizePointerDown,
  } = useBinPointerInteraction({
    binId: bin.id,
    isGhost,
    isSelected,
    onStartDrag,
    onStartResize,
    setSelectedBin,
    toggleSelection,
    showQuickLabel,
  });

  // Hover state for ghost handles (desktop only)
  const [isHovered, setIsHovered] = useState(false);

  const isBeingDragged = interaction?.type === 'drag' && interaction.binIds.includes(bin.id);
  const isFocused = focusedBinId === bin.id;

  // Hide resize handles during multi-select
  const isMultiSelect = selectedBinIds.length > 1;

  // Calculate max grid units that fit on print bed (accounting for gaps)
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm);
  const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;
  const isTall = layer && bin.height > layer.height;

  // All heavy grid positioning and pixel sizing calculations are memoized together
  // to prevent recalculation when only UI state (hover, focus, etc.) changes.
  const layoutCalcs = useMemo(
    () =>
      calculateBinLayout({
        binX: bin.x,
        binY: bin.y,
        binWidth: bin.width,
        binDepth: bin.depth,
        drawerWidth: drawer.width,
        drawerDepth: drawer.depth,
        fractionalEdgeX: drawer.fractionalEdgeX,
        fractionalEdgeY: drawer.fractionalEdgeY,
        cellSize,
        gap,
      }),
    [
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
    ]
  );

  // Destructure memoized values for readability
  const {
    dimensionsText,
    gridCol,
    gridColSpan,
    gridRowStart,
    gridRowSpan,
    binPixelWidth,
    binPixelHeight,
    binPixelMin,
    needsCustomSizing,
    offsetX,
    offsetY,
  } = layoutCalcs;

  const hasNotes = bin.notes.trim().length > 0;
  const hasCustomProps =
    bin.customProperties !== undefined && Object.keys(bin.customProperties).length > 0;
  const hasLinkedDesign = !!bin.linkedDesignId;
  const hasMetadata = hasNotes || hasCustomProps;

  // Memoize font size and label visibility calculations
  const textCalcs = useMemo(
    () =>
      calculateBinText({
        binPixelMin,
        binPixelWidth,
        binPixelHeight,
        binDepth: bin.depth,
        binWidth: bin.width,
        label: bin.label,
        dimensionsText,
      }),
    [binPixelMin, binPixelWidth, binPixelHeight, bin.depth, bin.width, bin.label, dimensionsText]
  );

  const {
    shouldRotate,
    primaryFontSize,
    secondaryFontSize,
    showLabel,
    primaryText,
    secondaryText,
    letterSpacing,
  } = textCalcs;

  // Visibility thresholds (depends on isGhost which changes frequently)
  const showAnyText = binPixelMin >= 24 && !isGhost;
  // Badges need more space than text - hide on very small bins, use smaller icons on medium bins
  const showBadges = binPixelMin >= 36 && !isGhost;
  const useSmallBadges = binPixelMin < 56;

  const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
  const textColors = getBinTextColors(bgColor);

  const visualStyles = useMemo(() => {
    let boxShadow = 'var(--shadow-sm)';
    if (isGhost) {
      boxShadow = 'none';
    } else if (isSelected && isFocused) {
      boxShadow =
        '0 0 0 2px var(--selection-ring), 0 0 0 4px #3b82f6, 0 0 20px var(--selection-glow), var(--shadow-lg)';
    } else if (isSelected) {
      boxShadow =
        '0 0 0 2px var(--selection-ring), 0 0 20px var(--selection-glow), var(--shadow-lg)';
    } else if (isFocused) {
      boxShadow = '0 0 0 2px #3b82f6, var(--shadow-md)';
    } else if (isCategoryHighlighted) {
      boxShadow = '0 0 0 2px var(--color-accent), 0 0 12px rgba(34, 197, 94, 0.4)';
    } else if (isRowColHighlighted) {
      boxShadow = '0 0 0 2px var(--selection-ring), 0 0 12px var(--selection-glow)';
    }

    let opacity = 1;
    if (isGhost) opacity = 0.3;
    else if (isBeingDragged) opacity = 0.5;
    else if (isAnyCategoryHighlighted && !isCategoryHighlighted) opacity = 0.4;
    else if (isAnyRowColHighlighted && !isRowColHighlighted) opacity = 0.6;

    let zIndex = 10;
    if (isGhost) zIndex = 5;
    else if (isSelected) zIndex = 40;
    else if (isHovered) zIndex = 30;
    else if (isCategoryHighlighted || isRowColHighlighted) zIndex = 15;

    return {
      boxShadow,
      opacity,
      zIndex,
      transform: !isGhost && isSelected ? 'scale(1.01)' : ('none' as const),
    };
  }, [
    isGhost,
    isSelected,
    isFocused,
    isCategoryHighlighted,
    isRowColHighlighted,
    isBeingDragged,
    isAnyCategoryHighlighted,
    isAnyRowColHighlighted,
    isHovered,
  ]);

  return (
    <div
      data-bin-id={bin.id}
      className={`relative flex flex-col items-center justify-center ${
        isSelected && !isGhost ? 'animate-settle-in' : ''
      }`}
      style={{
        gridColumn: `${gridCol} / span ${gridColSpan}`,
        gridRow: `${gridRowStart} / span ${gridRowSpan}`,
        // Only transition visual properties, not positioning (causes bounce on grid line crossing)
        transition: 'opacity 150ms, box-shadow 150ms, transform 150ms',
        // Override size and position when drawer has fractional dimensions (different row/column sizes)
        ...(needsCustomSizing
          ? {
              width: binPixelWidth,
              height: binPixelHeight,
              marginLeft: offsetX,
              marginTop: offsetY,
            }
          : {}),
        backgroundColor: bgColor,
        borderRadius: 'var(--radius-sm)',
        border: isSelected ? 'none' : '1px solid var(--border-on-color)',
        cursor: isGhost ? 'default' : 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: isGhost || isBeingDragged ? 'none' : 'auto',
        opacity: visualStyles.opacity,
        zIndex: visualStyles.zIndex,
        boxShadow: visualStyles.boxShadow,
        transform: visualStyles.transform,
        // Allow resize handles to extend outside bin (text constrained by whitespace-nowrap and sizing)
        overflow: 'visible',
        minWidth: 0,
        minHeight: 0,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      onDoubleClick={(e) => {
        if (isGhost) return;
        e.preventDefault();
        e.stopPropagation();
        // Select the bin if not selected and show quick label popover
        if (!isSelected) {
          setSelectedBin(bin.id);
        }
        showQuickLabel(bin.id);
      }}
      onMouseEnter={() => !isTouchDevice && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => !isGhost && setFocusedBin(bin.id)}
      onBlur={() => isFocused && setFocusedBin(null)}
      role="button"
      aria-label={`Bin ${bin.width} by ${bin.depth}${bin.label !== '' ? `, labeled ${bin.label}` : ''}${category ? `, category ${category.name}` : ''}`}
      aria-pressed={isSelected}
      tabIndex={isGhost ? -1 : 0}
      title={
        isGhost ? undefined : bin.label !== '' ? `${dimensionsText} - ${bin.label}` : undefined
      }
    >
      {/* Tall bin indicator badge */}
      {isTall && !isGhost && (
        <div
          className="absolute top-0.5 right-0.5 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 pointer-events-none bg-surface text-xs font-medium"
          style={{
            color: 'var(--color-warning)',
            boxShadow: 'var(--shadow-sm)',
          }}
          title={`Spans multiple layers (${bin.height}u)`}
        >
          <span>{bin.height}u</span>
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d={ICON_PATHS.tallArrow} clipRule="evenodd" />
          </svg>
        </div>
      )}

      {hasMetadata && showBadges && (
        <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 pointer-events-none">
          {hasNotes && (
            <BinBadge
              small={useSmallBadges}
              label={t('grid.hasNotesAriaLabel')}
              path={ICON_PATHS.notes}
            />
          )}
          {hasCustomProps && (
            <BinBadge
              small={useSmallBadges}
              label={t('grid.hasCustomPropertiesAriaLabel')}
              path={ICON_PATHS.tag}
            />
          )}
        </div>
      )}

      {hasLinkedDesign && showBadges && (
        <div
          className="absolute bottom-0.5 right-0.5 pointer-events-none"
          title={t('grid.hasLinkedDesign')}
        >
          <BinBadge
            small={useSmallBadges}
            label={t('grid.hasLinkedDesign')}
            path={ICON_PATHS.link}
            colorClass="text-accent"
          />
        </div>
      )}

      {/* Adaptive label system: primary text (label or dimensions) + optional secondary */}
      {showAnyText && (
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
            {/* Split badge (only when dimensions are primary) */}
            {!showLabel && needsSplit && (
              <span
                className="ml-0.5 rounded-sm"
                title={t('grid.exceedsPrintSize')}
                style={{
                  fontSize: `${Math.round(secondaryFontSize * 0.9)}px`,
                  padding: '0px 3px',
                  backgroundColor: 'var(--overlay-medium)',
                  color: 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                {t('grid.split')}
              </span>
            )}
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
              {needsSplit && (
                <span
                  className="ml-1"
                  title={t('grid.exceedsPrintSize')}
                  style={{ color: 'var(--color-warning)' }}
                  aria-label={t('grid.exceedsPrintSize')}
                >
                  {WARNING_ICON}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resize handles - only for single selected bin, not during multi-select */}
      {/* Touch targets are 44px (Apple HIG minimum) with smaller visual indicators */}
      {/* Handles automatically position externally for bins with width≤1 OR depth≤1 */}
      {isSelected &&
        !isGhost &&
        !isMultiSelect &&
        (!interaction ||
          (interaction.type === 'resize' && interaction.binIds.includes(bin.id))) && (
          <ResizeHandles
            binWidth={bin.width}
            binDepth={bin.depth}
            variant="primary"
            onResizePointerDown={handleResizePointerDown}
          />
        )}

      {/* Ghost resize handles - show on hover when nothing is selected (desktop only) */}
      {/* Hidden when any bins are selected to avoid interfering with multi-selection clicks */}
      {!isSelected &&
        !isGhost &&
        isHovered &&
        !isTouchDevice &&
        !interaction &&
        selectedBinIds.length === 0 && (
          <ResizeHandles
            binWidth={bin.width}
            binDepth={bin.depth}
            variant="ghost"
            onResizePointerDown={handleResizePointerDown}
          />
        )}
    </div>
  );
}

export const Bin = memo(BinComponent, binPropsAreEqual);
