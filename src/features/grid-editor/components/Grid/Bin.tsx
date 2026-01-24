import type { PointerEvent } from 'react';
import { memo, useRef, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import type { Bin as BinType, Category, Layer, Drawer, ResizeHandle } from '@/core/types';
import {
  useLayoutStore,
  useSelectionStore,
  useViewStore,
  useInteractionStore,
  useMobileStore,
} from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useResponsive } from '@/shared/hooks';
import { calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getBinTextColors } from '@/shared/utils';
import { calcFractionalPixelSize } from '@/features/grid-editor/utils/fractionalPixels';
import { ResizeHandles } from './ResizeHandles';

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const LONG_PRESS_DURATION = 500; // ms
const DOUBLE_TAP_THRESHOLD = 300; // ms

interface BinProps {
  bin: BinType;
  category?: Category;
  layer?: Layer;
  drawer: Drawer;
  cellSize: number;
  gap?: number;
  isGhost: boolean;
  isSelected: boolean;
  onStartDrag: (
    binId: string,
    clientX: number,
    clientY: number,
    pointerId?: number,
    duplicate?: boolean
  ) => void;
  onStartResize: (binId: string, handle: ResizeHandle, pointerId?: number) => void;
}

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
  const { isTouchDevice } = useResponsive();

  // Performance: Use focused stores directly instead of useUIStore facade.
  // This prevents cascading re-renders when unrelated state changes.

  // Selection state - from useSelectionStore
  const { selectedBinIds, focusedBinId } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      focusedBinId: state.focusedBinId,
    }))
  );

  // View state - from useViewStore
  const showLabels = useViewStore((state) => state.showLabels);

  // Interaction state - from useInteractionStore
  const interaction = useInteractionStore((state) => state.interaction);

  // Performance: Use derived selector for category highlighting.
  // This only re-renders bins whose highlight state actually changes.
  const isCategoryHighlighted = useViewStore(
    (state) => state.highlightedCategoryId !== null && state.highlightedCategoryId === bin.category
  );
  const isAnyCategoryHighlighted = useViewStore((state) => state.highlightedCategoryId !== null);

  // Performance: Use derived selector for row/column label highlighting.
  // Check if this bin overlaps with the highlighted row or column (1-indexed).
  const isRowColHighlighted = useViewStore((state) => {
    const { highlightedRowLabel, highlightedColLabel } = state;
    if (highlightedRowLabel === null && highlightedColLabel === null) return false;

    // Check row overlap: row N (1-indexed) corresponds to grid y = N-1
    // Bin occupies rows where bin.y <= rowY < bin.y + bin.depth
    if (highlightedRowLabel !== null) {
      const rowY = highlightedRowLabel - 1; // Convert 1-indexed to 0-indexed
      if (rowY >= bin.y && rowY < bin.y + bin.depth) return true;
    }

    // Check column overlap: column N (1-indexed) corresponds to grid x = N-1
    // Bin occupies columns where bin.x <= colX < bin.x + bin.width
    if (highlightedColLabel !== null) {
      const colX = highlightedColLabel - 1; // Convert 1-indexed to 0-indexed
      if (colX >= bin.x && colX < bin.x + bin.width) return true;
    }

    return false;
  });
  const isAnyRowColHighlighted = useViewStore(
    (state) => state.highlightedRowLabel !== null || state.highlightedColLabel !== null
  );

  // Selection actions - from useSelectionStore
  const setSelectedBin = useSelectionStore((state) => state.setSelectedBin);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const addToSelection = useSelectionStore((state) => state.addToSelection);
  const setFocusedBin = useSelectionStore((state) => state.setFocusedBin);
  const showQuickLabel = useSelectionStore((state) => state.showQuickLabel);

  // View actions - from useViewStore
  const showContextMenu = useViewStore((state) => state.showContextMenu);

  // Interaction state and actions - from useInteractionStore
  const paintSize = useInteractionStore((state) => state.paintSize);
  const setPaintSize = useInteractionStore((state) => state.setPaintSize);

  // Mobile actions - from useMobileStore
  const setActiveMobilePanel = useMobileStore((state) => state.setActiveMobilePanel);

  // Consolidate layout state selectors with shallow comparison
  const { printBedSize, gridUnitMm } = useLayoutStore(
    useShallow((state) => ({
      printBedSize: state.layout.printBedSize,
      gridUnitMm: state.layout.gridUnitMm,
    }))
  );

  // Long-press detection for mobile context menu
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  // Double-tap detection for mobile
  const lastTapTimeRef = useRef<number>(0);
  // Track pointer ID for passing to useInteraction
  const activePointerIdRef = useRef<number | null>(null);

  // Hover state for ghost handles (desktop only)
  const [isHovered, setIsHovered] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const isBeingDragged = interaction?.type === 'drag' && interaction.binIds.includes(bin.id);
  const isFocused = focusedBinId === bin.id;

  // Hide resize handles during multi-select
  const isMultiSelect = selectedBinIds.length > 1;

  // Calculate max grid units that fit on print bed (accounting for gaps)
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm);
  const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;
  const isTall = layer && bin.height > layer.height;

  // ========== MEMOIZED LAYOUT CALCULATIONS ==========
  // All heavy grid positioning and pixel sizing calculations are memoized together
  // to prevent recalculation when only UI state (hover, focus, etc.) changes.
  const layoutCalcs = useMemo(() => {
    // Format dimensions - show decimal if fractional (half-bin mode)
    const formatDim = (val: number) => (val % 1 === 0 ? val.toString() : val.toFixed(1));
    const dimensionsText = `${formatDim(bin.width)}×${formatDim(bin.depth)}`;

    // Calculate grid position (always use standard grid, no scaling)
    const hasFractionalX = bin.x % 1 !== 0;
    const hasFractionalY = bin.y % 1 !== 0;
    const hasFractionalWidth = bin.width % 1 !== 0;
    const hasFractionalDepth = bin.depth % 1 !== 0;
    const hasFractionalDims =
      hasFractionalX || hasFractionalY || hasFractionalWidth || hasFractionalDepth;

    // CSS Grid positioning with configurable fractional edge placement
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
    const gridColSpan = Math.max(1, endCol - startCol + 1);

    // Calculate CSS row placement
    const binEndY = bin.y + bin.depth;
    const topRow = getCssRowForY(binEndY > 0 ? binEndY - 0.001 : binEndY);
    const bottomRow = getCssRowForY(bin.y);
    const gridRowStart = topRow;
    const gridRowSpan = Math.max(1, bottomRow - topRow + 1);

    // Calculate actual pixel dimensions using shared fractional pixel utility
    const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
    const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

    const binPixelWidth = calcFractionalPixelSize(bin.x, bin.width, {
      drawerDimension: drawer.width,
      fractionalEdge: fractionalEdgeX,
      cellSize,
      gap,
    });

    const binPixelHeight = calcFractionalPixelSize(bin.y, bin.depth, {
      drawerDimension: drawer.depth,
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
        if (bin.x < fractionalWidthPart) {
          offsetX = (bin.x / fractionalWidthPart) * fractionalCellWidth;
        } else {
          const integerX = bin.x - fractionalWidthPart;
          offsetX = (integerX - Math.floor(integerX)) * (cellSize + gap);
        }
      } else {
        offsetX = (bin.x - Math.floor(bin.x)) * (cellSize + gap);
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

  const hasLabel = showLabels && bin.label;
  const hasNotes = bin.notes && bin.notes.trim().length > 0;
  const hasCustomProps = bin.customProperties && Object.keys(bin.customProperties).length > 0;
  const hasMetadata = hasNotes || hasCustomProps;

  // ========== MEMOIZED TEXT CALCULATIONS ==========
  // Memoize font size and label visibility calculations
  const textCalcs = useMemo(() => {
    const minFontSize = 9;
    const maxFontSize = clamp(Math.round(binPixelMin * 0.28), 9, 20);

    // Smart rotation: use taller dimension for text if significantly taller
    const shouldRotate = bin.depth > bin.width * 1.5;

    // Available width for text (very conservative: 75% of bin width to account for padding)
    const rawAvailableWidth = shouldRotate ? binPixelHeight : binPixelWidth;
    const effectiveAvailableWidth = rawAvailableWidth * 0.75;

    // Calculate if label fits and at what font size
    let labelFits = false;
    let labelFontSize = maxFontSize;

    if (hasLabel && bin.label) {
      const labelLength = bin.label.length;
      const neededFontSize = effectiveAvailableWidth / (labelLength * 0.6);

      if (neededFontSize >= minFontSize) {
        labelFits = true;
        labelFontSize = clamp(Math.floor(neededFontSize), minFontSize, maxFontSize);
      }
    }

    const primaryFontSize = labelFits ? labelFontSize : maxFontSize;
    const secondaryFontSize = clamp(Math.round(primaryFontSize * 0.75), 8, 14);

    // Visibility thresholds
    const rawAvailableHeight = shouldRotate ? binPixelWidth : binPixelHeight;
    const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

    // Show label if it fits, otherwise show dimensions
    const showLabel = hasLabel && labelFits;
    const primaryText = showLabel && bin.label ? bin.label : dimensionsText;
    const secondaryText = showLabel && hasSpaceForSecondary ? dimensionsText : null;

    return {
      shouldRotate,
      primaryFontSize,
      secondaryFontSize,
      showLabel,
      primaryText,
      secondaryText,
      letterSpacing: primaryFontSize < 11 ? ('0.02em' as const) : ('normal' as const),
    };
  }, [
    binPixelMin,
    binPixelWidth,
    binPixelHeight,
    bin.depth,
    bin.width,
    bin.label,
    hasLabel,
    dimensionsText,
  ]);

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

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isGhost) return;
    // Ignore non-primary pointer (second finger) - allow two-finger pan
    if (!e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();

    // Store pointer ID for passing to useInteraction when drag starts
    activePointerIdRef.current = e.pointerId;

    // Reset long-press state
    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    // Start long-press timer on touch devices
    if (isTouchDevice && e.button === 0) {
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        // Vibrate if supported (haptic feedback)
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        // Show context menu
        showContextMenu([bin.id], { x: e.clientX, y: e.clientY }, 'grid');
      }, LONG_PRESS_DURATION);
    }

    if (e.button === 0) {
      const isMultiSelectKey = e.ctrlKey || e.metaKey;
      const isRangeSelectKey = e.shiftKey;

      // Exit paint mode when selecting a bin
      if (paintSize) {
        setPaintSize(null);
      }

      if (isMultiSelectKey) {
        // Ctrl/Cmd+click: toggle this bin in selection
        toggleSelection(bin.id);
        clearLongPress();
      } else if (isRangeSelectKey) {
        // Shift+click: add to selection (range select could be enhanced later)
        addToSelection(bin.id);
        clearLongPress();
      } else if (!isTouchDevice) {
        // Desktop: Normal click - single select and start drag immediately
        // Alt+drag starts a duplicate operation
        const isDuplicateDrag = e.altKey;
        if (!isSelected) {
          setSelectedBin(bin.id);
          // Show first-time hint about resize handles
          const hintShown = localStorage.getItem('gridfinity-resize-hint-shown');
          if (!hintShown) {
            addToast('Tip: Drag the handles to resize', 'info');
            localStorage.setItem('gridfinity-resize-hint-shown', 'true');
          }
        }
        onStartDrag(bin.id, e.clientX, e.clientY, e.pointerId, isDuplicateDrag);
      } else {
        // Touch: Select on pointer down, drag starts on move
        if (!isSelected) {
          setSelectedBin(bin.id);
        }
      }
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Cancel long-press if pointer moved too far (10px threshold)
    if (pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        clearLongPress();
        // Start drag on move for touch devices (pass pointer ID for capture management)
        if (isTouchDevice && !longPressTriggeredRef.current) {
          onStartDrag(bin.id, e.clientX, e.clientY, activePointerIdRef.current ?? e.pointerId);
        }
      }
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    activePointerIdRef.current = null;

    // Double-tap detection for mobile - open inspector
    if (isTouchDevice && !longPressTriggeredRef.current && pointerStartRef.current) {
      // Check if pointer didn't move much (wasn't a drag)
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 10) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
          // Double-tap detected - open inspector
          setActiveMobilePanel('inspector');
          lastTapTimeRef.current = 0; // Reset to prevent triple-tap
        } else {
          lastTapTimeRef.current = now;
        }
      }
    }

    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearLongPress();
    activePointerIdRef.current = null;
    pointerStartRef.current = null;
  };

  // Right-click context menu for desktop
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isGhost) return;
    e.preventDefault();
    e.stopPropagation();
    // Select the bin if not already selected
    if (!isSelected) {
      setSelectedBin(bin.id);
    }
    showContextMenu([bin.id], { x: e.clientX, y: e.clientY }, 'grid');
  };

  const handleResizePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
      // Ignore secondary touches (allow two-finger pan)
      if (!e.isPrimary) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 0) {
        // Haptic feedback on touch devices when starting resize
        if (isTouchDevice && navigator.vibrate) {
          navigator.vibrate(30);
        }
        onStartResize(bin.id, handle, e.pointerId);
      }
    },
    [onStartResize, bin.id, isTouchDevice]
  );

  const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
  const textColors = getBinTextColors(bgColor);

  // Selection and hover styles
  const getBoxShadow = () => {
    if (isGhost) return 'none';
    if (isSelected) {
      // Selection ring with optional focus ring
      if (isFocused) {
        return '0 0 0 2px var(--selection-ring), 0 0 0 4px #3b82f6, 0 0 20px var(--selection-glow), var(--shadow-lg)';
      }
      return '0 0 0 2px var(--selection-ring), 0 0 20px var(--selection-glow), var(--shadow-lg)';
    }
    if (isFocused) {
      // Focus ring without selection
      return '0 0 0 2px #3b82f6, var(--shadow-md)';
    }
    // Category highlight (when hovering category in sidebar)
    if (isCategoryHighlighted) {
      return '0 0 0 2px var(--color-accent), 0 0 12px rgba(34, 197, 94, 0.4)';
    }
    // Row/column label highlight (when hovering row/column label)
    if (isRowColHighlighted) {
      return '0 0 0 2px var(--selection-ring), 0 0 12px var(--selection-glow)';
    }
    return 'var(--shadow-sm)';
  };

  const getTransform = () => {
    if (isGhost) return 'none';
    if (isSelected) return 'scale(1.01)';
    return 'none';
  };

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
        opacity: isGhost
          ? 0.3
          : isBeingDragged
            ? 0.5
            : isAnyCategoryHighlighted && !isCategoryHighlighted
              ? 0.4
              : isAnyRowColHighlighted && !isRowColHighlighted
                ? 0.6
                : 1,
        // Selected bins need higher z-index (40) to ensure resize handles appear above axis labels (30)
        // Hovered bins (30) need to be above regular bins (10) so resize handles aren't clipped by neighbors
        zIndex: isGhost
          ? 5
          : isSelected
            ? 40
            : isHovered
              ? 30
              : isCategoryHighlighted || isRowColHighlighted
                ? 15
                : 10,
        boxShadow: getBoxShadow(),
        transform: getTransform(),
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
      aria-label={`Bin ${bin.width} by ${bin.depth}${bin.label ? `, labeled ${bin.label}` : ''}${category ? `, category ${category.name}` : ''}`}
      aria-pressed={isSelected}
      tabIndex={isGhost ? -1 : 0}
      title={isGhost ? undefined : bin.label ? `${dimensionsText} - ${bin.label}` : undefined}
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
            <path
              fillRule="evenodd"
              d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Metadata indicators - shown when bin has notes or custom properties */}
      {hasMetadata && showBadges && (
        <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 pointer-events-none">
          {/* Notes indicator - speech bubble icon (matches print list) */}
          {hasNotes && (
            <div
              className={`${useSmallBadges ? 'p-px' : 'p-0.5'} rounded-sm bg-surface/80`}
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <svg
                className={`${useSmallBadges ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-content-tertiary`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={useSmallBadges ? 2.5 : 2}
                aria-label="Has notes"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
          )}
          {/* Custom properties indicator - tag icon */}
          {hasCustomProps && (
            <div
              className={`${useSmallBadges ? 'p-px' : 'p-0.5'} rounded-sm bg-surface/80`}
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <svg
                className={`${useSmallBadges ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-content-tertiary`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={useSmallBadges ? 2.5 : 2}
                aria-label="Has custom properties"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
          )}
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
            {!showLabel && needsSplit && !isGhost && (
              <span
                className="ml-0.5 rounded-sm"
                title="Exceeds print size, will be split"
                style={{
                  fontSize: `${Math.round(secondaryFontSize * 0.9)}px`,
                  padding: '0px 3px',
                  backgroundColor: 'var(--overlay-medium)',
                  color: 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                Split
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
              {needsSplit && !isGhost && (
                <span
                  className="ml-1"
                  title="Exceeds print size, will be split"
                  style={{ color: 'var(--color-warning)' }}
                >
                  ⚠
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resize handles - only for single selected bin, not during multi-select */}
      {/* Touch targets are 44px (Apple HIG minimum) with smaller visual indicators */}
      {/* Handles automatically position externally for bins with width≤1 OR depth≤1 */}
      {isSelected && !isGhost && !isMultiSelect && !interaction && (
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

/**
 * Custom comparison function for React.memo.
 * Only re-render if props that affect visual appearance change.
 */
function binPropsAreEqual(prevProps: BinProps, nextProps: BinProps): boolean {
  // Always re-render if selection state changes
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isGhost !== nextProps.isGhost) return false;

  // Re-render if bin data changes
  const prevBin = prevProps.bin;
  const nextBin = nextProps.bin;
  if (
    prevBin.id !== nextBin.id ||
    prevBin.x !== nextBin.x ||
    prevBin.y !== nextBin.y ||
    prevBin.width !== nextBin.width ||
    prevBin.depth !== nextBin.depth ||
    prevBin.height !== nextBin.height ||
    prevBin.label !== nextBin.label ||
    prevBin.category !== nextBin.category ||
    prevBin.notes !== nextBin.notes
  ) {
    return false;
  }

  // Re-render if customProperties change (compare keys and values)
  const prevCustomProps = prevBin.customProperties;
  const nextCustomProps = nextBin.customProperties;
  const prevHasProps = prevCustomProps && Object.keys(prevCustomProps).length > 0;
  const nextHasProps = nextCustomProps && Object.keys(nextCustomProps).length > 0;
  if (prevHasProps !== nextHasProps) {
    return false;
  }
  if (prevHasProps && nextHasProps) {
    const prevKeys = Object.keys(prevCustomProps);
    const nextKeys = Object.keys(nextCustomProps);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prevCustomProps[key] !== nextCustomProps[key]) return false;
    }
  }

  // Re-render if category changes
  if (
    prevProps.category?.id !== nextProps.category?.id ||
    prevProps.category?.color !== nextProps.category?.color
  ) {
    return false;
  }

  // Re-render if layer changes
  if (
    prevProps.layer?.id !== nextProps.layer?.id ||
    prevProps.layer?.height !== nextProps.layer?.height
  ) {
    return false;
  }

  // Re-render if drawer dimensions or edge configuration changes
  if (
    prevProps.drawer.width !== nextProps.drawer.width ||
    prevProps.drawer.depth !== nextProps.drawer.depth ||
    prevProps.drawer.fractionalEdgeX !== nextProps.drawer.fractionalEdgeX ||
    prevProps.drawer.fractionalEdgeY !== nextProps.drawer.fractionalEdgeY
  ) {
    return false;
  }

  // Re-render if cellSize or gap changes (affects sizing)
  if (prevProps.cellSize !== nextProps.cellSize || prevProps.gap !== nextProps.gap) {
    return false;
  }

  // Callbacks are stable (from useCallback), so we don't compare them
  return true;
}

export const Bin = memo(BinComponent, binPropsAreEqual);
