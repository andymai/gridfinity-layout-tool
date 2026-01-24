/**
 * Visual compartment grid editor.
 *
 * Displays a top-down 2D view of the bin interior divided into a user-defined
 * grid. Users can:
 * 1. Set grid dimensions (rows × cols) via stepper controls
 * 2. Click-drag to select a rectangular region of cells
 * 3. Merge selected cells into one compartment (or split merged ones)
 *
 * The grid uses a cell-ownership model: cells with the same compartment ID
 * form one rectangular compartment. Divider walls are automatically derived
 * from boundaries between cells with different IDs.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { StepperControl } from '@/shared/components/StepperControl';
import { ThicknessSelector } from './controls/ThicknessSelector';
import { getCompartmentCount, isRectangularSelection, cellIndex } from '../utils/compartments';
import type { CompartmentConfig } from '../types';

// =============================================================================
// Color palette for compartment visualization
// =============================================================================

/** Saturated, distinct colors for compartment fills */
const COMPARTMENT_COLORS = [
  '#dbeafe', // blue-100
  '#d1fae5', // emerald-100
  '#fef3c7', // amber-100
  '#ede9fe', // violet-100
  '#ffe4e6', // rose-100
  '#cffafe', // cyan-100
  '#ffedd5', // orange-100
  '#e0e7ff', // indigo-100
] as const;

/** Darker border colors matching compartment fills */
const COMPARTMENT_BORDER_COLORS = [
  '#93c5fd', // blue-300
  '#6ee7b7', // emerald-300
  '#fcd34d', // amber-300
  '#c4b5fd', // violet-300
  '#fda4af', // rose-300
  '#67e8f9', // cyan-300
  '#fdba74', // orange-300
  '#a5b4fc', // indigo-300
] as const;

function getCompartmentFill(id: number): string {
  return COMPARTMENT_COLORS[id % COMPARTMENT_COLORS.length];
}

function getCompartmentBorder(id: number): string {
  return COMPARTMENT_BORDER_COLORS[id % COMPARTMENT_BORDER_COLORS.length];
}

// =============================================================================
// CompartmentEditor Component
// =============================================================================

export function CompartmentEditor() {
  const { compartments, width, depth, setParam, setCompartmentGrid, mergeCells, splitCompartment } =
    useDesignerStore(
      useShallow((s) => ({
        compartments: s.params.compartments,
        width: s.params.width,
        depth: s.params.depth,
        setParam: s.setParam,
        setCompartmentGrid: s.setCompartmentGrid,
        mergeCells: s.mergeCells,
        splitCompartment: s.splitCompartment,
      }))
    );

  const { cols, rows, thickness, cells } = compartments;

  // Selection state for drag-to-merge
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Compute selection rectangle from drag start to current cell
  const computeRectSelection = useCallback(
    (startIdx: number, endIdx: number): Set<number> => {
      const startCol = startIdx % cols;
      const startRow = Math.floor(startIdx / cols);
      const endCol = endIdx % cols;
      const endRow = Math.floor(endIdx / cols);

      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);

      const selected = new Set<number>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          selected.add(cellIndex(cols, c, r));
        }
      }
      return selected;
    },
    [cols]
  );

  // Determine what action the current selection will trigger
  const selectionAction = useMemo((): 'merge' | 'split' | 'none' => {
    if (selection.size < 2) return 'none';
    const indices = [...selection];
    if (!isRectangularSelection(cols, indices)) return 'none';
    const selectedIds = new Set(indices.map((i) => cells[i]));
    return selectedIds.size === 1 ? 'split' : 'merge';
  }, [selection, cols, cells]);

  const handleCellPointerDown = useCallback((idx: number) => {
    setDragStart(idx);
    setIsDragging(true);
    setSelection(new Set([idx]));
  }, []);

  const handleCellPointerEnter = useCallback(
    (idx: number) => {
      setHoverIdx(idx);
      if (!isDragging || dragStart === null) return;
      setSelection(computeRectSelection(dragStart, idx));
    },
    [isDragging, dragStart, computeRectSelection]
  );

  const handleCellPointerLeave = useCallback(() => {
    setHoverIdx(null);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragStart(null);

    if (selection.size >= 2) {
      const indices = [...selection];
      if (isRectangularSelection(cols, indices)) {
        // Check if all selected cells already belong to the same compartment
        const selectedIds = new Set(indices.map((i) => cells[i]));
        if (selectedIds.size === 1) {
          // All same compartment — split it instead
          splitCompartment(cells[indices[0]]);
        } else {
          // Different compartments — merge them
          mergeCells(indices);
        }
      }
    } else if (selection.size === 1) {
      // Single cell click: if it's part of a multi-cell compartment, split it
      const idx = [...selection][0];
      const compartmentId = cells[idx];
      const cellsInCompartment = cells.filter((c) => c === compartmentId).length;
      if (cellsInCompartment > 1) {
        splitCompartment(compartmentId);
      }
    }

    setSelection(new Set());
  }, [isDragging, selection, cols, cells, mergeCells, splitCompartment]);

  const handleColsChange = useCallback(
    (newCols: number) => {
      setCompartmentGrid(newCols, rows);
      setSelection(new Set());
    },
    [rows, setCompartmentGrid]
  );

  const handleColsStep = useCallback(
    (delta: number) => {
      const next = cols + delta;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID, next)
      );
      setCompartmentGrid(clamped, rows);
      setSelection(new Set());
    },
    [cols, rows, setCompartmentGrid]
  );

  const handleRowsChange = useCallback(
    (newRows: number) => {
      setCompartmentGrid(cols, newRows);
      setSelection(new Set());
    },
    [cols, setCompartmentGrid]
  );

  const handleRowsStep = useCallback(
    (delta: number) => {
      const next = rows + delta;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID, next)
      );
      setCompartmentGrid(cols, clamped);
      setSelection(new Set());
    },
    [cols, rows, setCompartmentGrid]
  );

  const handleThicknessChange = useCallback(
    (newThickness: number) => {
      setParam('compartments', { ...compartments, thickness: newThickness });
    },
    [compartments, setParam]
  );

  const handleReset = useCallback(() => {
    setCompartmentGrid(cols, rows);
    setSelection(new Set());
  }, [cols, rows, setCompartmentGrid]);

  const compartmentCount = getCompartmentCount(compartments);
  const hasMergedCompartments = compartmentCount < cols * rows;

  // Check if hovered cell is in a multi-cell compartment (splittable)
  const hoveredIsSplittable = useMemo(() => {
    if (hoverIdx === null || isDragging) return false;
    const cId = cells[hoverIdx];
    return cells.filter((c) => c === cId).length > 1;
  }, [hoverIdx, cells, isDragging]);

  // Dynamic instruction text
  const instructionText = useMemo(() => {
    if (isDragging && selection.size >= 2) {
      if (selectionAction === 'merge') return `Release to merge ${selection.size} cells`;
      if (selectionAction === 'split') return 'Release to split compartment';
      return 'Drag to select a rectangle';
    }
    if (hoveredIsSplittable && !isDragging) {
      return 'Click to split this compartment';
    }
    return 'Drag to merge cells. Click a compartment to split.';
  }, [isDragging, selection.size, selectionAction, hoveredIsSplittable]);

  // Compute aspect ratio from bin dimensions, clamped to avoid extreme shapes
  const aspectRatio = Math.min(2, Math.max(0.5, width / depth));

  return (
    <div>
      <div>
        <div className="space-y-5">
          {/* Grid dimensions */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Grid Size
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">Columns</span>
                <StepperControl
                  value={cols}
                  onChange={handleColsChange}
                  onStep={handleColsStep}
                  min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
                  max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
                  step={1}
                  variant="compact"
                  ariaLabel="Columns"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">Rows</span>
                <StepperControl
                  value={rows}
                  onChange={handleRowsChange}
                  onStep={handleRowsStep}
                  min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
                  max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
                  step={1}
                  variant="compact"
                  ariaLabel="Rows"
                />
              </div>
            </div>
          </section>

          {/* Visual grid editor (hidden for single-cell grids) */}
          {(cols > 1 || rows > 1) && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  Layout
                </h3>
                <div className="flex items-center gap-2">
                  {hasMergedCompartments && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
                      aria-label="Reset compartment layout to uniform grid"
                    >
                      Reset
                    </button>
                  )}
                  <span className="text-xs tabular-nums text-content-tertiary">
                    {compartmentCount} {compartmentCount === 1 ? 'compartment' : 'compartments'}
                  </span>
                </div>
              </div>
              <p
                id="compartment-grid-instructions"
                className={`mb-3 text-xs transition-colors ${
                  isDragging && selectionAction !== 'none'
                    ? 'text-accent font-medium'
                    : hoveredIsSplittable
                      ? 'text-content-secondary'
                      : 'text-content-tertiary'
                }`}
                aria-live="polite"
              >
                {instructionText}
              </p>
              <div
                ref={gridRef}
                className="mx-auto max-w-[280px] select-none rounded-lg border border-stroke-subtle bg-surface-elevated p-1.5"
                style={{ aspectRatio: String(aspectRatio) }}
                role="application"
                aria-label={`Compartment grid, ${cols} columns by ${rows} rows`}
                aria-describedby="compartment-grid-instructions"
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  handlePointerUp();
                  setHoverIdx(null);
                }}
              >
                <div
                  className="grid h-full w-full"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gap: '2px',
                  }}
                >
                  {cells.map((compartmentId, idx) => (
                    <GridCell
                      key={idx}
                      idx={idx}
                      compartmentId={compartmentId}
                      isSelected={selection.has(idx)}
                      isHovered={hoverIdx === idx && !isDragging}
                      isSplittable={
                        !isDragging && cells.filter((c) => c === compartmentId).length > 1
                      }
                      isDragging={isDragging}
                      config={compartments}
                      onPointerDown={handleCellPointerDown}
                      onPointerEnter={handleCellPointerEnter}
                      onPointerLeave={handleCellPointerLeave}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Wall thickness (only when there are dividers) */}
          {compartmentCount > 1 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Divider Walls
              </h3>
              <ThicknessSelector
                label="Thickness"
                value={thickness}
                onChange={handleThicknessChange}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Grid Cell Sub-component
// =============================================================================

function GridCell({
  idx,
  compartmentId,
  isSelected,
  isHovered,
  isSplittable,
  isDragging,
  config,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  idx: number;
  compartmentId: number;
  isSelected: boolean;
  isHovered: boolean;
  isSplittable: boolean;
  isDragging: boolean;
  config: CompartmentConfig;
  onPointerDown: (idx: number) => void;
  onPointerEnter: (idx: number) => void;
  onPointerLeave: () => void;
}) {
  const col = idx % config.cols;
  const row = Math.floor(idx / config.cols);

  // Determine which edges are at the boundary of this compartment
  const hasRightNeighbor =
    col < config.cols - 1 && config.cells[cellIndex(config.cols, col + 1, row)] === compartmentId;
  const hasBottomNeighbor =
    row < config.rows - 1 && config.cells[cellIndex(config.cols, col, row + 1)] === compartmentId;
  const hasLeftNeighbor =
    col > 0 && config.cells[cellIndex(config.cols, col - 1, row)] === compartmentId;
  const hasTopNeighbor =
    row > 0 && config.cells[cellIndex(config.cols, col, row - 1)] === compartmentId;

  // Compute rounded corners for outer edges of compartments
  const cornerRadius = 4;
  const topLeft = !hasTopNeighbor && !hasLeftNeighbor ? cornerRadius : 0;
  const topRight = !hasTopNeighbor && !hasRightNeighbor ? cornerRadius : 0;
  const bottomRight = !hasBottomNeighbor && !hasRightNeighbor ? cornerRadius : 0;
  const bottomLeft = !hasBottomNeighbor && !hasLeftNeighbor ? cornerRadius : 0;

  const fillColor = getCompartmentFill(compartmentId);
  const borderColor = getCompartmentBorder(compartmentId);

  // Build border widths: thicker on compartment edges, zero on internal edges
  const borderTop = hasTopNeighbor ? 0 : 1.5;
  const borderRight = hasRightNeighbor ? 0 : 1.5;
  const borderBottom = hasBottomNeighbor ? 0 : 1.5;
  const borderLeft = hasLeftNeighbor ? 0 : 1.5;

  return (
    <div
      className="relative touch-manipulation"
      style={{
        backgroundColor: isSelected
          ? 'var(--color-accent)'
          : isHovered && isSplittable
            ? `color-mix(in srgb, ${fillColor} 60%, white)`
            : fillColor,
        borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`,
        borderStyle: 'solid',
        borderColor: isSelected ? 'var(--color-accent)' : borderColor,
        borderWidth: `${borderTop}px ${borderRight}px ${borderBottom}px ${borderLeft}px`,
        opacity: isSelected ? 0.7 : 1,
        cursor: isDragging ? 'grabbing' : isSplittable ? 'pointer' : 'crosshair',
        transition: 'background-color 100ms, opacity 100ms',
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(idx);
      }}
      onPointerEnter={() => onPointerEnter(idx)}
      onPointerLeave={onPointerLeave}
    />
  );
}
