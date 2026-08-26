/**
 * Sidebar cutout editor — thin wrapper around CutoutCanvas3D.
 *
 * Wires store state, interaction hook, and UI chrome (toolbar, property panel,
 * alignment toolbar, context menu) around the reusable CutoutCanvas3D WebGL canvas.
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useCutoutSelection,
  useDesignerStore,
  remainingCutoutCapacity,
} from '@/features/bin-designer/store';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';
import { useGroupLevel } from '@/features/bin-designer/hooks/useGroupLevel';
import { GroupBreadcrumb } from '../../CutoutWorkspace/GroupBreadcrumb';
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
import { CutoutCanvas3D } from './renderer';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { useSvgImport } from './svgImport';
import { useStlImport, StlImportDialog } from './stlImport';
import { ScanWithPhoneDialog } from './scanImport';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import type { FitCue } from './cutoutSectionVisibility';
import { applyFlattenArray } from './cutoutHelpers';
import { AlignmentToolbar } from './AlignmentToolbar';
import { CutoutContextMenu } from './CutoutContextMenu';
import type { ContextMenuAction } from './CutoutContextMenu';
import { CutoutEmptyState } from './CutoutEmptyState';
import { CutoutFillControls } from '@/features/bin-designer/components/controls';

/** Canvas width in CSS pixels (fits 288px sidebar) */
const CANVAS_WIDTH = 248;

export function CutoutEditor() {
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

  return (
    <div className="space-y-3 select-none">
      <CutoutShapeToolbar
        mode={mode}
        onSelectShape={setMode}
        snapEnabled={snapEnabled}
        onSnapToggle={setSnapEnabled}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        onImportSvg={triggerSvgImport}
        onImportStl={stlImport.triggerImport}
        onScanWithPhone={() => setScanDialogOpen(true)}
      />

      <ScanWithPhoneDialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} />

      <StlImportDialog
        pending={stlImport.pending}
        importing={stlImport.importing}
        onRotate={stlImport.setAxisRotation}
        onPlace={stlImport.place}
        onCancel={stlImport.cancel}
      />

      {/* Fill level: shared with the workspace inspector so the two agree */}
      <div className="rounded border border-stroke-subtle bg-surface-elevated p-3">
        <CutoutFillControls />
      </div>

      {/* Which level of the group tree the canvas below is working at. Renders
          nothing at the top, which is the usual case. */}
      <GroupBreadcrumb
        cutouts={cutouts}
        groupNames={params.cutoutGroupNames}
        context={groupContext}
        onNavigate={useCutoutSelection.getState().setGroupContext}
      />

      {/* WebGL Canvas */}
      <div
        className="relative rounded border border-stroke-subtle bg-surface-secondary overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        {cutouts.length === 0 && mode.type === 'idle' && (
          <CutoutEmptyState variant="sidebar" onScanWithPhone={() => setScanDialogOpen(true)} />
        )}
        <CutoutCanvas3D
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          cellMask={params.cellMask}
          taperBand={taperBand}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={canvasHeight}
          selection={selection}
          preview={preview}
          fitCue={fitCue}
          mode={mode}
          drawingPreview={drawingPreview}
          pathDrawingPreview={pathDrawingPreview}
          activeGuides={activeGuides}
          marquee={marquee}
          onBackgroundPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onSelectCutout={selectCutout}
          onDoubleClickCutout={handleDoubleClick}
          onDragStart={startDrag}
          onLabelDragStart={startLabelDrag}
          onResizeStart={startResize}
          onRotateStart={startRotation}
          onGroupRotateStart={startGroupRotation}
          onGroupScaleStart={startGroupScale}
          segmentHover={segmentHover}
          onPathDrawingVertexDown={onPathDrawingVertexDown}
          onVertexPointDown={handleVertexPointDown}
          onVertexHandleDown={handleVertexHandleDown}
          rulerMeasurement={rulerMeasurement}
          rulerZoomRef={rulerZoomRef}
        />
      </div>

      {/* Alignment toolbar for multi-select */}
      {selectedIds.length >= 2 && (
        <AlignmentToolbar
          selectedIds={selectedIds}
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          onUpdateBatch={updateCutoutsBatch}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onSetGroupOp={setGroupOp}
          onReorder={reorderCutouts}
          onDuplicate={duplicateCutouts}
        />
      )}

      {/* Property panel for single selection */}
      {selectedCutout && (
        <CutoutPropertyPanel
          cutout={selectedCutout}
          maxWidth={binWidth}
          maxDepth={binDepth}
          maxCutDepth={wallHeight}
          onUpdate={updateCutout}
          onRemove={removeCutout}
          onDuplicate={duplicateCutouts}
          disabled={isInteracting}
          onFitCue={setFitCue}
          onFlattenArray={handleFlattenArray}
        />
      )}

      {contextMenu && (
        <CutoutContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
