import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { STAGING_ID, BASE_CELL_SIZE, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getBinTextColors, clamp } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';

/** Default max height for the stash panel (33% of viewport) */
const DEFAULT_STASH_MAX_HEIGHT_VH = 33;
/** Minimum height in pixels the stash can be resized to */
const MIN_STASH_HEIGHT = 80;
/** Maximum height in pixels (90% of viewport) */
const MAX_STASH_HEIGHT_VH = 90;
/** Long-press duration for context menu on touch devices (ms) */
const LONG_PRESS_DURATION = 500;
/** Movement threshold to cancel long-press (px) */
const MOVEMENT_THRESHOLD = 10;

/** Format dimension for display - show decimal only if fractional */
const formatDim = (val: number): string => (val % 1 === 0 ? val.toString() : val.toFixed(1));

interface PackedBin {
  id: string;
  x: number; // Position in staging grid
  y: number;
  width: number;
  depth: number;
  height: number;
  category: string;
  label: string;
}

/**
 * Create cluster key for grouping similar bins.
 * Bins with same category and same floored dimensions share a key.
 * Using floor() means 2.0 and 2.9 cluster together (both floor to 2),
 * but 1.9 (floors to 1) goes in a different cluster.
 */
function getClusterKey(bin: PackedBin): string {
  return `${bin.category}_${Math.floor(bin.width)}_${Math.floor(bin.depth)}`;
}

/**
 * Group bins into clusters by category + floored dimensions, ordered by cluster size.
 * Within each cluster, bins are sorted by area (largest first) for better packing.
 *
 * This improves stash organization by keeping similar bins together:
 * - All 2×3 "Electronics" bins cluster together (2.1×3.5 included, but not 3×2)
 * - All 1×1 "Hardware" bins cluster together
 * - Largest clusters appear first (bottom-left of stash)
 */
function clusterBins(bins: PackedBin[]): PackedBin[] {
  if (bins.length === 0) return [];

  // Group by cluster key (category + floored dimensions)
  const clusters = new Map<string, PackedBin[]>();
  for (const bin of bins) {
    const key = getClusterKey(bin);
    const existing = clusters.get(key);
    if (existing) existing.push(bin);
    else clusters.set(key, [bin]);
  }

  // Sort clusters by size (most bins first), then by key for stability
  // Within each cluster, sort by area (largest first) for better packing
  return Array.from(clusters.values())
    .sort((a, b) => b.length - a.length || getClusterKey(a[0]).localeCompare(getClusterKey(b[0])))
    .flatMap((cluster) => cluster.sort((a, b) => b.width * b.depth - a.width * a.depth));
}

/**
 * Auto-pack bins into staging grid (simple left-to-right, bottom-up packing)
 */
function packBins(bins: PackedBin[], gridWidth: number): PackedBin[] {
  if (bins.length === 0) return [];

  const packed: PackedBin[] = [];
  const occupied = new Set<string>();

  const isOccupied = (x: number, y: number, w: number, d: number): boolean => {
    const ceilW = Math.ceil(w) || 1;
    const ceilD = Math.ceil(d) || 1;
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);
    for (let dx = 0; dx < ceilW; dx++) {
      for (let dy = 0; dy < ceilD; dy++) {
        if (occupied.has(`${baseX + dx},${baseY + dy}`)) return true;
      }
    }
    return false;
  };

  const occupy = (x: number, y: number, w: number, d: number): void => {
    const ceilW = Math.ceil(w) || 1;
    const ceilD = Math.ceil(d) || 1;
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);
    for (let dx = 0; dx < ceilW; dx++) {
      for (let dy = 0; dy < ceilD; dy++) {
        occupied.add(`${baseX + dx},${baseY + dy}`);
      }
    }
  };

  // Cluster by category + similar size, then sort within clusters by area
  const sortedBins = clusterBins(bins);

  for (const bin of sortedBins) {
    let placed = false;
    // Try to place at each position, scanning left-to-right, bottom-to-top
    for (let y = 0; y < 50 && !placed; y++) {
      for (let x = 0; x <= gridWidth - bin.width && !placed; x++) {
        if (!isOccupied(x, y, bin.width, bin.depth)) {
          packed.push({ ...bin, x, y });
          occupy(x, y, bin.width, bin.depth);
          placed = true;
        }
      }
    }
  }

  return packed;
}

/**
 * Staging area with grid visualization for temporarily holding bins.
 * Bins are displayed at actual scale, matching the main grid.
 */
export function Staging() {
  const t = useTranslation();
  const { layout, deleteBin, updateBin } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      deleteBin: state.deleteBin,
      updateBin: state.updateBin,
    }))
  );
  const {
    zoom,
    interaction,
    setInteraction,
    dropTarget,
    setDropTarget,
    selectedBinIds,
    setSelectedBin,
    toggleSelection,
    showLabels,
    showContextMenu,
  } = useUIStore(
    useShallow((state) => ({
      zoom: state.zoom,
      interaction: state.interaction,
      setInteraction: state.setInteraction,
      dropTarget: state.dropTarget,
      setDropTarget: state.setDropTarget,
      selectedBinIds: state.selectedBinIds,
      setSelectedBin: state.setSelectedBin,
      toggleSelection: state.toggleSelection,
      showLabels: state.showLabels,
      showContextMenu: state.showContextMenu,
    }))
  );
  const { execute } = useUndoableAction();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null);
  const isTouchDevice = useResponsive().isTouchDevice;

  // Collapse state with persistence
  // Use lazy initializer to read from settings store on first render
  const lastStashCollapsed = useSettingsStore((state) => state.settings.lastStashCollapsed);
  const stashMaxHeight = useSettingsStore((state) => state.settings.stashMaxHeight);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const [isExpanded, setIsExpanded] = useState(() => !lastStashCollapsed);
  const [hasToggled, setHasToggled] = useState(false);
  const prevBinCountRef = useRef(-1); // -1 = not yet initialized

  // Resize state for draggable height adjustment
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const capturedPointerIdRef = useRef<number | null>(null);

  // Track container width for responsive stash grid (desktop only)
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Long-press detection state for context menu
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const stagingBins = useMemo(
    () => layout.bins.filter((bin) => bin.layerId === STAGING_ID),
    [layout.bins]
  );

  // Observe container width for responsive stash (desktop fills available space)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // contentRect.width is inner width (excluding padding)
        // Padding is subtracted in the column calculation below
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1;
  const padding = 32; // px-4 = 16px each side
  const drawerWidth = layout.drawer.width;

  // Calculate how many columns fit in the container (responsive width)
  // Use max of drawer width and available space for better horizontal utilization
  const availableCols = containerWidth
    ? Math.floor((containerWidth - padding - gap) / (cellSize + gap))
    : drawerWidth;
  const gridWidth = Math.max(drawerWidth, availableCols);
  const integerWidth = Math.floor(gridWidth);
  const hasFractionalWidth = gridWidth % 1 !== 0;
  const fractionalWidthPart = gridWidth - integerWidth;
  const fractionalCellWidth = hasFractionalWidth ? fractionalWidthPart * (cellSize + gap) - gap : 0;
  const gridCols = Math.ceil(gridWidth);

  // Pack bins and calculate required height
  // Use ceiling of fractional dimensions for packing slots
  const packedBins = useMemo(() => {
    const bins = stagingBins.map((b) => ({
      id: b.id,
      x: 0,
      y: 0,
      width: b.width,
      depth: b.depth,
      height: b.height,
      category: b.category,
      label: b.label,
    }));
    // Pack using integer grid width (ceiling) to ensure all bins fit
    return packBins(bins, gridCols);
  }, [stagingBins, gridCols]);

  // Calculate required grid height (minimum 2 rows when bins present, 1 when empty)
  const gridHeight = useMemo(() => {
    if (packedBins.length === 0) return 1;
    const maxY = Math.max(...packedBins.map((b) => b.y + b.depth));
    return Math.max(2, maxY);
  }, [packedBins]);

  const getCategory = (categoryId: string) => layout.categories.find((c) => c.id === categoryId);

  const handleBinClick = (binId: string, e: React.MouseEvent) => {
    // Don't select if we're in the middle of a drag
    if (interaction?.type === 'stagingDrag') return;

    e.preventDefault();
    e.stopPropagation();

    const isMultiSelectKey = e.ctrlKey || e.metaKey;
    if (isMultiSelectKey) {
      toggleSelection(binId);
    } else {
      setSelectedBin(binId);
    }
  };

  const handleBinPointerDown = (binId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Reset long-press state
    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    // Start long-press timer on touch devices
    if (isTouchDevice) {
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        // Vibrate if supported (haptic feedback)
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        // Show context menu
        showContextMenu([binId], { x: e.clientX, y: e.clientY }, 'staging');
      }, LONG_PRESS_DURATION);
    }

    // Ensure bin is selected before dragging (consistency with grid drag behavior)
    if (!selectedBinIds.includes(binId)) {
      setSelectedBin(binId);
    }

    // Don't start drag if long-press menu triggered
    if (!longPressTriggeredRef.current) {
      setInteraction({
        type: 'stagingDrag',
        binId,
        currentCoord: null,
        valid: false,
      });
    }
  };

  const handleBinPointerMove = (e: React.PointerEvent) => {
    // Cancel long-press if pointer moved too far
    if (pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > MOVEMENT_THRESHOLD) {
        clearLongPress();
      }
    }
  };

  const handleBinPointerEnd = () => {
    clearLongPress();
    pointerStartRef.current = null;
  };

  const handleBinContextMenu = (binId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Select the bin if not already selected
    if (!selectedBinIds.includes(binId)) {
      setSelectedBin(binId);
    }
    showContextMenu([binId], { x: e.clientX, y: e.clientY }, 'staging');
  };

  const handleRotate = useCallback(
    (binId: string) => {
      const bin = stagingBins.find((b) => b.id === binId);
      if (!bin) return;

      execute(() => {
        updateBin(binId, { width: bin.depth, depth: bin.width });
      });

      addToast(t('toast.binRotated'), 'success');
    },
    [stagingBins, execute, updateBin, addToast, t]
  );

  const handleClearStaging = () => {
    const count = stagingBins.length;

    // Track deletion BEFORE executing (need bin data)
    if (stagingBins.length > 0) {
      mlTracking.trackDeletion(stagingBins[0], 'bulk', count);

      // Track quick corrections for each deleted bin
      for (const bin of stagingBins) {
        mlTracking.trackQuickCorrect('delete', bin.id, bin);
      }
    }

    execute(() => {
      for (const bin of stagingBins) {
        deleteBin(bin.id);
      }
    });
    setShowClearConfirm(false);
    addToast(t('toast.stashCleared', { count }), 'success');
  };

  const isDraggingStagingBin = interaction?.type === 'stagingDrag';
  const isDraggingFromGrid = interaction?.type === 'drag';
  const draggingBinId = isDraggingStagingBin ? interaction.binId : null;
  const isDropTarget = dropTarget === 'staging';

  // Only show as drop target after actual pointer movement during drag.
  // On desktop, drag interaction starts immediately on pointerDown, but we only
  // want to show the stash drop target when the user actually starts moving.
  const [hasMoved, setHasMoved] = useState(false);
  useEffect(() => {
    if (!isDraggingFromGrid) return;

    const handleMove = () => setHasMoved(true);
    document.addEventListener('pointermove', handleMove, { once: true });
    return () => {
      document.removeEventListener('pointermove', handleMove);
      setHasMoved(false);
    };
  }, [isDraggingFromGrid]);

  const showAsDropTarget = isDraggingFromGrid && hasMoved;

  // Auto-expand when dragging from grid (so user sees drop target)
  // Use requestAnimationFrame to defer state update and avoid cascading renders
  useEffect(() => {
    if (showAsDropTarget && !isExpanded) {
      requestAnimationFrame(() => {
        setIsExpanded(true);
        setHasToggled(true);
      });
    }
  }, [showAsDropTarget, isExpanded]);

  // Auto-expand when bins first added to empty stash (but not on initial load)
  // Use requestAnimationFrame to defer state update and avoid cascading renders
  useEffect(() => {
    const currentCount = stagingBins.length;
    // Skip auto-expand on initial mount - only trigger on actual 0->N transitions during session
    // prevBinCountRef.current === -1 indicates not yet initialized
    if (prevBinCountRef.current === -1) {
      prevBinCountRef.current = currentCount;
      return;
    }
    if (currentCount > 0 && prevBinCountRef.current === 0 && !isExpanded) {
      requestAnimationFrame(() => {
        setIsExpanded(true);
        setHasToggled(true);
      });
    }
    prevBinCountRef.current = currentCount;
  }, [stagingBins.length, isExpanded]);

  // Toggle handler that persists to settings
  const handleToggleExpand = useCallback(() => {
    setHasToggled(true);
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    updateSetting('lastStashCollapsed', !newExpanded);
  }, [isExpanded, updateSetting]);

  // Resize handlers for draggable height adjustment
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use the resize handle ref for consistent pointer capture
    const handle = resizeHandleRef.current;
    if (!handle) return;
    handle.setPointerCapture(e.pointerId);
    capturedPointerIdRef.current = e.pointerId;
    setIsResizing(true);
    // Get current scroll container height
    const currentHeight = scrollContainerRef.current?.offsetHeight ?? 200;
    resizeStartRef.current = { y: e.clientY, height: currentHeight };
  }, []);

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing || !resizeStartRef.current) return;
      e.preventDefault();
      // Dragging up (negative dy) increases height
      const dy = resizeStartRef.current.y - e.clientY;
      const maxHeight = window.innerHeight * (MAX_STASH_HEIGHT_VH / 100);
      const newHeight = clamp(resizeStartRef.current.height + dy, MIN_STASH_HEIGHT, maxHeight);
      // Apply immediately for smooth feedback
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.maxHeight = `${newHeight}px`;
      }
    },
    [isResizing]
  );

  const handleResizePointerUp = useCallback(() => {
    if (!isResizing) return;
    // Release pointer capture on the same element that captured it
    const handle = resizeHandleRef.current;
    if (handle && capturedPointerIdRef.current !== null) {
      handle.releasePointerCapture(capturedPointerIdRef.current);
    }
    capturedPointerIdRef.current = null;
    setIsResizing(false);
    // Persist the final height
    if (scrollContainerRef.current) {
      const finalHeight = scrollContainerRef.current.offsetHeight;
      updateSetting('stashMaxHeight', finalHeight);
    }
    resizeStartRef.current = null;
  }, [isResizing, updateSetting]);

  // Double-click resets to default height (33vh)
  const handleResizeDoubleClick = useCallback(() => {
    updateSetting('stashMaxHeight', null);
    // Also reset inline style if it was set during resize
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.maxHeight = '';
    }
  }, [updateSetting]);

  const scrollContainerMaxHeight =
    stashMaxHeight !== null ? `${stashMaxHeight}px` : `${DEFAULT_STASH_MAX_HEIGHT_VH}vh`;

  // Track pointer position to set drop target when hovering over stash
  useEffect(() => {
    if (!isDraggingFromGrid) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const isOver =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (isOver && dropTarget !== 'staging') {
        setDropTarget('staging');
      } else if (!isOver && dropTarget === 'staging') {
        setDropTarget(null);
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [isDraggingFromGrid, dropTarget, setDropTarget]);

  // Generate grid cells for visual reference
  const cells = useMemo(() => {
    const result: React.JSX.Element[] = [];
    for (let y = gridHeight - 1; y >= 0; y--) {
      for (let x = 0; x < integerWidth; x++) {
        result.push(
          <div
            key={`staging-${x}-${y}`}
            style={{
              gridColumn: x + 1,
              gridRow: gridHeight - y,
              width: cellSize,
              height: cellSize,
              backgroundColor: 'var(--staging-cell)',
              borderRadius: '2px',
            }}
          />
        );
      }
      // Add fractional column cell for this row if drawer has fractional width
      if (hasFractionalWidth) {
        result.push(
          <div
            key={`staging-frac-${y}`}
            style={{
              gridColumn: gridCols,
              gridRow: gridHeight - y,
              width: fractionalCellWidth,
              height: cellSize,
              backgroundColor: 'var(--staging-cell)',
              borderRadius: '2px',
            }}
          />
        );
      }
    }
    return result;
  }, [gridHeight, integerWidth, cellSize, hasFractionalWidth, gridCols, fractionalCellWidth]);

  // Helper to calculate pixel width for bins accounting for fractional column
  const calcBinPixelWidth = (x: number, width: number): number => {
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
  };

  // Helper to calculate pixel height for bins with fractional depth
  const calcBinPixelHeight = (depth: number): number => {
    // For fractional depth, calculate proportional height
    // A 0.5 depth bin = 0.5 * cellSize (no gaps since it doesn't span multiple cells)
    // A 1.5 depth bin = 1 * cellSize + gap + 0.5 * cellSize
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
  };

  // Show when bins are stashed OR when dragging from grid (as drop target)
  const hasBins = stagingBins.length > 0;
  if (!hasBins && !showAsDropTarget) {
    return null;
  }

  // Empty drop zone when dragging but no bins stashed
  if (!hasBins && showAsDropTarget) {
    return (
      <div
        data-stash
        ref={containerRef}
        className={`px-4 py-3 flex-shrink-0 border-t-2 border-dashed transition-colors ${
          isDropTarget ? 'border-accent bg-accent/10' : 'border-stroke bg-surface-secondary'
        }`}
      >
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-content-tertiary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span>{isDropTarget ? t('staging.dropToStash') : t('staging.dropHereToStash')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-stash
      ref={containerRef}
      className={`flex-shrink-0 transition-colors ${
        isDropTarget ? 'border-accent bg-accent/10' : 'border-stroke bg-surface-secondary'
      }`}
    >
      {/* Resize handle at top - draggable to adjust max height, double-click to reset */}
      <div
        ref={resizeHandleRef}
        data-testid="stash-resize-handle"
        className={`h-2 cursor-ns-resize flex items-center justify-center border-t-2 border-dashed transition-colors group ${
          isDropTarget ? 'border-accent' : 'border-stroke hover:border-accent/50'
        }`}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        onDoubleClick={handleResizeDoubleClick}
        title={t('staging.resizeHandle')}
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('staging.resizeHandle')}
        aria-valuenow={
          stashMaxHeight ?? Math.round(window.innerHeight * (DEFAULT_STASH_MAX_HEIGHT_VH / 100))
        }
        aria-valuemin={MIN_STASH_HEIGHT}
        aria-valuemax={Math.round(window.innerHeight * (MAX_STASH_HEIGHT_VH / 100))}
      >
        {/* Visual grip indicator */}
        <div
          className={`w-12 h-1 rounded-full transition-all ${
            isResizing
              ? 'bg-accent scale-110'
              : 'bg-content-disabled group-hover:bg-accent/60 group-hover:scale-105'
          }`}
        />
      </div>

      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-4 pt-2 pb-2">
        <button
          type="button"
          className="flex items-center gap-2 bg-transparent rounded hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-accent"
          onClick={handleToggleExpand}
          aria-expanded={isExpanded}
          aria-controls="staging-stash-panel"
          title={isExpanded ? t('staging.collapseStash') : t('staging.expandStash')}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 text-content-tertiary ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <svg
            className="w-4 h-4 text-content-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span className="text-sm text-content-secondary font-medium">{t('staging.stash')}</span>
          <span className="px-1.5 py-0.5 rounded text-xs bg-surface-hover text-content-tertiary">
            {t('staging.binCount', { count: stagingBins.length })}
          </span>
        </button>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="btn btn-ghost flex items-center gap-1.5 px-2 py-1.5 text-xs text-content-tertiary"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {t('staging.clearAll')}
        </button>
      </div>

      {/* Collapsible staging grid content */}
      <div
        id="staging-stash-panel"
        className={`overflow-hidden ${hasToggled ? 'transition-all duration-200' : ''} ${
          isExpanded ? 'opacity-100' : 'opacity-0 max-h-0'
        }`}
      >
        {/* Scrollable container with user-adjustable max height */}
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto overflow-x-auto scrollbar-thin px-4 pb-3"
          style={{
            maxHeight: isExpanded ? scrollContainerMaxHeight : 0,
          }}
        >
          {/* Staging Grid */}
          <div
            className="relative inline-block rounded-lg"
            style={{
              // Width: integer columns + optional fractional column + gaps + padding
              width:
                integerWidth * (cellSize + gap) +
                (hasFractionalWidth ? fractionalCellWidth + gap : 0) +
                gap,
              height: gridHeight * (cellSize + gap) + gap,
              backgroundColor: 'var(--staging-bg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* CSS Grid container */}
            <div
              className="absolute inset-0"
              style={{
                display: 'grid',
                gridTemplateColumns: hasFractionalWidth
                  ? `repeat(${integerWidth}, ${cellSize}px) ${fractionalCellWidth}px`
                  : `repeat(${integerWidth}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${gridHeight}, ${cellSize}px)`,
                gap: `${gap}px`,
                padding: `${gap}px`,
              }}
            >
              {/* Grid cells */}
              {cells}

              {/* Staged bins */}
              {packedBins.map((bin) => {
                const category = getCategory(bin.category);
                const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
                const textColors = getBinTextColors(bgColor);
                const isDragging = bin.id === draggingBinId;
                const isSelected = selectedBinIds.includes(bin.id);

                // Check if bin has fractional dimensions
                const hasFractionalBin = bin.width % 1 !== 0 || bin.depth % 1 !== 0;
                // Calculate CSS grid span (use ceiling for fractional bins)
                const gridColSpan = Math.ceil(bin.x + bin.width) - Math.floor(bin.x);
                const gridRowSpan = Math.ceil(bin.y + bin.depth) - Math.floor(bin.y);

                // Always calculate pixel dimensions for adaptive label sizing
                const actualBinPixelWidth =
                  hasFractionalBin || hasFractionalWidth
                    ? calcBinPixelWidth(bin.x, bin.width)
                    : bin.width * cellSize + Math.max(0, bin.width - 1) * gap;
                const actualBinPixelHeight = hasFractionalBin
                  ? calcBinPixelHeight(bin.depth)
                  : bin.depth * cellSize + Math.max(0, bin.depth - 1) * gap;

                // Only override CSS grid sizing for fractional bins
                const cssWidthOverride =
                  hasFractionalBin || hasFractionalWidth ? actualBinPixelWidth : undefined;
                const cssHeightOverride = hasFractionalBin ? actualBinPixelHeight : undefined;

                // Calculate grid row start (must be integer for valid CSS Grid)
                const gridRowStart = gridHeight - Math.ceil(bin.y + bin.depth) + 1;

                // ========== ADAPTIVE LABEL SYSTEM (matches Grid/Bin.tsx) ==========
                const dimensionsText = `${formatDim(bin.width)}×${formatDim(bin.depth)}`;
                const hasLabel = showLabels && bin.label;

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
                const rawAvailableHeight = shouldRotate
                  ? actualBinPixelWidth
                  : actualBinPixelHeight;
                const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

                // Show label if it fits, otherwise show dimensions
                const showLabel = hasLabel && labelFits;
                const primaryText = showLabel && bin.label ? bin.label : dimensionsText;
                const secondaryText = showLabel && hasSpaceForSecondary ? dimensionsText : null;

                // Letter-spacing for small text
                const letterSpacing = primaryFontSize < 11 ? '0.02em' : 'normal';

                // Elevate z-index when hovered/selected so rotate button appears above other bins
                const isElevated = hoveredBinId === bin.id || isSelected;

                return (
                  <div
                    key={bin.id}
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
                      ...(!isDragging && { backgroundColor: bgColor }),
                      // Override size for fractional bins
                      ...(cssWidthOverride !== undefined && { width: cssWidthOverride }),
                      ...(cssHeightOverride !== undefined && { height: cssHeightOverride }),
                    }}
                    onClick={(e) => handleBinClick(bin.id, e)}
                    onPointerDown={(e) => handleBinPointerDown(bin.id, e)}
                    onPointerMove={handleBinPointerMove}
                    onPointerUp={handleBinPointerEnd}
                    onPointerCancel={handleBinPointerEnd}
                    onContextMenu={(e) => handleBinContextMenu(bin.id, e)}
                    onPointerEnter={() => setHoveredBinId(bin.id)}
                    onPointerLeave={() => setHoveredBinId(null)}
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
                    {!isTouchDevice && !isDragging && (hoveredBinId === bin.id || isSelected) && (
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
                          handleRotate(bin.id);
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
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title={t('staging.clearStash.title')}
        message={t('staging.clearStash.message', { count: stagingBins.length })}
        confirmText={t('staging.clearStash.confirm')}
        destructive
        onConfirm={handleClearStaging}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
