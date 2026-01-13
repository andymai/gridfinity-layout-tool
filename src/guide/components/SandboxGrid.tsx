import type { PointerEvent } from 'react';
import { useRef, useCallback, useEffect } from 'react';
import type { SandboxState } from '../hooks/useSandboxState';
import { SandboxBin } from './SandboxBin';

/** Resize handle type */
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface SandboxGridProps {
  state: SandboxState;
  cellSize?: number;
  gap?: number;
  canDraw?: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  canDelete?: boolean;
  highlightCells?: Array<[number, number]>;
  onBinCreated?: (binId: string) => void;
  onBinSelected?: (binId: string | null) => void;
  onBinDeleted?: (binId: string) => void;
}

const DEFAULT_CELL_SIZE = 32;
const DEFAULT_GAP = 1;

/**
 * Simplified grid component for sandbox use.
 * Handles cell rendering and all pointer interactions.
 */
export function SandboxGrid({
  state,
  cellSize = DEFAULT_CELL_SIZE,
  gap = DEFAULT_GAP,
  canDraw = true,
  canDrag = true,
  canResize = true,
  canDelete = true,
  highlightCells = [],
  onBinCreated,
  onBinSelected,
  onBinDeleted,
}: SandboxGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const {
    bins,
    selectedBinId,
    interaction,
    categories,
    activeCategory,
    drawerSize,
    addBin,
    updateBin,
    deleteBin,
    selectBin,
    setInteraction,
    canPlaceBin,
  } = state;

  // Convert highlight cells to a Set for quick lookup
  const highlightSet = new Set(highlightCells.map(([x, y]) => `${x},${y}`));

  /**
   * Convert client coordinates to grid coordinates.
   */
  const getGridCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!gridRef.current) return null;
      const rect = gridRef.current.getBoundingClientRect();
      const relX = clientX - rect.left - gap;
      const relY = clientY - rect.top - gap;

      const x = Math.floor(relX / (cellSize + gap));
      const y = drawerSize.depth - 1 - Math.floor(relY / (cellSize + gap));

      if (x < 0 || x >= drawerSize.width || y < 0 || y >= drawerSize.depth) {
        return null;
      }
      return { x, y };
    },
    [cellSize, gap, drawerSize]
  );

  /**
   * Clamp coordinates to grid bounds.
   */
  const clampCoords = useCallback(
    (coords: { x: number; y: number }): { x: number; y: number } => ({
      x: Math.max(0, Math.min(drawerSize.width - 1, coords.x)),
      y: Math.max(0, Math.min(drawerSize.depth - 1, coords.y)),
    }),
    [drawerSize]
  );

  /**
   * Handle pointer down on grid (start drawing).
   */
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-bin-id]')) return;
      if (!canDraw) return;

      const coords = getGridCoords(e.clientX, e.clientY);
      if (!coords) return;

      e.preventDefault();
      selectBin(null);
      onBinSelected?.(null);

      setInteraction({
        type: 'draw',
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
    },
    [canDraw, getGridCoords, selectBin, setInteraction, onBinSelected]
  );

  /**
   * Start dragging a bin.
   */
  const handleStartDrag = useCallback(
    (binId: string, clientX: number, clientY: number) => {
      if (!canDrag) return;
      const bin = bins.find((b) => b.id === binId);
      if (!bin) return;

      const coords = getGridCoords(clientX, clientY);
      if (!coords) return;

      setInteraction({
        type: 'drag',
        binId,
        startX: coords.x,
        startY: coords.y,
        deltaX: 0,
        deltaY: 0,
      });
    },
    [canDrag, bins, getGridCoords, setInteraction]
  );

  /**
   * Start resizing a bin.
   */
  const handleStartResize = useCallback(
    (binId: string, handle: ResizeHandle) => {
      if (!canResize) return;
      const bin = bins.find((b) => b.id === binId);
      if (!bin) return;

      setInteraction({
        type: 'resize',
        binId,
        handle,
        startRect: { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth },
      });
    },
    [canResize, bins, setInteraction]
  );

  /**
   * Handle bin selection.
   */
  const handleSelectBin = useCallback(
    (binId: string) => {
      selectBin(binId);
      onBinSelected?.(binId);
    },
    [selectBin, onBinSelected]
  );

  /**
   * Handle bin deletion.
   */
  const handleDeleteBin = useCallback(
    (binId: string) => {
      if (!canDelete) return;
      deleteBin(binId);
      onBinDeleted?.(binId);
    },
    [canDelete, deleteBin, onBinDeleted]
  );

  // Document-level pointer tracking for draw/drag/resize
  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (e: PointerEvent | globalThis.PointerEvent) => {
      const coords = getGridCoords(e.clientX, e.clientY);
      if (!coords) return;
      const clamped = clampCoords(coords);

      if (interaction.type === 'draw') {
        setInteraction({
          ...interaction,
          currentX: clamped.x,
          currentY: clamped.y,
        });
      } else if (interaction.type === 'drag') {
        const bin = bins.find((b) => b.id === interaction.binId);
        if (!bin) return;

        // Calculate delta from start position
        const deltaX = clamped.x - interaction.startX;
        const deltaY = clamped.y - interaction.startY;

        // Constrain to keep bin in bounds
        const constrainedDeltaX = Math.max(-bin.x, Math.min(drawerSize.width - bin.x - bin.width, deltaX));
        const constrainedDeltaY = Math.max(-bin.y, Math.min(drawerSize.depth - bin.y - bin.depth, deltaY));

        setInteraction({
          ...interaction,
          deltaX: constrainedDeltaX,
          deltaY: constrainedDeltaY,
        });
      } else if (interaction.type === 'resize') {
        // Resize is handled by currentRect updates
        // (Would need to track current rect in interaction state for full implementation)
      }
    };

    const handlePointerUp = () => {
      if (interaction.type === 'draw') {
        const { startX, startY, currentX, currentY } = interaction;
        const x1 = Math.min(startX, currentX);
        const y1 = Math.min(startY, currentY);
        const x2 = Math.max(startX, currentX);
        const y2 = Math.max(startY, currentY);
        const width = x2 - x1 + 1;
        const depth = y2 - y1 + 1;

        const binId = addBin({
          x: x1,
          y: y1,
          width,
          depth,
          category: activeCategory,
        });

        if (binId) {
          selectBin(binId);
          onBinCreated?.(binId);
          onBinSelected?.(binId);
        }
      } else if (interaction.type === 'drag') {
        const bin = bins.find((b) => b.id === interaction.binId);
        if (bin && (interaction.deltaX !== 0 || interaction.deltaY !== 0)) {
          const newX = bin.x + interaction.deltaX;
          const newY = bin.y + interaction.deltaY;

          // Validate placement
          if (canPlaceBin({ x: newX, y: newY, width: bin.width, depth: bin.depth }, bin.id)) {
            updateBin(bin.id, { x: newX, y: newY });
          }
        }
      }

      setInteraction(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    interaction,
    bins,
    drawerSize,
    activeCategory,
    getGridCoords,
    clampCoords,
    addBin,
    updateBin,
    selectBin,
    setInteraction,
    canPlaceBin,
    onBinCreated,
    onBinSelected,
  ]);

  // Generate grid cells
  const cells = [];
  for (let row = 0; row < drawerSize.depth; row++) {
    for (let col = 0; col < drawerSize.width; col++) {
      // Convert from CSS row (top-down) to grid y (bottom-up)
      const gridY = drawerSize.depth - 1 - row;
      const isHighlighted = highlightSet.has(`${col},${gridY}`);

      cells.push(
        <div
          key={`${col}-${row}`}
          className={`rounded-sm transition-colors ${isHighlighted ? 'animate-pulse' : ''}`}
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
            width: cellSize,
            height: cellSize,
            backgroundColor: isHighlighted
              ? 'var(--color-accent, #22c55e)'
              : 'var(--grid-cell, #374151)',
            opacity: isHighlighted ? 0.6 : 1,
          }}
        />
      );
    }
  }

  // Calculate draw preview rectangle
  let drawPreview = null;
  if (interaction?.type === 'draw') {
    const { startX, startY, currentX, currentY } = interaction;
    const x1 = Math.min(startX, currentX);
    const y1 = Math.min(startY, currentY);
    const x2 = Math.max(startX, currentX);
    const y2 = Math.max(startY, currentY);
    const width = x2 - x1 + 1;
    const depth = y2 - y1 + 1;

    // Check if valid placement
    const isValid = canPlaceBin({ x: x1, y: y1, width, depth });

    // Convert to CSS grid position (row 1 at top)
    const gridCol = x1 + 1;
    const gridRow = drawerSize.depth - y2;

    const category = categories.find((c) => c.id === activeCategory);

    drawPreview = (
      <div
        className="pointer-events-none rounded"
        style={{
          gridColumn: `${gridCol} / span ${width}`,
          gridRow: `${gridRow} / span ${depth}`,
          width: width * cellSize + (width - 1) * gap,
          height: depth * cellSize + (depth - 1) * gap,
          backgroundColor: category?.color || '#6366f1',
          opacity: isValid ? 0.6 : 0.3,
          border: isValid ? '2px solid #fff' : '2px dashed #ef4444',
          zIndex: 50,
        }}
      />
    );
  }

  // Grid dimensions
  const gridWidth = drawerSize.width * cellSize + (drawerSize.width - 1) * gap + gap * 2;
  const gridHeight = drawerSize.depth * cellSize + (drawerSize.depth - 1) * gap + gap * 2;

  return (
    <div
      ref={gridRef}
      className="relative rounded-lg bg-surface-secondary overflow-hidden select-none"
      style={{
        width: gridWidth,
        height: gridHeight,
        cursor: canDraw ? 'crosshair' : 'default',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      data-testid="sandbox-grid"
    >
      {/* CSS Grid container */}
      <div
        className="absolute inset-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${drawerSize.width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${drawerSize.depth}, ${cellSize}px)`,
          gap: `${gap}px`,
          padding: `${gap}px`,
        }}
      >
        {/* Grid cells */}
        {cells}

        {/* Draw preview */}
        {drawPreview}

        {/* Bins */}
        {bins.map((bin) => {
          const category = categories.find((c) => c.id === bin.category);
          const isDragging = interaction?.type === 'drag' && interaction.binId === bin.id;
          const dragDelta = isDragging
            ? { x: interaction.deltaX, y: interaction.deltaY }
            : { x: 0, y: 0 };

          // Check if current drag position is valid
          let isValid = true;
          if (isDragging) {
            const newX = bin.x + dragDelta.x;
            const newY = bin.y + dragDelta.y;
            isValid = canPlaceBin({ x: newX, y: newY, width: bin.width, depth: bin.depth }, bin.id);
          }

          return (
            <SandboxBin
              key={bin.id}
              bin={bin}
              category={category}
              cellSize={cellSize}
              gap={gap}
              drawerDepth={drawerSize.depth}
              isSelected={selectedBinId === bin.id}
              isValid={isValid}
              isDragging={isDragging}
              dragDelta={dragDelta}
              onSelect={handleSelectBin}
              onStartDrag={handleStartDrag}
              onStartResize={handleStartResize}
              onDelete={canDelete ? handleDeleteBin : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export type { SandboxGridProps };
