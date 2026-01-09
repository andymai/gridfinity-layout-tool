import { memo, useRef, useState, type PointerEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import type { Bin as BinType, Category, Layer, ResizeHandle } from '../../types';
import { useUIStore, useLayoutStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { useResponsive } from '../../hooks';
import { calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '../../constants';
import { getContrastColor } from '../../utils/color';

const LONG_PRESS_DURATION = 500; // ms
const DOUBLE_TAP_THRESHOLD = 300; // ms

interface BinProps {
  bin: BinType;
  category?: Category;
  layer?: Layer;
  drawer: { width: number; depth: number };
  isGhost: boolean;
  isSelected: boolean;
  onStartDrag: (binId: string, clientX: number, clientY: number) => void;
  onStartResize: (binId: string, handle: ResizeHandle) => void;
}

/**
 * Single bin with selection ring and resize handles.
 * Features improved selection states with glow effect and refined handles.
 */
function BinComponent({ bin, category, layer, drawer, isGhost, isSelected, onStartDrag, onStartResize }: BinProps) {
  const { isTouchDevice } = useResponsive();

  // Consolidate UI state selectors with shallow comparison
  const { selectedBinIds, interaction, zoom, showLabels, focusedBinId } = useUIStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      interaction: state.interaction,
      zoom: state.zoom,
      showLabels: state.showLabels,
      focusedBinId: state.focusedBinId,
    }))
  );

  // Actions are stable, select individually
  const setSelectedBin = useUIStore((state) => state.setSelectedBin);
  const toggleSelection = useUIStore((state) => state.toggleSelection);
  const addToSelection = useUIStore((state) => state.addToSelection);
  const showContextMenu = useUIStore((state) => state.showContextMenu);
  const setFocusedBin = useUIStore((state) => state.setFocusedBin);
  const setActiveMobilePanel = useUIStore((state) => state.setActiveMobilePanel);

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

  const dimensionsText = `${bin.width}×${bin.depth}`;
  const labelText = showLabels ? (bin.label || '') : '';

  // Rotate text for tall narrow bins (depth > 1.5x width)
  const shouldRotate = bin.depth > bin.width * 1.5;

  // Hide all text when zoomed out too far (bins too small to show text legibly)
  // At zoom < 0.4, bins are typically < 15px per cell which is too small for text
  const showAnyText = zoom >= 0.4;

  // Hide dimensions when there's a label and not enough space:
  // - Very small bins (area < 2)
  // - Shallow bins (depth = 1) - not enough vertical space for both lines
  // - Narrow bins (width = 1) - rotation handles this but still tight
  const showDimensions = showAnyText && (!labelText || (bin.width * bin.depth >= 2 && bin.depth > 1 && bin.width > 1));

  // Scale font size with zoom (dampened: 0.6 + 0.4 * zoom)
  // At 50% zoom: 0.8x, at 100%: 1.0x, at 200%: 1.4x
  const fontScale = 0.6 + 0.4 * zoom;
  const dimensionFontSize = Math.round(14 * fontScale);
  const labelFontSize = Math.round(12 * fontScale);

  // Also hide label text when zoomed out
  const showLabelText = showAnyText && labelText;

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

    // Capture pointer to receive move/up events even if pointer leaves element
    if (isTouchDevice) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

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
        onStartDrag(bin.id, e.clientX, e.clientY);
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
        // Start drag on move for touch devices
        if (isTouchDevice && !longPressTriggeredRef.current) {
          onStartDrag(bin.id, e.clientX, e.clientY);
        }
      }
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    clearLongPress();

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
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 0) {
      onStartResize(bin.id, handle);
    }
  };

  const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
  const textColor = getContrastColor(bgColor);

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
        gridColumn: `${bin.x + 1} / span ${bin.width}`,
        gridRow: `${drawer.depth - bin.y - bin.depth + 1} / span ${bin.depth}`,
        backgroundColor: bgColor,
        borderRadius: 'var(--radius-sm)',
        border: isSelected ? 'none' : '1px solid var(--border-on-color)',
        cursor: isGhost ? 'default' : 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: isGhost || isBeingDragged ? 'none' : 'auto',
        opacity: isGhost ? 0.3 : isBeingDragged ? 0.3 : 1,
        zIndex: isGhost ? 5 : isSelected ? 20 : 10,
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

      {/* Size label in center */}
      <div
        className="text-center pointer-events-none select-none flex flex-col items-center justify-center overflow-hidden px-1"
        style={{
          color: textColor,
          transform: shouldRotate ? 'rotate(-90deg)' : 'none',
          // When rotated, expand width to use depth space (percentage of parent width × depth/width ratio)
          width: shouldRotate ? `${(bin.depth / bin.width) * 90}%` : 'auto',
          maxWidth: shouldRotate ? 'none' : '95%',
          maxHeight: '90%',
        }}
      >
        {showDimensions && (
          <div
            className="font-semibold flex items-center justify-center gap-0.5 leading-tight"
            style={{
              fontSize: `${dimensionFontSize}px`,
              textShadow: 'var(--shadow-sm)',
            }}
          >
            {dimensionsText}
            {needsSplit && !isGhost && (
              <span
                className="ml-0.5 rounded-sm"
                title="Exceeds print size, will be split"
                style={{
                  fontSize: `${Math.round(labelFontSize * 0.9)}px`,
                  padding: '0px 3px',
                  backgroundColor: 'var(--overlay-medium)',
                  color: 'var(--color-warning)',
                  fontWeight: 'var(--font-medium)',
                }}
              >
                Split
              </span>
            )}
          </div>
        )}
        {showLabelText && (
          <div
            className={`leading-tight ${shouldRotate ? 'whitespace-nowrap' : 'truncate w-full'}`}
            style={{
              fontSize: `${labelFontSize}px`,
              fontWeight: showDimensions ? 'normal' : 500,
              opacity: showDimensions ? 0.85 : 1,
              marginTop: showDimensions ? '1px' : 0,
            }}
          >
            {labelText}
          </div>
        )}
      </div>

      {/* Resize handles - only for single selected bin, not during multi-select */}
      {/* Touch targets are 44px (Apple HIG minimum) with smaller visual indicators */}
      {isSelected && !isGhost && !isMultiSelect && (
        <>
          {/* Right edge handle - 44px touch target, 10px visual */}
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
            aria-label="Resize width"
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
          {/* Bottom edge handle - 44px touch target, 10px visual */}
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
            aria-label="Resize depth"
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
          {/* SE corner handle - 44px touch target, 12px visual */}
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
            aria-label="Resize width and depth"
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

      {/* Ghost resize handles - show on hover for non-selected bins (desktop only) */}
      {!isSelected && !isGhost && isHovered && !isTouchDevice && (
        <>
          {/* Right edge ghost handle */}
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              right: -22,
              top: '25%',
              width: 44,
              height: '50%',
              minHeight: 44,
            }}
          >
            <div
              style={{
                width: 10,
                height: '45%',
                minHeight: 20,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.4,
              }}
            />
          </div>
          {/* Bottom edge ghost handle */}
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              bottom: -22,
              left: '25%',
              width: '50%',
              minWidth: 44,
              height: 44,
            }}
          >
            <div
              style={{
                width: '45%',
                minWidth: 20,
                height: 10,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.4,
              }}
            />
          </div>
          {/* SE corner ghost handle */}
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              right: -22,
              bottom: -22,
              width: 44,
              height: 44,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--selection-ring)',
                borderRadius: 'var(--radius-sm)',
                opacity: 0.4,
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

  // Callbacks are stable (from useCallback), so we don't compare them
  return true;
}

export const Bin = memo(BinComponent, binPropsAreEqual);
