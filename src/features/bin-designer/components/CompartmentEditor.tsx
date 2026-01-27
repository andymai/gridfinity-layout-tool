/**
 * Visual compartment grid editor.
 *
 * Displays a top-down 2D view of the bin interior divided into a user-defined
 * grid. Users can:
 * 1. Set grid dimensions (rows x cols) via stepper controls
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
import {
  getCompartmentCount,
  getCompartmentBounds,
  isRectangularSelection,
  cellIndex,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

// =============================================================================
// Color palette for compartment visualization
// Uses HSL pairs (fill + border) that work in both light and dark modes.
// Fills use CSS variables to adapt: light mode gets pastel tints,
// dark mode gets desaturated darker shades.
// =============================================================================

/** Fill/border color pairs as [fillHSL, borderHSL] */
const COMPARTMENT_COLOR_PAIRS: ReadonlyArray<{ fill: string; border: string; darkFill: string }> = [
  { fill: 'hsl(214, 95%, 93%)', border: 'hsl(214, 85%, 70%)', darkFill: 'hsl(214, 40%, 25%)' },
  { fill: 'hsl(152, 81%, 92%)', border: 'hsl(152, 60%, 55%)', darkFill: 'hsl(152, 30%, 22%)' },
  { fill: 'hsl(48, 96%, 89%)', border: 'hsl(48, 80%, 55%)', darkFill: 'hsl(48, 40%, 22%)' },
  { fill: 'hsl(250, 95%, 95%)', border: 'hsl(250, 70%, 70%)', darkFill: 'hsl(250, 35%, 28%)' },
  { fill: 'hsl(350, 100%, 93%)', border: 'hsl(350, 75%, 65%)', darkFill: 'hsl(350, 35%, 25%)' },
  { fill: 'hsl(183, 100%, 93%)', border: 'hsl(183, 70%, 55%)', darkFill: 'hsl(183, 30%, 22%)' },
  { fill: 'hsl(24, 100%, 91%)', border: 'hsl(24, 85%, 60%)', darkFill: 'hsl(24, 40%, 24%)' },
  { fill: 'hsl(226, 100%, 92%)', border: 'hsl(226, 75%, 68%)', darkFill: 'hsl(226, 35%, 26%)' },
];

/** Detect dark mode via matchMedia */
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getCompartmentFill(id: number): string {
  const pair = COMPARTMENT_COLOR_PAIRS[id % COMPARTMENT_COLOR_PAIRS.length];
  return isDarkMode() ? pair.darkFill : pair.fill;
}

function getCompartmentBorder(id: number): string {
  return COMPARTMENT_COLOR_PAIRS[id % COMPARTMENT_COLOR_PAIRS.length].border;
}

// =============================================================================
// CompartmentEditor Component
// =============================================================================

export function CompartmentEditor() {
  const t = useTranslation();
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

  // Pre-compute cell counts per compartment to avoid repeated O(n) scans
  const compartmentCellCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const id of cells) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

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
      if ((compartmentCellCounts.get(compartmentId) ?? 0) > 1) {
        splitCompartment(compartmentId);
      }
    }

    setSelection(new Set());
  }, [isDragging, selection, cols, cells, mergeCells, splitCompartment, compartmentCellCounts]);

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
    return (compartmentCellCounts.get(cId) ?? 0) > 1;
  }, [hoverIdx, cells, isDragging, compartmentCellCounts]);

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
  const aspectRatio = depth > 0 ? Math.min(2, Math.max(0.5, width / depth)) : 1;

  return (
    <div>
      <div>
        <div className="space-y-5">
          {/* Grid dimensions */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              {t('binDesigner.gridSize')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.columns')}
                </span>
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
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('binDesigner.rows')}
                </span>
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
                  {t('binDesigner.layout')}
                </h3>
                <div className="flex items-center gap-2">
                  {hasMergedCompartments && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
                      aria-label={t('binDesigner.resetCompartmentLayoutToUniformGrid')}
                    >
                      {t('common.reset')}
                    </button>
                  )}
                  <span className="text-xs tabular-nums text-content-tertiary">
                    {t('binDesigner.compartments.count', { count: compartmentCount })}
                  </span>
                </div>
              </div>
              <p
                id="compartment-grid-instructions"
                className={`mb-3 text-xs transition-all ${
                  isDragging && selectionAction !== 'none'
                    ? 'text-accent font-medium'
                    : hoveredIsSplittable
                      ? 'text-content-secondary'
                      : 'text-content-tertiary'
                }`}
                aria-live={isDragging ? 'off' : 'polite'}
              >
                {instructionText}
              </p>
              <div
                ref={gridRef}
                className="mx-auto max-w-[280px] select-none rounded-lg border border-stroke-subtle bg-surface-elevated p-1.5"
                style={{ aspectRatio }}
                role="application"
                aria-label={`Compartment grid, ${cols} columns by ${rows} rows`}
                aria-describedby="compartment-grid-instructions"
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  handlePointerUp();
                  setHoverIdx(null);
                }}
              >
                {/* Use flex-col-reverse to match 3D orientation: row 0 = front = bottom of UI */}
              <div className="flex h-full w-full flex-col-reverse" style={{ gap: '1px' }}>
                {Array.from({ length: rows }, (_, visualRow) => {
                  const dataRow = visualRow; // flex-col-reverse handles the flip
                  return (
                    <div
                      key={dataRow}
                      className="grid flex-1"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gap: '1px',
                      }}
                    >
                      {Array.from({ length: cols }, (_, col) => {
                        const idx = dataRow * cols + col;
                        const compartmentId = cells[idx];
                        return (
                          <GridCell
                            key={idx}
                            idx={idx}
                            compartmentId={compartmentId}
                            isSelected={selection.has(idx)}
                            isHovered={hoverIdx === idx && !isDragging}
                            isSplittable={
                              !isDragging && (compartmentCellCounts.get(compartmentId) ?? 0) > 1
                            }
                            isDragging={isDragging}
                            config={compartments}
                            onPointerDown={handleCellPointerDown}
                            onPointerEnter={handleCellPointerEnter}
                            onPointerLeave={handleCellPointerLeave}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              </div>
            </section>
          )}

          {/* Wall thickness (only when there are dividers) */}
          {compartmentCount > 1 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                {t('binDesigner.dividerWalls')}
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

/** Renders a single cell in the compartment grid with dynamic styling and keyboard support. */
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
  // Note: Visual orientation is flipped via flex-col-reverse, so:
  // - "Visual bottom" = data row + 1 (higher row index)
  // - "Visual top" = data row - 1 (lower row index)
  const hasRightNeighbor =
    col < config.cols - 1 && config.cells[cellIndex(config.cols, col + 1, row)] === compartmentId;
  const hasVisualBottomNeighbor =
    row < config.rows - 1 && config.cells[cellIndex(config.cols, col, row + 1)] === compartmentId;
  const hasLeftNeighbor =
    col > 0 && config.cells[cellIndex(config.cols, col - 1, row)] === compartmentId;
  const hasVisualTopNeighbor =
    row > 0 && config.cells[cellIndex(config.cols, col, row - 1)] === compartmentId;

  // Compute rounded corners for outer edges of compartments (visual orientation)
  const cornerRadius = 4;
  const topLeft = !hasVisualTopNeighbor && !hasLeftNeighbor ? cornerRadius : 0;
  const topRight = !hasVisualTopNeighbor && !hasRightNeighbor ? cornerRadius : 0;
  const bottomRight = !hasVisualBottomNeighbor && !hasRightNeighbor ? cornerRadius : 0;
  const bottomLeft = !hasVisualBottomNeighbor && !hasLeftNeighbor ? cornerRadius : 0;

  const fillColor = getCompartmentFill(compartmentId);
  const borderColor = getCompartmentBorder(compartmentId);

  // Build border widths: use integer pixels for consistent rendering (visual orientation)
  const borderTop = hasVisualTopNeighbor ? 0 : 2;
  const borderRight = hasRightNeighbor ? 0 : 2;
  const borderBottom = hasVisualBottomNeighbor ? 0 : 2;
  const borderLeft = hasLeftNeighbor ? 0 : 2;

  // Show dimension label on the visual top-left cell of multi-cell compartments
  const isTopLeftOfCompartment = !hasVisualTopNeighbor && !hasLeftNeighbor;
  let dimensionLabel: string | null = null;
  if (isTopLeftOfCompartment && isSplittable) {
    const bounds = getCompartmentBounds(config, compartmentId);
    if (bounds) {
      const cWidth = bounds.maxCol - bounds.minCol + 1;
      const cHeight = bounds.maxRow - bounds.minRow + 1;
      dimensionLabel = `${cWidth}×${cHeight}`;
    }
  }

  // Determine the cell's accessible label
  const cellLabel = dimensionLabel
    ? `Compartment ${compartmentId + 1}, ${dimensionLabel}, ${isSplittable ? 'click to split' : ''}`
    : `Cell ${col + 1}, ${row + 1}`;

  return (
    <div
      className="relative touch-manipulation"
      role="button"
      tabIndex={0}
      aria-label={cellLabel}
      aria-pressed={isSelected}
      style={{
        backgroundColor: isSelected
          ? 'var(--color-accent)'
          : isHovered && isSplittable
            ? borderColor
            : fillColor,
        borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`,
        borderStyle: 'solid',
        borderColor: isSelected ? 'var(--color-accent)' : borderColor,
        borderWidth: `${borderTop}px ${borderRight}px ${borderBottom}px ${borderLeft}px`,
        opacity: isSelected ? 0.7 : 1,
        cursor: isDragging ? 'crosshair' : isSplittable ? 'pointer' : 'crosshair',
        transition: 'background-color 100ms, opacity 100ms',
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(idx);
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onPointerDown(idx);
        }
      }}
      onPointerEnter={() => onPointerEnter(idx)}
      onPointerLeave={onPointerLeave}
    >
      {dimensionLabel && (
        <span
          className="pointer-events-none absolute text-[9px] font-bold leading-none"
          style={{
            top: '3px',
            left: '3px',
            color: borderColor,
          }}
        >
          {dimensionLabel}
        </span>
      )}
    </div>
  );
}
