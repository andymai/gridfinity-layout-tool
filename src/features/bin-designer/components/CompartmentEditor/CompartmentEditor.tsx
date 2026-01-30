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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { StepperControl } from '@/shared/components/StepperControl';
import { SnappingSlider } from '../controls/SnappingSlider';
import type { SnappingSliderOption } from '../controls/SnappingSlider';
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
// Uses the same base color as the 3D preview for visual consistency.
// =============================================================================

const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_PREVIEW_COLOR = '#d4d8dc';

/** Get the current 3D preview color from localStorage */
function getPreviewColor(): string {
  if (typeof window === 'undefined') return DEFAULT_PREVIEW_COLOR;
  return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_PREVIEW_COLOR;
}

/** Convert hex color to HSL components */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Get fill color for a compartment, based on preview color with slight variation */
function getCompartmentFill(id: number, previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  // Slight lightness variation for different compartments (±3%)
  const offset = ((id % 3) - 1) * 3;
  const adjustedL = Math.max(10, Math.min(95, l + offset));
  return `hsl(${h}, ${s}%, ${adjustedL}%)`;
}

/** Get border color for a compartment, darker than fill */
function getCompartmentBorder(_id: number, previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  // Border is darker than fill
  const borderL = Math.max(10, l - 25);
  return `hsl(${h}, ${s}%, ${borderL}%)`;
}

// =============================================================================
// CompartmentEditor Component
// =============================================================================

export function CompartmentEditor() {
  const t = useTranslation();
  const {
    compartments,
    width,
    depth,
    setParam,
    setCompartmentGrid,
    mergeCells,
    splitCompartment,
    setPreviewCompartments,
    setPreviewSelection,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      width: s.params.width,
      depth: s.params.depth,
      setParam: s.setParam,
      setCompartmentGrid: s.setCompartmentGrid,
      mergeCells: s.mergeCells,
      splitCompartment: s.splitCompartment,
      setPreviewCompartments: s.setPreviewCompartments,
      setPreviewSelection: s.setPreviewSelection,
    }))
  );

  const { cols, rows, thickness, cells } = compartments;

  // Preview color synced with 3D preview
  const [previewColor, setPreviewColor] = useState(getPreviewColor);

  // Listen for color changes from 3D preview (same window + cross-tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PREVIEW_COLOR_KEY) {
        setPreviewColor(e.newValue ?? DEFAULT_PREVIEW_COLOR);
      }
    };
    const handleColorChange = (e: Event) => {
      const color = (e as CustomEvent<string>).detail;
      setPreviewColor(color);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('preview-color-change', handleColorChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('preview-color-change', handleColorChange);
    };
  }, []);

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

  // Update preview compartments in store during drag for 3D ghost preview
  const previewData = useMemo(() => {
    if (!isDragging || selection.size < 2 || selectionAction === 'none') return null;

    const indices = [...selection];
    const newCells = [...cells];

    // Compute selection bounds
    let minCol = cols,
      maxCol = 0,
      minRow = rows,
      maxRow = 0;
    for (const idx of indices) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }

    if (selectionAction === 'merge') {
      // Merge: assign all selected cells to a new ID (use first selected ID)
      const targetId = cells[indices[0]];
      for (const idx of indices) {
        newCells[idx] = targetId;
      }
    } else {
      // Split: assign each cell a unique ID
      let nextId = Math.max(...cells) + 1;
      for (const idx of indices) {
        newCells[idx] = nextId++;
      }
    }

    return {
      compartments: { cols, rows, thickness, cells: newCells },
      selection: { action: selectionAction, minCol, maxCol, minRow, maxRow },
    };
  }, [isDragging, selection, selectionAction, cells, cols, rows, thickness]);

  // Sync preview to store
  useEffect(() => {
    setPreviewCompartments(previewData?.compartments ?? null);
    setPreviewSelection(previewData?.selection ?? null);
    return () => {
      setPreviewCompartments(null);
      setPreviewSelection(null);
    };
  }, [previewData, setPreviewCompartments, setPreviewSelection]);

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
      if (selectionAction === 'split') return 'Release to split';
      return 'Drag to select';
    }
    if (hoveredIsSplittable && !isDragging) {
      return 'Click to split';
    }
    return 'Drag to merge, click to split';
  }, [isDragging, selection.size, selectionAction, hoveredIsSplittable]);

  // Compute aspect ratio from bin dimensions, clamped to avoid extreme shapes
  const aspectRatio = depth > 0 ? Math.min(2, Math.max(0.5, width / depth)) : 1;

  // Build wall thickness options for SnappingSlider
  const thicknessOptions: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}` as Parameters<typeof t>[0]),
      })),
    [t]
  );

  // Compute grid intersection dots (internal intersections only)
  const gridDots = useMemo(() => {
    const dots: Array<{ x: number; y: number }> = [];
    for (let row = 1; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        dots.push({ x: col / cols, y: row / rows });
      }
    }
    return dots;
  }, [cols, rows]);

  return (
    <div className="space-y-5">
      {/* Bin Grid controls (above the 2D layout) */}
      <section>
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
              variant="desktop"
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
              variant="desktop"
              ariaLabel="Rows"
            />
          </div>
        </div>
      </section>

      {/* 2D Layout editor (hidden when 1x1 grid) */}
      {(cols > 1 || rows > 1) && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p
              id="compartment-grid-instructions"
              className={`text-xs transition-colors duration-150 ${
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
          </div>
          <div
            ref={gridRef}
            className="relative mx-auto max-w-[360px] select-none rounded-lg border-2 border-stroke-subtle bg-surface-elevated p-2"
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
            {/* Grid dots overlay at intersections */}
            {gridDots.length > 0 && (
              <div className="pointer-events-none absolute inset-2">
                {gridDots.map(({ x, y }, i) => (
                  <div
                    key={i}
                    className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content-tertiary/40"
                    style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
                  />
                ))}
              </div>
            )}
            {/* Use flex-col-reverse to match 3D orientation: row 0 = front = bottom of UI */}
            {/* No gap - merged cells should visually connect; borders handle separation */}
            <div className="relative flex h-full w-full flex-col-reverse">
              {Array.from({ length: rows }, (_, visualRow) => {
                const dataRow = visualRow; // flex-col-reverse handles the flip
                return (
                  <div
                    key={dataRow}
                    className="grid flex-1"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
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
                          previewColor={previewColor}
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
            {/* Ghost preview overlay during drag */}
            {isDragging && selection.size >= 2 && (
              <GhostPreview
                selection={selection}
                selectionAction={selectionAction}
                cols={cols}
                rows={rows}
              />
            )}
          </div>
        </section>
      )}

      {/* Wall thickness (only when there are dividers) */}
      {compartmentCount > 1 && (
        <section>
          <SnappingSlider
            label={t('binDesigner.wallThickness')}
            value={thickness}
            onChange={handleThicknessChange}
            options={thicknessOptions}
            unit="mm"
          />
        </section>
      )}
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
  previewColor,
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
  previewColor: string;
  onPointerDown: (idx: number) => void;
  onPointerEnter: (idx: number) => void;
  onPointerLeave: () => void;
}) {
  const col = idx % config.cols;
  const row = Math.floor(idx / config.cols);

  // Determine which edges are at the boundary of this compartment
  // Note: Visual orientation is flipped via flex-col-reverse, so:
  // - Data row 0 is at VISUAL BOTTOM
  // - Data row (rows-1) is at VISUAL TOP
  // - "Visual top neighbor" = data row + 1 (higher row index, rendered above)
  // - "Visual bottom neighbor" = data row - 1 (lower row index, rendered below)
  const hasRightNeighbor =
    col < config.cols - 1 && config.cells[cellIndex(config.cols, col + 1, row)] === compartmentId;
  const hasVisualTopNeighbor =
    row < config.rows - 1 && config.cells[cellIndex(config.cols, col, row + 1)] === compartmentId;
  const hasLeftNeighbor =
    col > 0 && config.cells[cellIndex(config.cols, col - 1, row)] === compartmentId;
  const hasVisualBottomNeighbor =
    row > 0 && config.cells[cellIndex(config.cols, col, row - 1)] === compartmentId;

  // Round only the outer corners of the entire grid (not interior compartment corners)
  const cornerRadius = 5;
  const isAtGridTop = row === config.rows - 1;
  const isAtGridBottom = row === 0;
  const isAtGridLeft = col === 0;
  const isAtGridRight = col === config.cols - 1;
  const topLeft = isAtGridTop && isAtGridLeft ? cornerRadius : 0;
  const topRight = isAtGridTop && isAtGridRight ? cornerRadius : 0;
  const bottomRight = isAtGridBottom && isAtGridRight ? cornerRadius : 0;
  const bottomLeft = isAtGridBottom && isAtGridLeft ? cornerRadius : 0;

  const fillColor = getCompartmentFill(compartmentId, previewColor);
  const borderColor = getCompartmentBorder(compartmentId, previewColor);

  // Build box-shadow for compartment edges (inset shadows that properly merge)
  // Walls are shared: only draw right/bottom for internal boundaries to avoid doubling
  // Always draw all edges for outer grid boundaries
  const shadowParts: string[] = [];
  const shadowWidth = 2;
  const isTopEdge = row === config.rows - 1; // Visual top of grid
  const isLeftEdge = col === 0;

  // Top: only draw if outer grid edge, OR if it's a compartment boundary (always draw bottom of neighbor)
  if (!hasVisualTopNeighbor && isTopEdge) {
    shadowParts.push(`inset 0 ${shadowWidth}px 0 0 ${borderColor}`);
  }
  // Right: always draw compartment boundaries (this is the "owned" side)
  if (!hasRightNeighbor) {
    shadowParts.push(`inset -${shadowWidth}px 0 0 0 ${borderColor}`);
  }
  // Bottom: always draw compartment boundaries (this is the "owned" side)
  if (!hasVisualBottomNeighbor) {
    shadowParts.push(`inset 0 -${shadowWidth}px 0 0 ${borderColor}`);
  }
  // Left: only draw if outer grid edge
  if (!hasLeftNeighbor && isLeftEdge) {
    shadowParts.push(`inset ${shadowWidth}px 0 0 0 ${borderColor}`);
  }
  const boxShadow = shadowParts.length > 0 ? shadowParts.join(', ') : 'none';

  // Show dimension label on the visual top-left cell of multi-cell compartments (hover only)
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

  // Check if any cell in this compartment is hovered (for showing dimension label)
  const showDimensionLabel = isHovered && dimensionLabel;

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
            ? 'var(--color-accent-muted, hsl(214, 60%, 85%))'
            : fillColor,
        borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`,
        boxShadow: isSelected ? `inset 0 0 0 2px var(--color-accent)` : boxShadow,
        opacity: isSelected ? 0.8 : 1,
        cursor: isDragging ? 'crosshair' : isSplittable ? 'pointer' : 'crosshair',
        transition: 'all 150ms ease-out',
        transform: isSelected ? 'scale(0.97)' : 'scale(1)',
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
      {/* Dimension label - shown on hover only */}
      {dimensionLabel && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums transition-opacity duration-100"
          style={{
            color: 'var(--color-accent)',
            opacity: showDimensionLabel ? 1 : 0,
          }}
        >
          {dimensionLabel}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Ghost Preview Sub-component
// =============================================================================

/** Shows a preview of what the merge/split result will look like during drag. */
function GhostPreview({
  selection,
  selectionAction,
  cols,
  rows,
}: {
  selection: Set<number>;
  selectionAction: 'merge' | 'split' | 'none';
  cols: number;
  rows: number;
}) {
  // Compute bounding box of selection
  const bounds = useMemo(() => {
    if (selection.size === 0) return null;
    let minCol = cols,
      maxCol = 0,
      minRow = rows,
      maxRow = 0;
    for (const idx of selection) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }
    return { minCol, maxCol, minRow, maxRow };
  }, [selection, cols, rows]);

  if (!bounds || selectionAction === 'none') return null;

  const { minCol, maxCol, minRow, maxRow } = bounds;

  // For merge: show single unified preview
  // For split: show individual cell previews
  if (selectionAction === 'merge') {
    // Calculate position as percentages (remember flex-col-reverse: row 0 = bottom)
    const left = (minCol / cols) * 100;
    const right = ((cols - maxCol - 1) / cols) * 100;
    // Visual top = data maxRow+1, visual bottom = data minRow
    const top = ((rows - maxRow - 1) / rows) * 100;
    const bottom = (minRow / rows) * 100;

    return (
      <div
        className="pointer-events-none absolute animate-pulse"
        style={{
          left: `${left}%`,
          right: `${right}%`,
          top: `${top}%`,
          bottom: `${bottom}%`,
          border: '2px dashed var(--color-accent)',
          borderRadius: '4px',
          backgroundColor: 'var(--color-accent)',
          opacity: 0.15,
        }}
      />
    );
  }

  // For split: show individual cell outlines
  const cellPreviews: React.ReactNode[] = [];
  for (const idx of selection) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const left = (col / cols) * 100;
    const width = (1 / cols) * 100;
    // Visual positioning (flex-col-reverse)
    const top = ((rows - row - 1) / rows) * 100;
    const height = (1 / rows) * 100;

    cellPreviews.push(
      <div
        key={idx}
        className="pointer-events-none absolute animate-pulse"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: '1px dashed var(--color-accent)',
          backgroundColor: 'var(--color-accent)',
          opacity: 0.1,
        }}
      />
    );
  }

  return <>{cellPreviews}</>;
}
