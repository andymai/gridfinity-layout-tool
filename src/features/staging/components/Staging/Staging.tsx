import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useUndoableAction } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { BASE_CELL_SIZE, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getStagingBins } from '@/shared/utils';
import { ConfirmDialog } from '@/shared/components';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';
import type { BinId } from '@/core/types';
import { binId as toBinId } from '@/core/types';
import { isErr } from '@/core/result';
import { packBins } from '@/features/staging/utils/packing';
import {
  useStagingResize,
  MIN_STASH_HEIGHT,
  MAX_STASH_HEIGHT_VH,
} from '@/features/staging/hooks/useStagingResize';
import { useStagingLongPress } from '@/features/staging/hooks/useStagingLongPress';
import { StagingBin } from './StagingBin';

/** Default max height for the stash panel (33% of viewport) */
const DEFAULT_STASH_MAX_HEIGHT_VH = 33;

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
  const { selectedBinIds, setSelectedBin, toggleSelection } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBin: state.setSelectedBin,
      toggleSelection: state.toggleSelection,
    }))
  );

  const zoom = useViewStore((state) => state.zoom);
  const showContextMenu = useViewStore((state) => state.showContextMenu);

  const { interaction, setInteraction, dropTarget, setDropTarget } = useInteractionStore(
    useShallow((state) => ({
      interaction: state.interaction,
      setInteraction: state.setInteraction,
      dropTarget: state.dropTarget,
      setDropTarget: state.setDropTarget,
    }))
  );
  const { execute } = useUndoableAction();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBinId, setHoveredBinId] = useState<BinId | null>(null);
  const isTouchDevice = useResponsive().isTouchDevice;

  // Collapse state with persistence
  const lastStashCollapsed = useSettingsStore((state) => state.settings.lastStashCollapsed);
  const stashMaxHeight = useSettingsStore((state) => state.settings.stashMaxHeight);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const [isExpanded, setIsExpanded] = useState(() => !lastStashCollapsed);
  const [hasToggled, setHasToggled] = useState(false);
  const prevBinCountRef = useRef(-1); // -1 = not yet initialized

  // Refs shared with hooks
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Resize hook
  const {
    isResizing,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    handleResizeDoubleClick,
  } = useStagingResize({ scrollContainerRef, resizeHandleRef, updateSetting });

  // Long-press hook
  const {
    longPressTriggeredRef,
    startLongPress,
    handlePointerMove: handleLongPressPointerMove,
    handlePointerEnd: handleLongPressPointerEnd,
  } = useStagingLongPress({ isTouchDevice, showContextMenu });

  // Track container width for responsive stash grid (desktop only)
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const stagingBins = useMemo(() => getStagingBins(layout.bins), [layout.bins]);

  // Observe container width for responsive stash (desktop fills available space)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1;
  const padding = 32; // px-4 = 16px each side
  const drawerWidth = layout.drawer.width;

  // Calculate how many columns fit in the container (responsive width)
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
    return packBins(bins, gridCols);
  }, [stagingBins, gridCols]);

  // Calculate required grid height (minimum 2 rows when bins present, 1 when empty)
  const gridHeight = useMemo(() => {
    if (packedBins.length === 0) return 1;
    const maxY = Math.max(...packedBins.map((b) => b.y + b.depth));
    return Math.max(2, maxY);
  }, [packedBins]);

  const getCategory = (categoryId: string) => layout.categories.find((c) => c.id === categoryId);

  // --- Event handlers ---

  const handleBinClick = (rawBinId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    if (interaction?.type === 'stagingDrag') return;

    e.preventDefault();
    e.stopPropagation();

    const brandedBinId: BinId = toBinId(rawBinId);
    const isMultiSelectKey = e.ctrlKey || e.metaKey;
    if (isMultiSelectKey) {
      toggleSelection(brandedBinId);
    } else {
      setSelectedBin(brandedBinId);
    }
  };

  const handleBinPointerDown = (rawBinId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const brandedBinId: BinId = toBinId(rawBinId);
    startLongPress(brandedBinId, e.clientX, e.clientY);

    if (!selectedBinIds.includes(brandedBinId)) {
      setSelectedBin(brandedBinId);
    }

    if (!longPressTriggeredRef.current) {
      setInteraction({
        type: 'stagingDrag',
        binId: brandedBinId,
        currentCoord: null,
        valid: false,
      });
    }
  };

  const handleBinPointerMove = (e: React.PointerEvent) => {
    handleLongPressPointerMove(e.clientX, e.clientY);
  };

  const handleBinPointerEnd = () => {
    handleLongPressPointerEnd();
  };

  const handleBinContextMenu = (rawBinId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const brandedBinId: BinId = toBinId(rawBinId);
    if (!selectedBinIds.includes(brandedBinId)) {
      setSelectedBin(brandedBinId);
    }
    showContextMenu([brandedBinId], { x: e.clientX, y: e.clientY }, 'staging');
  };

  const handleRotate = useCallback(
    (rawBinId: string) => {
      const brandedBinId: BinId = toBinId(rawBinId);
      const bin = stagingBins.find((b) => b.id === brandedBinId);
      if (!bin) return;

      execute(() => {
        if (isErr(updateBin(brandedBinId, { width: bin.depth, depth: bin.width }))) return;
      });

      addToast(t('toast.binRotated'), 'success');
    },
    [stagingBins, execute, updateBin, addToast, t]
  );

  const handleClearStaging = () => {
    const count = stagingBins.length;

    if (stagingBins.length > 0) {
      mlTracking.trackDeletion(stagingBins[0], 'bulk', count);

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

  // --- Drag/drop state ---

  const isDraggingStagingBin = interaction?.type === 'stagingDrag';
  const isDraggingFromGrid = interaction?.type === 'drag';
  const draggingBinId = isDraggingStagingBin ? interaction.binId : null;
  const isDropTarget = dropTarget === 'staging';

  // Only show as drop target after actual pointer movement during drag
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
  useEffect(() => {
    if (showAsDropTarget && !isExpanded) {
      requestAnimationFrame(() => {
        setIsExpanded(true);
        setHasToggled(true);
      });
    }
  }, [showAsDropTarget, isExpanded]);

  // Auto-expand when bins first added to empty stash (but not on initial load)
  useEffect(() => {
    const currentCount = stagingBins.length;
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

  // --- Render ---

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
      {/* Resize handle at top */}
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

                return (
                  <StagingBin
                    key={bin.id}
                    bin={bin}
                    categoryColor={bgColor}
                    isSelected={selectedBinIds.includes(bin.id)}
                    isDragging={bin.id === draggingBinId}
                    isHovered={hoveredBinId === bin.id}
                    isTouchDevice={isTouchDevice}
                    cellSize={cellSize}
                    gap={gap}
                    gridHeight={gridHeight}
                    hasFractionalWidth={hasFractionalWidth}
                    integerWidth={integerWidth}
                    fractionalWidthPart={fractionalWidthPart}
                    fractionalCellWidth={fractionalCellWidth}
                    onBinClick={handleBinClick}
                    onBinPointerDown={handleBinPointerDown}
                    onBinPointerMove={handleBinPointerMove}
                    onBinPointerEnd={handleBinPointerEnd}
                    onBinContextMenu={handleBinContextMenu}
                    onPointerEnter={() => setHoveredBinId(bin.id)}
                    onPointerLeave={() => setHoveredBinId(null)}
                    onRotate={handleRotate}
                  />
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
