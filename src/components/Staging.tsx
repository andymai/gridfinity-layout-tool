import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../store';
import { useToastStore } from '../store/toast';
import { useResponsive } from '../hooks/useResponsive';
import { STAGING_ID, BASE_CELL_SIZE, DEFAULT_CATEGORY_COLOR } from '../constants';
import { getBinTextColors } from '../utils/color';
import { ConfirmDialog } from './modals/ConfirmDialog';

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
 * Auto-pack bins into staging grid (simple left-to-right, bottom-up packing)
 */
function packBins(bins: PackedBin[], gridWidth: number): PackedBin[] {
  if (bins.length === 0) return [];

  const packed: PackedBin[] = [];
  const occupied = new Set<string>();

  const isOccupied = (x: number, y: number, w: number, d: number): boolean => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  };

  const occupy = (x: number, y: number, w: number, d: number) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  };

  // Sort by area (largest first) for better packing
  const sortedBins = [...bins].sort((a, b) => (b.width * b.depth) - (a.width * a.depth));

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
  const { layout, deleteBin, updateBin } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      deleteBin: state.deleteBin,
      updateBin: state.updateBin,
    }))
  );
  const { zoom, interaction, setInteraction, dropTarget, setDropTarget, selectedBinIds, setSelectedBin, toggleSelection } = useUIStore(
    useShallow((state) => ({
      zoom: state.zoom,
      interaction: state.interaction,
      setInteraction: state.setInteraction,
      dropTarget: state.dropTarget,
      setDropTarget: state.setDropTarget,
      selectedBinIds: state.selectedBinIds,
      setSelectedBin: state.setSelectedBin,
      toggleSelection: state.toggleSelection,
    }))
  );
  const { execute } = useUndoableAction();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const addToast = useToastStore(state => state.addToast);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null);
  const isTouchDevice = useResponsive().isTouchDevice;

  const stagingBins = useMemo(() =>
    layout.bins.filter(bin => bin.layerId === STAGING_ID),
    [layout.bins]
  );

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1;
  const gridWidth = layout.drawer.width; // Match main drawer width

  // Pack bins and calculate required height
  const packedBins = useMemo(() => {
    const bins = stagingBins.map(b => ({
      id: b.id,
      x: 0,
      y: 0,
      width: b.width,
      depth: b.depth,
      height: b.height,
      category: b.category,
      label: b.label,
    }));
    return packBins(bins, gridWidth);
  }, [stagingBins, gridWidth]);

  // Calculate required grid height (minimum 2 rows when bins present, 1 when empty)
  const gridHeight = useMemo(() => {
    if (packedBins.length === 0) return 1;
    const maxY = Math.max(...packedBins.map(b => b.y + b.depth));
    return Math.max(2, maxY);
  }, [packedBins]);

  const getCategory = (categoryId: string) =>
    layout.categories.find(c => c.id === categoryId);

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

    // Ensure bin is selected before dragging (consistency with grid drag behavior)
    if (!selectedBinIds.includes(binId)) {
      setSelectedBin(binId);
    }

    setInteraction({
      type: 'stagingDrag',
      binId,
      currentCoord: null,
      valid: false,
    });
  };

  const handleRotate = useCallback((binId: string) => {
    const bin = stagingBins.find(b => b.id === binId);
    if (!bin) return;

    execute(() => {
      updateBin(binId, { width: bin.depth, depth: bin.width });
    });

    addToast('Bin rotated', 'success');
  }, [stagingBins, execute, updateBin, addToast]);

  const handleClearStaging = () => {
    const count = stagingBins.length;
    execute(() => {
      for (const bin of stagingBins) {
        deleteBin(bin.id);
      }
    });
    setShowClearConfirm(false);
    addToast(`Deleted ${count} stashed bins`, 'success');
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

  // Track pointer position to set drop target when hovering over stash
  useEffect(() => {
    if (!isDraggingFromGrid) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const isOver = e.clientX >= rect.left &&
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
  const cells: React.JSX.Element[] = [];
  for (let y = gridHeight - 1; y >= 0; y--) {
    for (let x = 0; x < gridWidth; x++) {
      cells.push(
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
  }

  // Show when bins are stashed OR when dragging from grid (as drop target)
  const hasBins = stagingBins.length > 0;
  if (!hasBins && !showAsDropTarget) {
    return null;
  }

  // Empty drop zone when dragging but no bins stashed
  if (!hasBins && showAsDropTarget) {
    return (
      <div
        ref={containerRef}
        className={`px-4 py-3 flex-shrink-0 border-t-2 border-dashed transition-colors ${
          isDropTarget
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface-secondary'
        }`}
      >
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-content-tertiary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span>{isDropTarget ? 'Drop to stash' : 'Drop here to stash'}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`px-4 py-3 flex-shrink-0 overflow-x-auto border-t-2 border-dashed transition-colors ${
        isDropTarget
          ? 'border-accent bg-accent/10'
          : 'border-stroke bg-surface-secondary'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2" title="Drag bins here to save them for later. Drag back to the grid to place.">
          <svg
            className="w-4 h-4 text-content-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm text-content-secondary font-medium">
            Stash
          </span>
          <span className="px-1.5 py-0.5 rounded text-xs bg-surface-hover text-content-tertiary">
            {stagingBins.length} {stagingBins.length === 1 ? 'bin' : 'bins'}
          </span>
        </div>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="btn btn-ghost flex items-center gap-1.5 p-[4px_8px] text-xs text-content-tertiary"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All
        </button>
      </div>

      {/* Staging Grid */}
      <div
        className="relative inline-block rounded-lg"
        style={{
          width: gridWidth * (cellSize + gap) + gap,
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
            gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
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
            const hasLabel = !!bin.label;
            const primaryText = hasLabel ? bin.label : `${bin.width}×${bin.depth}`;
            const secondaryText = hasLabel ? `${bin.width}×${bin.depth}` : null;

            return (
              <div
                key={bin.id}
                data-staging-bin-id={bin.id}
                className={`relative flex flex-col items-center justify-center transition-all duration-150 cursor-move rounded-sm z-10 touch-none ${
                  isDragging
                    ? 'bg-transparent border-2 border-dashed border-accent pointer-events-none'
                    : isSelected
                      ? 'border border-[var(--border-on-color)] shadow-sm ring-2 ring-selection-ring'
                      : 'border border-[var(--border-on-color)] shadow-sm'
                }`}
                style={{
                  gridColumn: `${bin.x + 1} / span ${bin.width}`,
                  gridRow: `${gridHeight - bin.y - bin.depth + 1} / span ${bin.depth}`,
                  ...(!isDragging && { backgroundColor: bgColor }),
                }}
                onClick={(e) => handleBinClick(bin.id, e)}
                onPointerDown={(e) => handleBinPointerDown(bin.id, e)}
                onPointerEnter={() => setHoveredBinId(bin.id)}
                onPointerLeave={() => setHoveredBinId(null)}
                title={`${bin.label || 'Unlabeled'} — ${bin.width}×${bin.depth}×${bin.height}u\nClick to select • Drag to place on grid`}
              >
                {/* Adaptive label: primary (label or dimensions) + optional secondary */}
                {!isDragging && (
                  <div className="text-center pointer-events-none select-none overflow-hidden max-w-[95%]">
                    <div
                      className="text-sm truncate"
                      style={{
                        color: textColors.primary,
                        fontWeight: hasLabel ? 500 : 600,
                        textShadow: `0 1px 2px ${textColors.shadow}`,
                      }}
                    >
                      {primaryText}
                    </div>
                    {secondaryText && (
                      <div
                        className="text-xs"
                        style={{
                          color: textColors.secondary,
                          textShadow: `0 1px 1px ${textColors.shadow}`,
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
                    title="Rotate bin (R)"
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
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Stash"
        message={`Delete all ${stagingBins.length} stashed bins? This cannot be undone.`}
        confirmText="Clear All"
        destructive
        onConfirm={handleClearStaging}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
