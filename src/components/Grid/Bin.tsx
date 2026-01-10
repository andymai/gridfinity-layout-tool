import { memo, useRef, useState, type PointerEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import type { Bin as BinType, Category, Layer, ResizeHandle } from '../../types';
import { useUIStore, useLayoutStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { useResponsive } from '../../hooks';
import { calcMaxGridUnits, DEFAULT_CATEGORY_COLOR, HALF_BIN_SCALE } from '../../constants';
import { getBinTextColors } from '../../utils/color';

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
  drawer: { width: number; depth: number };
  cellSize: number;
  halfBinMode?: boolean;
  isGhost: boolean;
  isSelected: boolean;
  onStartDrag: (binId: string, clientX: number, clientY: number, pointerId?: number) => void;
  onStartResize: (binId: string, handle: ResizeHandle, pointerId?: number) => void;
}

/**
 * Single bin with selection ring and resize handles.
 * Features improved selection states with glow effect and refined handles.
 */
function BinComponent({ bin, category, layer, drawer, cellSize, halfBinMode = false, isGhost, isSelected, onStartDrag, onStartResize }: BinProps) {
  const { isTouchDevice } = useResponsive();

  // Consolidate UI state selectors with shallow comparison
  const { selectedBinIds, interaction, showLabels, focusedBinId } = useUIStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      interaction: state.interaction,
      showLabels: state.showLabels,
      focusedBinId: state.focusedBinId,
    }))
  );

  // Performance: Use derived selector for category highlighting.
  // This only re-renders bins whose highlight state actually changes.
  const isCategoryHighlighted = useUIStore(
    (state) => state.highlightedCategoryId !== null && state.highlightedCategoryId === bin.category
  );
  const isAnyCategoryHighlighted = useUIStore(
    (state) => state.highlightedCategoryId !== null
  );

  // Actions are stable, select individually
  const setSelectedBin = useUIStore((state) => state.setSelectedBin);
  const toggleSelection = useUIStore((state) => state.toggleSelection);
  const addToSelection = useUIStore((state) => state.addToSelection);
  const showContextMenu = useUIStore((state) => state.showContextMenu);
  const setFocusedBin = useUIStore((state) => state.setFocusedBin);
  const setActiveMobilePanel = useUIStore((state) => state.setActiveMobilePanel);
  const showQuickLabel = useUIStore((state) => state.showQuickLabel);

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
  const addToast = useToastStore(state => state.addToast);

  const isBeingDragged = interaction?.type === 'drag' && interaction.binIds.includes(bin.id);
  const isFocused = focusedBinId === bin.id;

  // Hide resize handles during multi-select
  const isMultiSelect = selectedBinIds.length > 1;

  // Calculate max grid units that fit on print bed (accounting for gaps)
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm);
  const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;
  const isTall = layer && bin.height > layer.height;

  // ========== ADAPTIVE LABEL SYSTEM ==========
  // Simple rule: if label fits at calculated font size, show it. Otherwise show dimensions.
  // Uses monospace font for predictable character widths.

  // Format dimensions - show decimal if fractional (half-bin mode)
  const formatDim = (val: number) => val % 1 === 0 ? val.toString() : val.toFixed(1);
  const dimensionsText = `${formatDim(bin.width)}×${formatDim(bin.depth)}`;
  const hasLabel = showLabels && bin.label;

  // Calculate grid position based on half-bin mode
  const scale = halfBinMode ? HALF_BIN_SCALE : 1;
  const gridCol = Math.round(bin.x * scale) + 1;
  const gridColSpan = Math.round(bin.width * scale);
  const gridRowStart = halfBinMode
    ? Math.round((drawer.depth - bin.y - bin.depth) * scale) + 1
    : drawer.depth - bin.y - bin.depth + 1;
  const gridRowSpan = Math.round(bin.depth * scale);

  // Calculate actual pixel dimensions of bin
  // cellSize is already adjusted for half-bin mode, so multiply by span count
  const binPixelWidth = gridColSpan * cellSize;
  const binPixelHeight = gridRowSpan * cellSize;
  const binPixelMin = Math.min(binPixelWidth, binPixelHeight);

  // Font size constraints
  const maxFontSize = clamp(Math.round(binPixelMin * 0.28), 9, 20);
  const minFontSize = 9;

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

    // Calculate the font size needed to fit this label
    // textWidth = labelLength * fontSize * 0.6
    // fontSize = effectiveAvailableWidth / (labelLength * 0.6)
    const neededFontSize = effectiveAvailableWidth / (labelLength * 0.6);

    if (neededFontSize >= minFontSize) {
      // Label fits at a readable size
      labelFits = true;
      labelFontSize = clamp(Math.floor(neededFontSize), minFontSize, maxFontSize);
    }
  }

  // Calculate font sizes
  const primaryFontSize = labelFits ? labelFontSize : maxFontSize;
  const secondaryFontSize = clamp(Math.round(primaryFontSize * 0.75), 8, 14);

  // Visibility thresholds
  const showAnyText = binPixelMin >= 24 && !isGhost;
  const rawAvailableHeight = shouldRotate ? binPixelWidth : binPixelHeight;
  const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

  // Show label if it fits, otherwise show dimensions
  const showLabel = hasLabel && labelFits;
  const primaryText = showLabel && bin.label ? bin.label : dimensionsText;
  const secondaryText = showLabel && hasSpaceForSecondary ? dimensionsText : null;

  // Letter-spacing for small text
  const letterSpacing = primaryFontSize < 11 ? '0.02em' : 'normal';

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
        showContextMenu(bin.id, { x: e.clientX, y: e.clientY });
      }, LONG_PRESS_DURATION);
    }

    if (e.button === 0) {
      const isMultiSelectKey = e.ctrlKey || e.metaKey;
      const isRangeSelectKey = e.shiftKey;

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
        if (!isSelected) {
          setSelectedBin(bin.id);
          // Show first-time hint about resize handles
          const hintShown = localStorage.getItem('gridfinity-resize-hint-shown');
          if (!hintShown) {
            addToast('Tip: Drag the handles to resize', 'info');
            localStorage.setItem('gridfinity-resize-hint-shown', 'true');
          }
        }
        onStartDrag(bin.id, e.clientX, e.clientY, e.pointerId);
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
    showContextMenu(bin.id, { x: e.clientX, y: e.clientY });
  };

  const handleResizePointerDown = (e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
    // Ignore secondary touches (allow two-finger pan)
    if (!e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 0) {
      onStartResize(bin.id, handle, e.pointerId);
    }
  };

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
      className={`relative flex flex-col items-center justify-center transition-all duration-150 ${
        isSelected && !isGhost ? 'animate-settle-in' : ''
      }`}
      style={{
        gridColumn: `${gridCol} / span ${gridColSpan}`,
        gridRow: `${gridRowStart} / span ${gridRowSpan}`,
        backgroundColor: bgColor,
        borderRadius: 'var(--radius-sm)',
        border: isSelected ? 'none' : '1px solid var(--border-on-color)',
        cursor: isGhost ? 'default' : 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: isGhost || isBeingDragged ? 'none' : 'auto',
        opacity: isGhost ? 0.3 : isBeingDragged ? 0.5 : (isAnyCategoryHighlighted && !isCategoryHighlighted) ? 0.4 : 1,
        zIndex: isGhost ? 5 : isSelected ? 20 : isCategoryHighlighted ? 15 : 10,
        boxShadow: getBoxShadow(),
        transform: getTransform(),
        // Prevent text content from expanding bin beyond grid cell
        overflow: 'hidden',
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
      title={isGhost ? undefined : (bin.label ? `${dimensionsText} - ${bin.label}` : undefined)}
    >
      {/* Tall bin indicator badge */}
      {isTall && !isGhost && (
        <div
          className="absolute top-0.5 right-0.5 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 pointer-events-none bg-surface text-xs font-medium"
          style={{
            color: 'var(--color-warning)',
            boxShadow: 'var(--shadow-sm)'
          }}
          title={`Spans multiple layers (${bin.height}u)`}
        >
          <span>{bin.height}u</span>
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
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
      {/* Disable pointer events during any interaction to avoid blocking draw operations */}
      {isSelected && !isGhost && !isMultiSelect && !interaction && (
        <>
          {/* Left edge handle (w) */}
          <div
            className="absolute transition-transform hover:scale-110 flex items-center justify-center"
            style={{
              left: -22,
              top: '25%',
              width: 44,
              height: '50%',
              minHeight: 44,
              cursor: 'ew-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            role="slider"
            aria-label="Resize left edge"
            aria-orientation="horizontal"
          >
            <div
              style={{
                width: 10,
                height: '45%',
                minHeight: 20,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          </div>
          {/* Right edge handle (e) */}
          <div
            className="absolute transition-transform hover:scale-110 flex items-center justify-center"
            style={{
              right: -22,
              top: '25%',
              width: 44,
              height: '50%',
              minHeight: 44,
              cursor: 'ew-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            role="slider"
            aria-label="Resize right edge"
            aria-orientation="horizontal"
          >
            <div
              style={{
                width: 10,
                height: '45%',
                minHeight: 20,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          </div>
          {/* Top edge handle (n) - visually at top, increases Y */}
          <div
            className="absolute transition-transform hover:scale-110 flex items-center justify-center"
            style={{
              top: -22,
              left: '25%',
              width: '50%',
              minWidth: 44,
              height: 44,
              cursor: 'ns-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            role="slider"
            aria-label="Resize top edge"
            aria-orientation="vertical"
          >
            <div
              style={{
                width: '45%',
                minWidth: 20,
                height: 10,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          </div>
          {/* Bottom edge handle (s) - visually at bottom, decreases Y */}
          <div
            className="absolute transition-transform hover:scale-110 flex items-center justify-center"
            style={{
              bottom: -22,
              left: '25%',
              width: '50%',
              minWidth: 44,
              height: 44,
              cursor: 'ns-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            role="slider"
            aria-label="Resize bottom edge"
            aria-orientation="vertical"
          >
            <div
              style={{
                width: '45%',
                minWidth: 20,
                height: 10,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          </div>
          {/* NW corner handle (top-left) */}
          <div
            className="absolute transition-transform hover:scale-125 flex items-center justify-center"
            style={{
              left: -22,
              top: -22,
              width: 44,
              height: 44,
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            role="slider"
            aria-label="Resize top-left corner"
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
          {/* NE corner handle (top-right) */}
          <div
            className="absolute transition-transform hover:scale-125 flex items-center justify-center"
            style={{
              right: -22,
              top: -22,
              width: 44,
              height: 44,
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            role="slider"
            aria-label="Resize top-right corner"
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
          {/* SW corner handle (bottom-left) */}
          <div
            className="absolute transition-transform hover:scale-125 flex items-center justify-center"
            style={{
              left: -22,
              bottom: -22,
              width: 44,
              height: 44,
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            role="slider"
            aria-label="Resize bottom-left corner"
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
          {/* SE corner handle (bottom-right) */}
          <div
            className="absolute transition-transform hover:scale-125 flex items-center justify-center"
            style={{
              right: -22,
              bottom: -22,
              width: 44,
              height: 44,
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            role="slider"
            aria-label="Resize bottom-right corner"
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
        </>
      )}

      {/* Functional resize handles - show on hover for non-selected bins (desktop only) */}
      {/* These are semi-transparent but fully functional, allowing resize without selection */}
      {!isSelected && !isGhost && isHovered && !isTouchDevice && !interaction && (
        <>
          {/* Left edge handle (w) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-110"
            style={{
              left: -22,
              top: '25%',
              width: 44,
              height: '50%',
              minHeight: 44,
              cursor: 'ew-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
          >
            <div
              style={{
                width: 10,
                height: '45%',
                minHeight: 20,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* Right edge handle (e) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-110"
            style={{
              right: -22,
              top: '25%',
              width: 44,
              height: '50%',
              minHeight: 44,
              cursor: 'ew-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
          >
            <div
              style={{
                width: 10,
                height: '45%',
                minHeight: 20,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* Top edge handle (n) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-110"
            style={{
              top: -22,
              left: '25%',
              width: '50%',
              minWidth: 44,
              height: 44,
              cursor: 'ns-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
          >
            <div
              style={{
                width: '45%',
                minWidth: 20,
                height: 10,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* Bottom edge handle (s) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-110"
            style={{
              bottom: -22,
              left: '25%',
              width: '50%',
              minWidth: 44,
              height: 44,
              cursor: 'ns-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
          >
            <div
              style={{
                width: '45%',
                minWidth: 20,
                height: 10,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* NW corner handle (top-left) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-125"
            style={{
              left: -22,
              top: -22,
              width: 44,
              height: 44,
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* NE corner handle (top-right) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-125"
            style={{
              right: -22,
              top: -22,
              width: 44,
              height: 44,
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* SW corner handle (bottom-left) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-125"
            style={{
              left: -22,
              bottom: -22,
              width: 44,
              height: 44,
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
          {/* SE corner handle (bottom-right) */}
          <div
            className="absolute flex items-center justify-center transition-transform hover:scale-125"
            style={{
              right: -22,
              bottom: -22,
              width: 44,
              height: 44,
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.5,
              }}
            />
          </div>
        </>
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
    prevBin.category !== nextBin.category
  ) {
    return false;
  }

  // Re-render if category changes
  if (prevProps.category?.id !== nextProps.category?.id ||
      prevProps.category?.color !== nextProps.category?.color) {
    return false;
  }

  // Re-render if layer changes
  if (prevProps.layer?.id !== nextProps.layer?.id ||
      prevProps.layer?.height !== nextProps.layer?.height) {
    return false;
  }

  // Re-render if drawer dimensions change
  if (prevProps.drawer.width !== nextProps.drawer.width ||
      prevProps.drawer.depth !== nextProps.drawer.depth) {
    return false;
  }

  // Re-render if cellSize changes (affects label sizing)
  if (prevProps.cellSize !== nextProps.cellSize) {
    return false;
  }

  // Re-render if halfBinMode changes (affects grid positioning)
  if (prevProps.halfBinMode !== nextProps.halfBinMode) {
    return false;
  }

  // Callbacks are stable (from useCallback), so we don't compare them
  return true;
}

export const Bin = memo(BinComponent, binPropsAreEqual);
