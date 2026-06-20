/**
 * State machine hook for cutout editor interactions.
 *
 * Manages placement, selection, dragging, resizing, and marquee states.
 * Keyboard shortcuts: Delete, Ctrl+A, arrows (nudge), Escape.
 *
 * Pointer-move logic for each interaction mode is delegated to focused
 * handler functions in ./handlers/. Concern-specific state and effects
 * (clipboard, context menu, undo toasts, keyboard shortcuts, recovery,
 * transform starters, path tool) live in sibling sub-hooks below.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import { useCutoutSelection } from '@/features/bin-designer/store';
import { snapToGrid, getRotatedBounds, type AlignmentGuide } from './geometry';
import { cutoutFitsInMask } from './maskFit';
import type { PathDrawingPreviewState, SegmentHoverInfo } from './handlers';
import { collectSnapTargets } from './handlers/rulerHandler';
import type { RulerMeasurement } from './handlers/rulerHandler';
import {
  type InteractionMode,
  type PreviewMap,
  type UseCutoutInteractionOptions,
} from './cutoutInteractionTypes';
import { useCutoutClipboard } from './useCutoutClipboard';
import { useCutoutContextMenu } from './useCutoutContextMenu';
import { useCutoutUndoToasts } from './useCutoutUndoToasts';
import { useCutoutKeyboardShortcuts } from './useCutoutKeyboardShortcuts';
import { useCutoutRecovery } from './useCutoutRecovery';
import { useCutoutTransformStarters } from './useCutoutTransformStarters';
import { useCutoutPathTool } from './useCutoutPathTool';
import { useCutoutPointerHandlers } from './useCutoutPointerHandlers';

export type { ResizeHandle, InteractionMode, PreviewMap } from './cutoutInteractionTypes';

export function useCutoutInteraction({
  cutouts,
  onUpdate,
  onRemove,
  onAdd,
  onGroup,
  onUngroup,
  onUpdateBatch,
  onRemoveBatch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onLock,
  onUnlock,
  startTransaction,
  commitTransaction,
  binWidth,
  binDepth,
  gridSize = 0.5,
  cellMask,
  maskCellSize,
}: UseCutoutInteractionOptions) {
  const [mode, setMode] = useState<InteractionMode>({ type: 'placing', shape: 'rectangle' });
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [preview, setPreview] = useState<PreviewMap>(new Map());
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  /** Container ref — kept for potential external use but no longer needed for coordinate conversion */
  const containerRef = useRef<HTMLElement | null>(null);
  /** Track whether the dead zone has been exceeded during this drag/resize */
  const pastDeadZoneRef = useRef(false);
  /** Drawing preview (corner-to-corner shape being drawn) */
  const [drawingPreview, setDrawingPreview] = useState<{
    x: number;
    y: number;
    width: number;
    depth: number;
    shape: CutoutShape;
  } | null>(null);
  /** Path drawing preview (pen tool multi-click) */
  const [pathDrawingPreview, setPathDrawingPreview] = useState<PathDrawingPreviewState | null>(
    null
  );
  const [segmentHover, setSegmentHover] = useState<SegmentHoverInfo | null>(null);
  const [rulerMeasurement, setRulerMeasurement] = useState<RulerMeasurement | null>(null);
  /** Current zoom level — updated externally so ruler snap threshold adapts */
  const rulerZoomRef = useRef(1);

  /** Memoized snap targets for ruler — only recompute when cutouts array changes */
  const rulerSnapTargets = useMemo(() => collectSnapTargets(cutouts), [cutouts]);

  const snap = useCallback(
    (v: number) => (snapEnabled ? snapToGrid(v, gridSize) : v),
    [snapEnabled, gridSize]
  );

  // ── Selection ──────────────────────────────────────────────────────

  /** Select cutout; expands to full group unless additive. Skips hidden cutouts. */
  const selectCutout = useCallback(
    (id: string, additive: boolean) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;
      if (cutout.hidden) return;

      setSelection((prev) => {
        if (additive) {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          // Auto-join: if the clicked cutout is ungrouped and the selection
          // contains a group, auto-add the clicked cutout to that group
          if (onGroup && next.has(id) && !cutout.groupId) {
            const selectedWithGroup = cutouts.find((c) => next.has(c.id) && c.groupId !== null);
            if (selectedWithGroup) {
              onGroup([...next]);
            }
          }
          return next;
        }

        // Group-aware: select all cutouts with same groupId
        if (cutout.groupId) {
          const groupIds = cutouts.filter((c) => c.groupId === cutout.groupId).map((c) => c.id);
          return new Set(groupIds);
        }

        return new Set([id]);
      });
    },
    [cutouts, onGroup]
  );

  /** Double-click: select only the individual cutout (bypasses group) */
  const selectIndividual = useCallback((id: string) => {
    setSelection(new Set([id]));
  }, []);

  const deselectAll = useCallback(() => {
    setSelection(new Set());
    setActiveGuides([]);
  }, []);

  const selectAll = useCallback(() => {
    setSelection(new Set(cutouts.map((c) => c.id)));
  }, [cutouts]);

  // ── Bulk operations ────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (selection.size === 0) return;
    // Filter out locked cutouts — only delete unlocked ones
    const deletable = [...selection].filter((id) => {
      const c = cutouts.find((cut) => cut.id === id);
      return c && !c.locked;
    });
    if (deletable.length === 0) return;
    if (onRemoveBatch) {
      onRemoveBatch(deletable);
    } else {
      for (const id of deletable) {
        onRemove(id);
      }
    }
    setSelection(new Set());
  }, [selection, cutouts, onRemove, onRemoveBatch]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selection.size === 0) return;
      // Block nudge if any selected cutout is locked
      const anyLocked = cutouts.some((c) => selection.has(c.id) && c.locked);
      if (anyLocked) return;
      const updates = new Map<string, Partial<Cutout>>();
      for (const id of selection) {
        const cutout = cutouts.find((c) => c.id === id);
        if (!cutout) continue;
        // Use rotation-aware AABB for clamping — rotated shapes extend
        // beyond their unrotated box, so x must stay further from edges
        const rb = getRotatedBounds(cutout);
        const overhangX = (rb.maxX - rb.minX - cutout.width) / 2;
        const overhangY = (rb.maxY - rb.minY - cutout.depth) / 2;
        const minX = overhangX;
        const minY = overhangY;
        const maxX = binWidth - cutout.width - overhangX;
        const maxY = binDepth - cutout.depth - overhangY;
        updates.set(id, {
          x: Math.max(minX, Math.min(cutout.x + dx, maxX)),
          y: Math.max(minY, Math.min(cutout.y + dy, maxY)),
        });
      }

      // Polygon mask: reject the whole nudge if any cutout would overhang,
      // matching the "stuck" semantics of drag against the polygon edge.
      if (cellMask && maskCellSize) {
        for (const [id, patch] of updates) {
          const orig = cutouts.find((c) => c.id === id);
          if (!orig) continue;
          const candidate = { ...orig, ...patch };
          if (!cutoutFitsInMask(candidate, cellMask, maskCellSize)) return;
        }
      }

      if (onUpdateBatch) {
        onUpdateBatch(updates);
      } else {
        for (const [id, partial] of updates) {
          onUpdate(id, partial);
        }
      }
    },
    [selection, cutouts, onUpdate, onUpdateBatch, binWidth, binDepth, cellMask, maskCellSize]
  );

  // ── Sub-hooks: clipboard, context menu, undo toasts ───────────────

  const { clipboard, copySelected, pasteFromClipboard, duplicateSelected } = useCutoutClipboard({
    cutouts,
    selection,
    setSelection,
    onAdd,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
  });

  const { contextMenu, openContextMenu, closeContextMenu } = useCutoutContextMenu();

  const { undoWithToast, redoWithToast } = useCutoutUndoToasts({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
  });

  // ── Sub-hooks: path tool, transform lifecycle starters ────────────

  const {
    commitPath,
    handlePathBackgroundDown,
    onPathDrawingVertexDown,
    enterVertexEditing,
    handleVertexPointDown,
    handleVertexHandleDown,
    handleVertexBackgroundDown,
  } = useCutoutPathTool({
    mode,
    setMode,
    cutouts,
    onAdd,
    onUpdate,
    setSelection,
    setPathDrawingPreview,
    setPreview,
    setSegmentHover,
    snap,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
    startTransaction,
  });

  const {
    startDrag,
    startLabelDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
  } = useCutoutTransformStarters({
    cutouts,
    selection,
    setSelection,
    onAdd,
    setMode,
    pastDeadZoneRef,
  });

  // ── Sub-hook: pointer move/up dispatcher ──────────────────────────

  const { handlePointerMove, handlePointerUp } = useCutoutPointerHandlers({
    mode,
    setMode,
    cutouts,
    preview,
    setPreview,
    setActiveGuides,
    drawingPreview,
    setDrawingPreview,
    setPathDrawingPreview,
    setSegmentHover,
    setSelection,
    setRulerMeasurement,
    snap,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
    rulerSnapTargets,
    rulerZoomRef,
    pastDeadZoneRef,
    commitPath,
    onAdd,
    onUpdate,
    onUpdateBatch,
    commitTransaction,
  });

  // ── Sub-hooks: keyboard shortcuts, recovery effects ───────────────

  useCutoutKeyboardShortcuts({
    selection,
    cutouts,
    mode,
    deleteSelected,
    deselectAll,
    selectAll,
    nudgeSelected,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    undoWithToast,
    redoWithToast,
    onGroup,
    onUngroup,
    onUpdate,
    onUpdateBatch,
    onLock,
    onUnlock,
    setPreview,
    setActiveGuides,
    setDrawingPreview,
    setPathDrawingPreview,
    setMode,
    setSegmentHover,
    setSelection,
  });

  useCutoutRecovery({
    mode,
    setMode,
    setPreview,
    setActiveGuides,
    setDrawingPreview,
    setPathDrawingPreview,
    setRulerMeasurement,
  });

  // ── Derived state ──────────────────────────────────────────────────

  // Derive effective selection by pruning stale IDs (avoids setState in effect)
  const effectiveSelection = useMemo(() => {
    const cutoutIds = new Set(cutouts.map((c) => c.id));
    let hasStale = false;
    for (const id of selection) {
      if (!cutoutIds.has(id)) {
        hasStale = true;
        break;
      }
    }
    if (!hasStale) return selection;
    const cleaned = new Set<string>();
    for (const id of selection) {
      if (cutoutIds.has(id)) cleaned.add(id);
    }
    return cleaned;
  }, [cutouts, selection]);

  // ── Store sync ─────────────────────────────────────────────────────

  // Sync selection to shared store so the 3D preview can highlight selected cutouts
  useEffect(() => {
    useCutoutSelection.getState().setSelectedIds(effectiveSelection);
  }, [effectiveSelection]);

  // Sync preview overrides to shared store so 3D preview updates during interactions
  useEffect(() => {
    useCutoutSelection.getState().setPreviewOverrides(preview);
  }, [preview]);

  // Clear shared selection on unmount (e.g. switching away from solid mode)
  useEffect(() => {
    return () => {
      useCutoutSelection.getState().setSelectedIds(new Set());
      useCutoutSelection.getState().setPreviewOverrides(new Map());
    };
  }, []);

  return {
    mode,
    setMode,
    selection: effectiveSelection,
    selectCutout,
    selectIndividual,
    deselectAll,
    selectAll,
    deleteSelected,
    containerRef,
    preview,
    drawingPreview,
    pathDrawingPreview,
    segmentHover,
    startDrag,
    startLabelDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
    handlePointerMove,
    handlePointerUp,
    handlePathBackgroundDown,
    onPathDrawingVertexDown,
    enterVertexEditing,
    handleVertexPointDown,
    handleVertexHandleDown,
    handleVertexBackgroundDown,
    snapEnabled,
    setSnapEnabled,
    activeGuides,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    clipboard,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    canUndo: canUndo ?? false,
    canRedo: canRedo ?? false,
    undoWithToast,
    redoWithToast,
    rulerMeasurement,
    rulerZoomRef,
  };
}
