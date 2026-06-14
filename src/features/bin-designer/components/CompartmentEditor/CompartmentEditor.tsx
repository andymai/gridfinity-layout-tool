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
import { useSettingsStore } from '@/core/store/settings';
import { DESIGNER_CONSTRAINTS, WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { Button, Stepper } from '@/design-system';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { SnappingSlider } from '../controls/SnappingSlider';
import type { SnappingSliderOption } from '../controls/SnappingSlider';
import {
  getCompartmentCount,
  getEligibleDividers,
  isRectangularSelection,
  cellIndex,
} from '@/features/bin-designer/utils/compartments';
import {
  minUniformCavity,
  solveCountForMinCavity,
} from '@/features/bin-designer/utils/compartmentDimensions';
import { getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { usePreviewColor } from '@/features/bin-designer/hooks/usePreviewColor';
import { GridCell, GhostPreview } from './CompartmentEditorParts';
import { DividerHitTargets } from './DividerHitTargets';
import { DividerHeightControl } from './DividerHeightControl';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { rowKeyOf } from './useDividerTiltSubsection';

const EMPTY_HIGHLIGHT_SET: ReadonlySet<number> = new Set();

// Bounding box the 2D grid is scaled to fit, at the bin's true proportions.
const GRID_ENVELOPE_W_PX = 360;
const GRID_ENVELOPE_H_PX = 300;

export function CompartmentEditor() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const stepperSize = isMobile ? 'lg' : 'md';
  const {
    compartments,
    width,
    depth,
    gridUnitMm,
    wallThickness,
    dividerTiltPreview,
    selectedDividerKey,
    hoveredDividerKey,
    setParam,
    setCompartmentGrid,
    mergeCells,
    splitCompartment,
    setPreviewCompartments,
    setPreviewSelection,
    setSelectedDividerKey,
    setHoveredDividerKey,
    setHoveredCompartmentId,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      wallThickness: s.params.wallThickness,
      dividerTiltPreview: s.ui.dividerTiltPreview,
      selectedDividerKey: s.ui.selectedDividerKey,
      hoveredDividerKey: s.ui.hoveredDividerKey,
      setParam: s.setParam,
      setCompartmentGrid: s.setCompartmentGrid,
      mergeCells: s.mergeCells,
      splitCompartment: s.splitCompartment,
      setPreviewCompartments: s.setPreviewCompartments,
      setPreviewSelection: s.setPreviewSelection,
      setSelectedDividerKey: s.setSelectedDividerKey,
      setHoveredDividerKey: s.setHoveredDividerKey,
      setHoveredCompartmentId: s.setHoveredCompartmentId,
    }))
  );

  // Angled dividers are an advanced opt-in (see DividerTiltSubsection). Keep the
  // on-grid hit-target overlay hidden until the user enables editing so dense
  // grids stay legible (issue #2044).
  const angledDividersEnabled = useSettingsStore((s) => s.settings.angledDividersEnabled);

  const { innerW: interiorW, innerD: interiorD } = getInteriorDims({
    width,
    depth,
    gridUnitMm,
    wallThickness,
  });

  const { cols, rows, thickness, cells } = compartments;

  // Preview color synced with 3D preview (cross-tab + same-window CustomEvent)
  const previewColor = usePreviewColor();

  // Manual size entry is an advanced opt-in; the grid steppers are the default.
  const [showSizer, setShowSizer] = useState(false);

  // Selection state for drag-to-merge
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Mirror the hovered cell's compartment to the store so the 3D preview can
  // draw that one compartment's dimension lines. Cleared while dragging (the
  // ghost-merge preview takes over) and on unmount (cleanup nulls it).
  useEffect(() => {
    // Guard hoverIdx against the current grid: a resize can leave a stale
    // hoverIdx pointing past the regenerated cells array.
    const id = hoverIdx !== null && !isDragging && hoverIdx < cells.length ? cells[hoverIdx] : null;
    setHoveredCompartmentId(id);
    return () => {
      setHoveredCompartmentId(null);
    };
  }, [hoverIdx, isDragging, cells, setHoveredCompartmentId]);

  // Pre-compute cell counts per compartment to avoid repeated O(n) scans
  const compartmentCellCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const id of cells) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  // Eligible divider segments for the hit-target overlay. Recomputed when the
  // compartment grid changes (cheap O(rows*cols) scan, no perf concern).
  const eligibleDividers = useMemo(() => getEligibleDividers(compartments), [compartments]);

  // Compartments to brighten alongside the divider hover/selection — hover wins
  // when both are set so power users can probe other dividers without losing
  // their inspector context.
  const dividerHighlightCompartments = useMemo<ReadonlySet<number>>(() => {
    const activeKey = hoveredDividerKey ?? selectedDividerKey;
    if (!activeKey) return EMPTY_HIGHLIGHT_SET;
    const match = eligibleDividers.find(
      (d) => rowKeyOf(d.compartmentA, d.compartmentB) === activeKey
    );
    return match ? new Set([match.compartmentA, match.compartmentB]) : EMPTY_HIGHLIGHT_SET;
  }, [eligibleDividers, hoveredDividerKey, selectedDividerKey]);

  // Stable label builder for hit-target aria-labels; uses the same wording as
  // the panel's "edit row" affordance so screen readers hear a consistent name.
  const rowLabelForHitTarget = useCallback(
    (a: number, b: number) =>
      t('binDesigner.angledDividers.editRowLabel', { a: String(a), b: String(b) }),
    [t]
  );

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

  // Size-led entry (fit-guarantee): typing a minimum opening picks the largest
  // count whose tightest compartment stays >= the requested mm, so every
  // compartment is at least that size. The mm fields are a solver entry point —
  // they don't store a target; the grid (cols/rows) is the single source of
  // truth, and the fields always reflect the achieved smallest opening.
  // setCompartmentGrid regenerates the uniform grid (it validates min cell size
  // and silently no-ops if the target is infeasible).
  const applyTargetWidth = useCallback(
    (target: number) => {
      const clamped = Math.min(
        interiorW,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE, target)
      );
      setCompartmentGrid(
        solveCountForMinCavity(
          interiorW,
          thickness,
          clamped,
          DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
          DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
        ),
        rows
      );
      setSelection(new Set());
    },
    [interiorW, thickness, rows, setCompartmentGrid]
  );

  const applyTargetDepth = useCallback(
    (target: number) => {
      const clamped = Math.min(
        interiorD,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE, target)
      );
      setCompartmentGrid(
        cols,
        solveCountForMinCavity(
          interiorD,
          thickness,
          clamped,
          DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
          DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
        )
      );
      setSelection(new Set());
    },
    [interiorD, thickness, cols, setCompartmentGrid]
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

  // The mm fields show the smallest (worst-case interior) opening per axis — the
  // value the fit-guarantee is measured against. Rounded to 0.1mm for display so
  // the field never shows a stale or contradictory number relative to the grid.
  const achievedMinW = Math.round(minUniformCavity(interiorW, cols, thickness) * 10) / 10;
  const achievedMinD = Math.round(minUniformCavity(interiorD, rows, thickness) * 10) / 10;

  // Surface the grid cap so a too-small entry that clamps at the max isn't a
  // silent surprise (e.g. typing 5mm into a large bin tops out at 12 across).
  const atMaxGrid =
    cols >= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID ||
    rows >= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID;

  // Standalone styling for the size inputs (the Stepper owns its own input
  // styling, but the mm fields are bare DeferredNumberInputs).
  const sizeInputClass =
    stepperSize === 'lg'
      ? 'input w-full h-12 text-center font-semibold tabular-nums'
      : 'w-full h-8 rounded border border-stroke-subtle bg-surface text-center text-sm tabular-nums text-content-secondary';

  // Check if hovered cell is in a multi-cell compartment (splittable)
  const hoveredIsSplittable = useMemo(() => {
    if (hoverIdx === null || isDragging) return false;
    const cId = cells[hoverIdx];
    return (compartmentCellCounts.get(cId) ?? 0) > 1;
  }, [hoverIdx, cells, isDragging, compartmentCellCounts]);

  // Dynamic instruction text
  const instructionText = useMemo(() => {
    if (isDragging && selection.size >= 2) {
      if (selectionAction === 'merge')
        return t('binDesigner.compartmentEditor.releaseToMerge', { count: selection.size });
      if (selectionAction === 'split') return t('binDesigner.compartmentEditor.releaseToSplit');
      return t('binDesigner.compartmentEditor.dragToSelect');
    }
    if (hoveredIsSplittable && !isDragging) {
      return t('binDesigner.compartmentEditor.clickToSplit');
    }
    return t('binDesigner.compartmentEditor.dragOrClick');
  }, [isDragging, selection.size, selectionAction, hoveredIsSplittable, t]);

  // Render the grid at the bin's true top-view proportions, scaled to fit a
  // fixed envelope. Capping width to `MAX_H * aspect` keeps the derived height
  // within budget while preserving the real shape — so deep bins stay legible
  // instead of ballooning, and the box never overflows onto the controls above.
  const aspectRatio = depth > 0 ? width / depth : 1;
  const gridMaxWidthPx = Math.min(GRID_ENVELOPE_W_PX, GRID_ENVELOPE_H_PX * aspectRatio);

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
      {/* Compartment grid: the primary control is the Columns/Rows steppers.
          Setting the grid by a target compartment size is an advanced opt-in
          (collapsed by default) that snaps the same cols×rows via the
          fit-guarantee solver — the steppers stay the single source of truth. */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.columns')}
            </span>
            <Stepper
              value={cols}
              onChange={handleColsChange}
              onStep={handleColsStep}
              min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
              max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
              step={1}
              size={stepperSize}
              aria-label={t('binDesigner.columns')}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.rows')}
            </span>
            <Stepper
              value={rows}
              onChange={handleRowsChange}
              onStep={handleRowsStep}
              min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
              max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
              step={1}
              size={stepperSize}
              aria-label={t('binDesigner.rows')}
            />
          </div>
        </div>

        {/* Always-visible readout of the resulting compartment size, so the
            actual mm dimensions are legible at a glance — no hover required —
            whether the grid was set by the steppers or by size. Shows the
            smallest (worst-case interior) compartment; edges may be wider. */}
        <p className="text-xs tabular-nums text-content-secondary" aria-live="polite">
          {atMaxGrid
            ? `${t('binDesigner.compartmentEditor.maxGridReached', { max: DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID })} · `
            : ''}
          {t('binDesigner.compartmentEditor.sizeReadout', {
            width: achievedMinW,
            depth: achievedMinD,
          })}
        </p>

        {/* Advanced: set the grid by a minimum compartment size in mm. */}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowSizer((v) => !v)}
            aria-expanded={showSizer}
            className="flex items-center gap-1 rounded-none px-0 py-0 hover:bg-transparent text-[11px] font-medium text-content-secondary hover:text-content"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showSizer ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {t('binDesigner.compartmentEditor.setBySize')}
          </Button>

          {showSizer && (
            <div className="mt-2 space-y-2 border-l border-stroke-subtle pl-3">
              <span className="block text-xs text-content-tertiary">
                {t('binDesigner.compartmentEditor.smallestOpening')}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.compartmentEditor.openingWidth')}
                  </span>
                  <DeferredNumberInput
                    value={achievedMinW}
                    onChange={applyTargetWidth}
                    min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}
                    max={Math.round(interiorW)}
                    step={1}
                    decimals={1}
                    className={sizeInputClass}
                    aria-label={t('binDesigner.compartmentEditor.openingWidth')}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.compartmentEditor.openingDepth')}
                  </span>
                  <DeferredNumberInput
                    value={achievedMinD}
                    onChange={applyTargetDepth}
                    min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}
                    max={Math.round(interiorD)}
                    step={1}
                    decimals={1}
                    className={sizeInputClass}
                    aria-label={t('binDesigner.compartmentEditor.openingDepth')}
                  />
                </div>
              </div>
              {/* Explains why typed sizes round up and discloses the edge
                  asymmetry (the grid cap is announced in the readout above). */}
              <p className="text-[11px] text-content-tertiary">
                {t('binDesigner.compartmentEditor.tileEvenlyNote')}
              </p>
            </div>
          )}
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
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="rounded-none px-0 py-0 hover:bg-transparent text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
                aria-label={t('binDesigner.resetCompartmentLayoutToUniformGrid')}
              >
                {t('common.reset')}
              </Button>
            )}
          </div>
          <div
            ref={gridRef}
            className="relative mr-auto w-full select-none overflow-hidden rounded-lg border-2 border-stroke-subtle bg-surface-elevated p-2"
            style={{ aspectRatio, maxWidth: `${gridMaxWidthPx}px` }}
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
                    className="grid min-h-0 min-w-0 flex-1"
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
                          isDividerHoverHighlighted={dividerHighlightCompartments.has(
                            compartmentId
                          )}
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
            {/* Divider hit targets: clickable lines above the cells, transparent
                container with per-line pointer-events so cell drag-merge still
                works. Hidden during cell-merge drag to keep the surface calm. */}
            {!isDragging && angledDividersEnabled && eligibleDividers.length > 0 && (
              <DividerHitTargets
                compartments={compartments}
                dividers={eligibleDividers}
                interiorW={interiorW}
                interiorD={interiorD}
                preview={dividerTiltPreview}
                selectedKey={selectedDividerKey}
                hoveredKey={hoveredDividerKey}
                onSelect={setSelectedDividerKey}
                onHoverChange={setHoveredDividerKey}
                rowLabel={rowLabelForHitTarget}
              />
            )}
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

      {/* Wall thickness + divider height (only when there are dividers). */}
      {compartmentCount > 1 && (
        <section className="space-y-4">
          <SnappingSlider
            label={t('binDesigner.wallThickness')}
            value={thickness}
            onChange={handleThicknessChange}
            options={thicknessOptions}
            unit="mm"
          />
          <DividerHeightControl />
        </section>
      )}

      <DividerTiltSubsection />
    </div>
  );
}
