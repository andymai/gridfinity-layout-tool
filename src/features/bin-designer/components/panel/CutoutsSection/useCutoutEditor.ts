/** Store selections, grouping and editing handlers behind the cutout editor; the component keeps the markup. */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore, remainingCutoutCapacity } from '@/features/bin-designer/store';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';
import { useGroupLevel } from '@/features/bin-designer/hooks/useGroupLevel';
import { useToastStore } from '@/core/store/toast';
import {
  binDimensions,
  cutoutInterior,
  cutoutTaperBand,
} from '@/features/bin-designer/utils/binDimensions';
import {
  CENTER_ACTIONS,
  centerSelectionInBin,
  flipSelectionHorizontal,
  flipSelectionVertical,
} from './geometry';
import { useCutoutInteraction } from './useCutoutInteraction';
import { useTranslation } from '@/i18n';
import { useSvgImport } from './svgImport';
import { useStlImport } from './stlImport';
import type { FitCue } from './cutoutSectionVisibility';
import { applyFlattenArray } from './cutoutHelpers';
import type { ContextMenuAction } from './CutoutContextMenu';

/** Canvas width in CSS pixels (fits 288px sidebar) */
export const CANVAS_WIDTH = 248;

export function useCutoutEditor() {
  const {
    params,
    addCutout,
    updateCutout,
    removeCutout,
    duplicateCutouts,
    setGroupOp,
    updateCutoutsBatch,
    removeCutoutsBatch,
    reorderCutouts,
    undo,
    redo,
    canUndo,
    canRedo,
    lockCutouts,
    unlockCutouts,
    startTransaction,
    commitTransaction,
    cutoutTarget,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      duplicateCutouts: s.duplicateCutouts,
      setGroupOp: s.setGroupOp,
      updateCutoutsBatch: s.updateCutoutsBatch,
      removeCutoutsBatch: s.removeCutoutsBatch,
      reorderCutouts: s.reorderCutouts,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
      lockCutouts: s.lockCutouts,
      unlockCutouts: s.unlockCutouts,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      cutoutTarget: s.ui.cutoutTarget,
    }))
  );

  const { cutouts } = params;
  const { groupContext, handleGroup, handleUngroup } = useGroupLevel({ cutouts });

  // Overhang-expanded interior lets cutouts use the extra floor.
  const { wallHeight } = binDimensions(params);
  const { innerW: binWidth, innerD: binDepth } = cutoutInterior(params);
  const taperBand = cutoutTaperBand(params);
  // Mm-per-mask-cell in the editor's interior coordinate system. X and Y differ
  // on non-square bins because the interior is shrunk by wall + tolerance (an
  // absolute mm amount) independently on each axis. Keeping validator and
  // polygon renderer tied to the same derivation ensures the visible outline
  // traces the exact rejection boundary.
  const maskCellSize = params.cellMask
    ? { cellMmX: binWidth / params.cellMask.cols, cellMmY: binDepth / params.cellMask.rows }
    : undefined;

  const canvasHeight = (CANVAS_WIDTH * binDepth) / binWidth;

  const [gridSize, setGridSize] = useState(0.5);
  const [fitCue, setFitCue] = useState<FitCue>(null);

  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const handleFlattenArray = useCallback(
    (id: string) => {
      const capacity = remainingCutoutCapacity(cutoutTarget, params.lid.cutouts);
      const transaction = { start: startTransaction, commit: commitTransaction };
      if (
        applyFlattenArray(id, cutouts, updateCutout, addCutout, capacity, transaction) === 'no-room'
      ) {
        addToast(t('toast.flattenNoRoom', { max: MAX_LID_CUTOUTS }), 'error');
      }
    },
    [
      cutouts,
      updateCutout,
      addCutout,
      cutoutTarget,
      params.lid.cutouts,
      addToast,
      t,
      startTransaction,
      commitTransaction,
    ]
  );

  const {
    mode,
    setMode,
    selection,
    selectCutout,
    selectIndividual,
    deselectAll,
    selectAll,
    deleteSelected,
    preview,
    drawingPreview,
    pathDrawingPreview,
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
    segmentHover,
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
    rulerMeasurement,
    rulerZoomRef,
  } = useCutoutInteraction({
    cutouts,
    onUpdate: updateCutout,
    onRemove: removeCutout,
    onAdd: addCutout,
    onGroup: handleGroup,
    onUngroup: handleUngroup,
    onUpdateBatch: updateCutoutsBatch,
    onRemoveBatch: removeCutoutsBatch,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
    onLock: lockCutouts,
    onUnlock: unlockCutouts,
    startTransaction,
    commitTransaction,
    binWidth,
    binDepth,
    gridSize,
    cellMask: params.cellMask,
    maskCellSize,
    meshAssets: params.meshAssets,
  });

  const { triggerImport: triggerSvgImport } = useSvgImport();
  const stlImport = useStlImport();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  // Marquee state — in mm world coordinates
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Background click — receives mm world coords from R3F
  const handleBackgroundPointerDown = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      // Ruler tool: sticky mode (toolbar) or Shift+drag quick measurement
      if (mode.type === 'ruler-ready' || (nativeEvent.shiftKey && mode.type === 'idle')) {
        const sticky = mode.type === 'ruler-ready';
        setMode({ type: 'measuring', startX: worldX, startY: worldY, sticky });
        return;
      }

      // Path tool: start or continue path drawing
      if ((mode.type === 'placing' && mode.shape === 'path') || mode.type === 'path-drawing') {
        handlePathBackgroundDown(worldX, worldY, nativeEvent.shiftKey);
        return;
      }

      // Vertex editing: try segment hit-test for point insertion, deselect on miss
      if (mode.type === 'vertex-editing') {
        handleVertexBackgroundDown(worldX, worldY);
        return;
      }

      if (mode.type === 'placing') {
        setMode({ type: 'pending-place', shape: mode.shape, startMmX: worldX, startMmY: worldY });
        return;
      }

      deselectAll();
      marqueeStartRef.current = { x: worldX, y: worldY };
      setMarquee({ x: worldX, y: worldY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll, handlePathBackgroundDown, handleVertexBackgroundDown]
  );

  // Pointer move — receives mm world coords from R3F
  const handleCanvasPointerMove = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      if (
        mode.type === 'pending-place' ||
        mode.type === 'dragging' ||
        mode.type === 'resizing' ||
        mode.type === 'rotating' ||
        mode.type === 'group-rotating' ||
        mode.type === 'group-scaling' ||
        mode.type === 'drawing' ||
        mode.type === 'path-drawing' ||
        mode.type === 'vertex-editing' ||
        mode.type === 'measuring'
      ) {
        handlePointerMove(worldX, worldY, nativeEvent.shiftKey, nativeEvent.altKey);
        return;
      }

      if (!marqueeStartRef.current) return;
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: worldX - marqueeStartRef.current.x,
        h: worldY - marqueeStartRef.current.y,
      });
    },
    [mode, handlePointerMove]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (
      mode.type === 'pending-place' ||
      mode.type === 'dragging' ||
      mode.type === 'resizing' ||
      mode.type === 'rotating' ||
      mode.type === 'group-rotating' ||
      mode.type === 'group-scaling' ||
      mode.type === 'drawing' ||
      mode.type === 'path-drawing' ||
      mode.type === 'vertex-editing' ||
      mode.type === 'measuring'
    ) {
      handlePointerUp();
      return;
    }

    if (marquee && marqueeStartRef.current) {
      const mmLeft = Math.min(marquee.x, marquee.x + marquee.w);
      const mmRight = Math.max(marquee.x, marquee.x + marquee.w);
      const mmBottom = Math.min(marquee.y, marquee.y + marquee.h);
      const mmTop = Math.max(marquee.y, marquee.y + marquee.h);

      const mw = mmRight - mmLeft;
      const mh = mmTop - mmBottom;

      if (mw + mh > 2) {
        for (const cutout of cutouts) {
          const cRight = cutout.x + cutout.width;
          const cTop = cutout.y + cutout.depth;
          if (cutout.x < mmRight && cRight > mmLeft && cutout.y < mmTop && cTop > mmBottom) {
            selectCutout(cutout.id, true);
          }
        }
      }
    }

    marqueeStartRef.current = null;
    setMarquee(null);
  }, [mode, handlePointerUp, marquee, cutouts, selectCutout]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY);
    },
    [openContextMenu]
  );

  const isInteracting =
    mode.type === 'dragging' ||
    mode.type === 'resizing' ||
    mode.type === 'rotating' ||
    mode.type === 'group-rotating' ||
    mode.type === 'group-scaling';

  /** Double-click handler: enter vertex editing for path shapes, otherwise select individual. */
  const handleDoubleClick = useCallback(
    (id: string) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (cutout?.shape === 'path') {
        enterVertexEditing(id);
      } else {
        selectIndividual(id);
      }
    },
    [cutouts, enterVertexEditing, selectIndividual]
  );

  const selectedCutout =
    selection.size === 1 ? (cutouts.find((c) => selection.has(c.id)) ?? null) : null;
  const selectedIds = [...selection];

  const contextMenuActions = useMemo((): ContextMenuAction[] => {
    const hasSelection = selection.size > 0;
    const hasClipboard = clipboard.length > 0;
    const actions: ContextMenuAction[] = [];

    if (hasSelection) {
      actions.push({
        label: t('common.copy'),
        onClick: copySelected,
        shortcut: { keys: 'C', modifier: true },
      });
      actions.push({
        label: t('common.duplicate'),
        onClick: duplicateSelected,
        shortcut: { keys: 'D', modifier: true },
      });
      actions.push({
        label: t('common.delete'),
        onClick: deleteSelected,
        danger: true,
        dividerAfter: true,
        shortcut: { keys: 'Del' },
      });
    }

    actions.push({
      label: t('binDesigner.cutouts.paste'),
      onClick: pasteFromClipboard,
      disabled: !hasClipboard,
      shortcut: { keys: 'V', modifier: true },
    });

    actions.push({
      label: t('binDesigner.cutouts.selectAll'),
      onClick: selectAll,
      dividerAfter: hasSelection && selection.size < cutouts.length,
      shortcut: { keys: 'A', modifier: true },
    });

    if (hasSelection && selection.size === 1) {
      const cutout = cutouts.find((c) => selection.has(c.id));
      if (cutout) {
        actions.push({
          label: t('binDesigner.cutouts.rotate90'),
          onClick: () => {
            const newRotation = (cutout.rotation + 90) % 360;
            updateCutout(cutout.id, { rotation: newRotation });
          },
          shortcut: { keys: 'R' },
        });
      }
    }

    if (hasSelection) {
      const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
      const anyLocked = selectedCutouts.some((c) => c.locked);

      actions.push({
        label: t('binDesigner.cutouts.flipHorizontal'),
        onClick: () => {
          const updates = flipSelectionHorizontal(selectedCutouts);
          if (updates.size > 1) {
            updateCutoutsBatch(updates);
          } else {
            for (const [id, patch] of updates) {
              updateCutout(id, patch);
            }
          }
        },
        disabled: anyLocked,
        shortcut: { keys: 'H', shift: true },
      });

      actions.push({
        label: t('binDesigner.cutouts.flipVertical'),
        onClick: () => {
          const updates = flipSelectionVertical(selectedCutouts);
          if (updates.size > 1) {
            updateCutoutsBatch(updates);
          } else {
            for (const [id, patch] of updates) {
              updateCutout(id, patch);
            }
          }
        },
        disabled: anyLocked,
        shortcut: { keys: 'V', shift: true },
      });
    }

    if (hasSelection) {
      for (const { axis, key } of CENTER_ACTIONS) {
        actions.push({
          label: t(key),
          onClick: () => {
            const positions = centerSelectionInBin(
              cutouts,
              selection,
              binWidth,
              binDepth,
              axis,
              groupContext
            );
            for (const [id, pos] of Object.entries(positions)) {
              updateCutout(id, pos);
            }
          },
          dividerAfter: axis === 'y',
        });
      }

      const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
      const allLocked = selectedCutouts.every((c) => c.locked);

      actions.push({
        label: allLocked
          ? t('binDesigner.cutoutEditor.unlock')
          : t('binDesigner.cutoutEditor.lock'),
        onClick: () => {
          const ids = [...selection];
          if (allLocked) unlockCutouts(ids);
          else lockCutouts(ids);
        },
        shortcut: { keys: 'L', modifier: true },
      });
    }

    return actions;
  }, [
    selection,
    clipboard,
    cutouts,
    groupContext,
    copySelected,
    duplicateSelected,
    deleteSelected,
    pasteFromClipboard,
    selectAll,
    updateCutout,
    updateCutoutsBatch,
    binWidth,
    binDepth,
    lockCutouts,
    unlockCutouts,
    t,
  ]);

  return {
    params,
    updateCutout,
    removeCutout,
    duplicateCutouts,
    setGroupOp,
    updateCutoutsBatch,
    reorderCutouts,
    cutouts,
    groupContext,
    handleGroup,
    handleUngroup,
    wallHeight,
    binWidth,
    binDepth,
    taperBand,
    canvasHeight,
    gridSize,
    setGridSize,
    fitCue,
    setFitCue,
    handleFlattenArray,
    mode,
    setMode,
    selection,
    selectCutout,
    preview,
    drawingPreview,
    pathDrawingPreview,
    startDrag,
    startLabelDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
    onPathDrawingVertexDown,
    segmentHover,
    handleVertexPointDown,
    handleVertexHandleDown,
    snapEnabled,
    setSnapEnabled,
    activeGuides,
    contextMenu,
    closeContextMenu,
    rulerMeasurement,
    rulerZoomRef,
    triggerSvgImport,
    stlImport,
    scanDialogOpen,
    setScanDialogOpen,
    marquee,
    handleBackgroundPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleContextMenu,
    isInteracting,
    handleDoubleClick,
    selectedCutout,
    selectedIds,
    contextMenuActions,
  };
}
