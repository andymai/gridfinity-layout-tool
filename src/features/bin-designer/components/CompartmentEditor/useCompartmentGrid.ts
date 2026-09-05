/**
 * The compartment grid's editing model, shared by both surfaces that draw it:
 * the sidebar {@link CompartmentEditor} and the full-size Bento workspace.
 *
 * Everything here is about WHAT the grid is and how pointer input changes it —
 * cell ownership, drag-to-merge/split, the 3D ghost preview, divider hit
 * targets. Nothing here decides how big the grid is drawn or what chrome
 * surrounds it; that belongs to the surface.
 *
 * Extracted rather than duplicated because the two surfaces must agree: a
 * merge rule that differed between the sidebar and the workspace would be a
 * silent correctness bug, not a styling difference.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import {
  getCompartmentCount,
  getEligibleDividers,
  isRectangularSelection,
  cellIndex,
  previewMergeCells,
  previewSplitCells,
} from '@/features/bin-designer/utils/compartments';
import { getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import { labelTabInteriorDims } from '@/shared/utils/labelTabPlan';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { usePreviewColor } from '@/features/bin-designer/hooks/usePreviewColor';
import { useCompartmentLabeling } from './useCompartmentLabeling';
import { rowKeyOf } from './useDividerTiltSubsection';

const EMPTY_HIGHLIGHT_SET: ReadonlySet<number> = new Set();

export type SelectionAction = 'merge' | 'split' | 'none';

export function useCompartmentGrid() {
  const t = useTranslation();
  const {
    compartments,
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    style,
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
    params,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      wallThickness: s.params.wallThickness,
      params: s.params,
      style: s.params.style,
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

  // Diagonal dividers are an advanced opt-in (see DividerTiltSubsection), but
  // the overlay renders regardless: committed tilts must draw truthfully, and
  // the hit targets double as the feature's discovery affordance — clicking a
  // divider before opting in enables editing and selects it in one step.
  const angledDividersEnabled = useSettingsStore((s) => s.settings.angledDividersEnabled);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const addToast = useToastStore((s) => s.addToast);

  const handleDividerSelect = useCallback(
    (key: string) => {
      if (!angledDividersEnabled) {
        updateSetting('angledDividersEnabled', true);
        trackEvent('divider_editing_toggled', { enabled: true, source: 'canvas' });
      }
      setSelectedDividerKey(key);
    },
    [angledDividersEnabled, updateSetting, setSelectedDividerKey]
  );

  const { innerW: interiorW, innerD: interiorD } = getInteriorDims({
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
  });

  // Height of the divider walls, which is what turns a lean angle into the foot
  // travel the overlay draws. Resolved through the pair the worker uses.
  const interior = labelTabInteriorDims(params);
  const dividerHeightMm = interior
    ? resolveCompartmentDividerHeight(compartments.dividerHeight, interior.interiorHeight)
    : 0;

  const { cols, rows, thickness, cells } = compartments;
  const compartmentCount = getCompartmentCount(compartments);
  const labeling = useCompartmentLabeling(compartments, style, compartmentCount);

  // Preview color synced with 3D preview (cross-tab + same-window CustomEvent)
  const previewColor = usePreviewColor();

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
  // Takes compartment IDs and speaks display numbers — the "Comp. N" the grid
  // draws comes from reading order, not the ID.
  const { displayNumberOf } = labeling;
  const rowLabelForHitTarget = useCallback(
    (a: number, b: number) => {
      const [lo, hi] = [displayNumberOf(a), displayNumberOf(b)].sort((x, y) => x - y);
      return t('binDesigner.angledDividers.editRowLabel', { a: String(lo), b: String(hi) });
    },
    [t, displayNumberOf]
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
  const selectionAction = useMemo((): SelectionAction => {
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

    const newCells =
      selectionAction === 'merge'
        ? previewMergeCells(cells, indices)
        : previewSplitCells(cells, indices);

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

  const handleCellPointerDown = useCallback(
    (idx: number) => {
      // Label mode: click selects for text entry. Setting no drag state keeps
      // the merge/split pointer-up branch inert.
      if (labeling.labelMode) {
        labeling.selectCompartment(cells[idx]);
        return;
      }
      setDragStart(idx);
      setIsDragging(true);
      setSelection(new Set([idx]));
    },
    [labeling, cells]
  );

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

  // All grid-dimension changes funnel through here so the "N labels cleared"
  // warning is shown consistently and the selection is reset once.
  const applyGrid = useCallback(
    (newCols: number, newRows: number) => {
      // Rounded for the same reason as the bento header: the Stepper commits
      // decimals, and a fractional cols/rows builds a cells array shorter than
      // cols * rows.
      const droppedLabels = setCompartmentGrid(Math.round(newCols), Math.round(newRows));
      if (droppedLabels > 0) {
        addToast({
          message: t('binDesigner.compartmentEditor.labelsCleared', { count: droppedLabels }),
          type: 'info',
          duration: 4000,
        });
      }
      setSelection(new Set());
    },
    [setCompartmentGrid, addToast, t]
  );

  const stepGrid = useCallback(
    (axis: 'cols' | 'rows', delta: number) => {
      const next = (axis === 'cols' ? cols : rows) + delta;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID, next)
      );
      applyGrid(axis === 'cols' ? clamped : cols, axis === 'rows' ? clamped : rows);
    },
    [cols, rows, applyGrid]
  );

  const handleThicknessChange = useCallback(
    (newThickness: number) => {
      setParam('compartments', { ...compartments, thickness: newThickness });
    },
    [compartments, setParam]
  );

  const handleReset = useCallback(() => {
    applyGrid(cols, rows);
  }, [cols, rows, applyGrid]);

  const hasMergedCompartments = compartmentCount < cols * rows;

  // Check if hovered cell is in a multi-cell compartment (splittable)
  const hoveredIsSplittable = useMemo(() => {
    if (hoverIdx === null || isDragging) return false;
    const cId = cells[hoverIdx];
    return (compartmentCellCounts.get(cId) ?? 0) > 1;
  }, [hoverIdx, cells, isDragging, compartmentCellCounts]);

  // Dynamic instruction text
  const instructionText = useMemo(() => {
    if (labeling.labelMode) {
      return t('binDesigner.compartmentEditor.clickToLabel');
    }
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
  }, [labeling.labelMode, isDragging, selection.size, selectionAction, hoveredIsSplittable, t]);

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

  const aspectRatio = depth > 0 ? width / depth : 1;

  return {
    compartments,
    cols,
    rows,
    cells,
    thickness,
    interiorW,
    interiorD,
    dividerHeightMm,
    compartmentCount,
    compartmentCellCounts,
    hasMergedCompartments,
    aspectRatio,
    gridDots,
    labeling,
    previewColor,
    angledDividersEnabled,
    eligibleDividers,
    dividerHighlightCompartments,
    dividerTiltPreview,
    selectedDividerKey,
    hoveredDividerKey,
    setSelectedDividerKey,
    setHoveredDividerKey,
    handleDividerSelect,
    rowLabelForHitTarget,
    selection,
    isDragging,
    hoverIdx,
    setHoverIdx,
    selectionAction,
    hoveredIsSplittable,
    instructionText,
    gridRef,
    handleCellPointerDown,
    handleCellPointerEnter,
    handleCellPointerLeave,
    handlePointerUp,
    applyGrid,
    stepGrid,
    handleThicknessChange,
    handleReset,
  };
}

export type CompartmentGridApi = ReturnType<typeof useCompartmentGrid>;
