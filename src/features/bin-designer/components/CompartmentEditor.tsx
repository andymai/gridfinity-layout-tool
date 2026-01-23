/**
 * Visual compartment grid editor.
 *
 * Displays a top-down 2D view of the bin interior divided into a user-defined
 * grid. Users can:
 * 1. Set grid dimensions (rows × cols) via sliders
 * 2. Click-drag to select a rectangular region of cells
 * 3. Merge selected cells into one compartment (or split merged ones)
 *
 * The grid uses a cell-ownership model: cells with the same compartment ID
 * form one rectangular compartment. Divider walls are automatically derived
 * from boundaries between cells with different IDs.
 */

import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { SliderInput } from './controls/SliderInput';
import { ThicknessSelector } from './controls/ThicknessSelector';
import {
  getCompartmentCount,
  isRectangularSelection,
  cellIndex,
} from '../utils/compartments';
import type { CompartmentConfig } from '../types';

// =============================================================================
// Color palette for compartment visualization
// =============================================================================

const COMPARTMENT_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-emerald-100 dark:bg-emerald-900/30',
  'bg-amber-100 dark:bg-amber-900/30',
  'bg-purple-100 dark:bg-purple-900/30',
  'bg-rose-100 dark:bg-rose-900/30',
  'bg-cyan-100 dark:bg-cyan-900/30',
  'bg-orange-100 dark:bg-orange-900/30',
  'bg-indigo-100 dark:bg-indigo-900/30',
] as const;

function getCompartmentColor(id: number): string {
  return COMPARTMENT_COLORS[id % COMPARTMENT_COLORS.length];
}

// =============================================================================
// CompartmentEditor Component
// =============================================================================

export function CompartmentEditor() {
  const { compartments, setParam, setCompartmentGrid, mergeCells, splitCompartment } =
    useDesignerStore(
      useShallow((s) => ({
        compartments: s.params.compartments,
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

  const handleCellPointerDown = useCallback(
    (idx: number) => {
      setDragStart(idx);
      setIsDragging(true);
      setSelection(new Set([idx]));
    },
    []
  );

  const handleCellPointerEnter = useCallback(
    (idx: number) => {
      if (!isDragging || dragStart === null) return;
      setSelection(computeRectSelection(dragStart, idx));
    },
    [isDragging, dragStart, computeRectSelection]
  );

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

  const handleRowsChange = useCallback(
    (newRows: number) => {
      setCompartmentGrid(cols, newRows);
      setSelection(new Set());
    },
    [cols, setCompartmentGrid]
  );

  const handleThicknessChange = useCallback(
    (newThickness: number) => {
      setParam('compartments', { ...compartments, thickness: newThickness });
    },
    [compartments, setParam]
  );

  const compartmentCount = getCompartmentCount(compartments);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-6">
          {/* Grid dimensions */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Grid Size
            </h3>
            <div className="space-y-4">
              <SliderInput
                label="Columns"
                value={cols}
                onChange={handleColsChange}
                min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
                max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
                step={1}
                unit=""
              />
              <SliderInput
                label="Rows"
                value={rows}
                onChange={handleRowsChange}
                min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
                max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
                step={1}
                unit=""
              />
            </div>
          </section>

          {/* Visual grid editor */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Layout
              </h3>
              <span className="text-xs text-content-tertiary">
                {compartmentCount} {compartmentCount === 1 ? 'compartment' : 'compartments'}
              </span>
            </div>
            <p className="mb-3 text-xs text-content-tertiary">
              Drag to select cells, then release to merge. Click a merged compartment to split.
            </p>
            <div
              ref={gridRef}
              className="mx-auto aspect-square max-w-[280px] select-none rounded-lg border border-stroke-subtle p-1"
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <div
                className="grid h-full w-full gap-0.5"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
              >
                {cells.map((compartmentId, idx) => (
                  <GridCell
                    key={idx}
                    idx={idx}
                    compartmentId={compartmentId}
                    isSelected={selection.has(idx)}
                    config={compartments}
                    onPointerDown={handleCellPointerDown}
                    onPointerEnter={handleCellPointerEnter}
                  />
                ))}
              </div>
            </div>
          </section>

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
  config,
  onPointerDown,
  onPointerEnter,
}: {
  idx: number;
  compartmentId: number;
  isSelected: boolean;
  config: CompartmentConfig;
  onPointerDown: (idx: number) => void;
  onPointerEnter: (idx: number) => void;
}) {
  const col = idx % config.cols;
  const row = Math.floor(idx / config.cols);

  // Determine which borders to hide (same compartment as neighbor = no border)
  const hasRightNeighbor =
    col < config.cols - 1 && config.cells[cellIndex(config.cols, col + 1, row)] === compartmentId;
  const hasBottomNeighbor =
    row < config.rows - 1 && config.cells[cellIndex(config.cols, col, row + 1)] === compartmentId;
  const hasLeftNeighbor =
    col > 0 && config.cells[cellIndex(config.cols, col - 1, row)] === compartmentId;
  const hasTopNeighbor =
    row > 0 && config.cells[cellIndex(config.cols, col, row - 1)] === compartmentId;

  const colorClass = getCompartmentColor(compartmentId);

  return (
    <div
      className={`
        relative cursor-pointer transition-all duration-75
        ${colorClass}
        ${isSelected ? 'ring-2 ring-accent ring-inset z-10' : ''}
        ${!hasRightNeighbor ? 'border-r border-r-stroke-default' : ''}
        ${!hasBottomNeighbor ? 'border-b border-b-stroke-default' : ''}
        ${!hasLeftNeighbor ? 'border-l border-l-stroke-default' : ''}
        ${!hasTopNeighbor ? 'border-t border-t-stroke-default' : ''}
      `}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(idx);
      }}
      onPointerEnter={() => onPointerEnter(idx)}
    />
  );
}
