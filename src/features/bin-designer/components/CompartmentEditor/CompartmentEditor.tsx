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
 *
 * Sub-components live in `CompartmentEditorParts.tsx` (`GridCell` and
 * `GhostPreview`). Preview color sync is centralized in the shared
 * `usePreviewColor` hook.
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
  isRectangularSelection,
  cellIndex,
} from '@/features/bin-designer/utils/compartments';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { usePreviewColor } from '@/features/bin-designer/hooks/usePreviewColor';
import { GridCell, GhostPreview } from './CompartmentEditorParts';
import { DividerHandlesOverlay } from './DividerHandlesOverlay';
import { useDividerHandles } from './useDividerHandles';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

export function CompartmentEditor() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const stepperVariant = isMobile ? 'mobile' : 'desktop';
  const {
    compartments,
    width,
    depth,
    wallThickness,
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
      wallThickness: s.params.wallThickness,
      setParam: s.setParam,
      setCompartmentGrid: s.setCompartmentGrid,
      mergeCells: s.mergeCells,
      splitCompartment: s.splitCompartment,
      setPreviewCompartments: s.setPreviewCompartments,
      setPreviewSelection: s.setPreviewSelection,
    }))
  );

  const { cols, rows, thickness, cells } = compartments;

  // Preview color synced with 3D preview (cross-tab + same-window CustomEvent)
  const previewColor = usePreviewColor();

  // Selection state for drag-to-merge
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Ref to the *inner* flex container that holds GridCells. Used by the
  // divider-drag math so mm-per-pixel matches the GridCell coordinate
  // space (the outer `gridRef` includes the container's padding + border,
  // which would skew the conversion).
  const gridCellsRef = useRef<HTMLDivElement>(null);

  // Bin interior dimensions in mm — used by the divider-drag overlay to
  // convert canvas-pixel deltas to mm offsets. Mirrors the worker-side
  // derivation in `buildCompartmentWalls`.
  const innerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * wallThickness;
  const innerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * wallThickness;

  const dividerHandles = useDividerHandles({
    compartments,
    innerW,
    innerD,
    canvasRef: gridCellsRef,
  });

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
        description: t(`binDesigner.wallThickness.${value}`),
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
              variant={stepperVariant}
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
              variant={stepperVariant}
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
            <div ref={gridCellsRef} className="relative flex h-full w-full flex-col-reverse">
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
              {/* Angled-divider drag handles. Lives INSIDE the flex
                  container so its `inset-0` matches the GridCell
                  coordinate space (the outer `gridRef` includes padding
                  and border, which would skew positioning). Self-gated
                  on labs flag + grid linearity; renders nothing
                  otherwise. */}
              <DividerHandlesOverlay
                handles={dividerHandles.handles}
                drag={dividerHandles.drag}
                innerW={innerW}
                innerD={innerD}
                onHandlePointerDown={dividerHandles.onHandlePointerDown}
              />
            </div>
            {/* Ghost preview overlay during cell-select drag */}
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
