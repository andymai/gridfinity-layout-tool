/**
 * Sidebar cutout editor — thin wrapper around CutoutCanvas3D.
 *
 * Wires store state, interaction hook, and UI chrome (toolbar, property panel,
 * alignment toolbar, context menu) around the reusable CutoutCanvas3D WebGL canvas.
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { centerInBin } from './geometry';
import { useCutoutInteraction } from './useCutoutInteraction';
import { useTranslation } from '@/i18n';
import { CutoutCanvas3D } from './renderer';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { CutoutContextMenu } from './CutoutContextMenu';
import type { ContextMenuAction } from './CutoutContextMenu';
import { SliderInput } from '../../controls/SliderInput';

/** Canvas width in CSS pixels (fits 288px sidebar) */
const CANVAS_WIDTH = 248;

export function CutoutEditor() {
  const {
    params,
    addCutout,
    updateCutout,
    removeCutout,
    duplicateCutouts,
    groupCutouts,
    ungroupCutouts,
    updateCutoutsBatch,
    removeCutoutsBatch,
    updateCutoutConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    lockCutouts,
    unlockCutouts,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      duplicateCutouts: s.duplicateCutouts,
      groupCutouts: s.groupCutouts,
      ungroupCutouts: s.ungroupCutouts,
      updateCutoutsBatch: s.updateCutoutsBatch,
      removeCutoutsBatch: s.removeCutoutsBatch,
      updateCutoutConfig: s.updateCutoutConfig,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
      lockCutouts: s.lockCutouts,
      unlockCutouts: s.unlockCutouts,
    }))
  );

  const { cutouts } = params;
  const outerW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const binWidth = outerW - 2 * params.wallThickness;
  const binDepth = outerD - 2 * params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - GRIDFINITY.BASE_HEIGHT;

  const canvasHeight = (CANVAS_WIDTH * binDepth) / binWidth;

  const [gridSize, setGridSize] = useState(0.5);

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
    startDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
    handlePointerMove,
    handlePointerUp,
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
  } = useCutoutInteraction({
    cutouts,
    onUpdate: updateCutout,
    onRemove: removeCutout,
    onAdd: addCutout,
    onGroup: groupCutouts,
    onUngroup: ungroupCutouts,
    onUpdateBatch: updateCutoutsBatch,
    onRemoveBatch: removeCutoutsBatch,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
    onLock: lockCutouts,
    onUnlock: unlockCutouts,
    binWidth,
    binDepth,
    gridSize,
  });

  const t = useTranslation();

  // Marquee state — in mm world coordinates
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Background click — receives mm world coords from R3F
  const handleBackgroundPointerDown = useCallback(
    (worldX: number, worldY: number, _nativeEvent: PointerEvent) => {
      if (mode.type === 'placing') {
        setMode({ type: 'pending-place', shape: mode.shape, startMmX: worldX, startMmY: worldY });
        return;
      }

      deselectAll();
      marqueeStartRef.current = { x: worldX, y: worldY };
      setMarquee({ x: worldX, y: worldY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll]
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
        mode.type === 'drawing'
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
      mode.type === 'drawing'
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

  const selectedCutout =
    selection.size === 1 ? (cutouts.find((c) => selection.has(c.id)) ?? null) : null;
  const selectedIds = [...selection];

  // Build context menu actions
  const contextMenuActions = useMemo((): ContextMenuAction[] => {
    const hasSelection = selection.size > 0;
    const hasClipboard = clipboard.length > 0;
    const actions: ContextMenuAction[] = [];

    if (hasSelection) {
      actions.push({ label: t('binDesigner.cutouts.copy'), onClick: copySelected });
      actions.push({ label: t('binDesigner.cutouts.duplicate'), onClick: duplicateSelected });
      actions.push({
        label: t('binDesigner.cutouts.delete'),
        onClick: deleteSelected,
        danger: true,
        dividerAfter: true,
      });
    }

    actions.push({
      label: t('binDesigner.cutouts.paste'),
      onClick: pasteFromClipboard,
      disabled: !hasClipboard,
    });

    actions.push({
      label: t('binDesigner.cutouts.selectAll'),
      onClick: selectAll,
      dividerAfter: hasSelection && selection.size < cutouts.length,
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
        });
      }
    }

    if (hasSelection) {
      actions.push({
        label: t('binDesigner.cutouts.centerInBin'),
        onClick: () => {
          const selected = cutouts.filter((c) => selection.has(c.id));
          const positions = centerInBin(selected, binWidth, binDepth);
          for (const [id, pos] of Object.entries(positions)) {
            updateCutout(id, pos);
          }
        },
        dividerAfter: true,
      });

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
      });
    }

    return actions;
  }, [
    selection,
    clipboard,
    cutouts,
    copySelected,
    duplicateSelected,
    deleteSelected,
    pasteFromClipboard,
    selectAll,
    updateCutout,
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
      />

      {/* Global top offset control */}
      <div className="rounded border border-stroke-subtle bg-surface-elevated p-3">
        <SliderInput
          label={t('binDesigner.cutouts.topOffset')}
          value={params.cutoutConfig.topOffset}
          onChange={(topOffset) => updateCutoutConfig({ topOffset })}
          min={0}
          max={wallHeight - 0.5}
          step={0.5}
          unit="mm"
        />
      </div>

      {/* WebGL Canvas */}
      <div
        className="rounded border border-stroke-subtle bg-surface-secondary overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        <CutoutCanvas3D
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={canvasHeight}
          selection={selection}
          preview={preview}
          mode={mode}
          drawingPreview={drawingPreview}
          activeGuides={activeGuides}
          marquee={marquee}
          onBackgroundPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onSelectCutout={selectCutout}
          onDoubleClickCutout={selectIndividual}
          onDragStart={startDrag}
          onResizeStart={startResize}
          onRotateStart={startRotation}
          onGroupRotateStart={startGroupRotation}
          onGroupScaleStart={startGroupScale}
        />
      </div>

      {/* Alignment toolbar for multi-select */}
      {selectedIds.length >= 2 && (
        <AlignmentToolbar
          selectedIds={selectedIds}
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          onUpdate={updateCutout}
          onGroup={groupCutouts}
          onUngroup={ungroupCutouts}
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
        />
      )}

      {/* Context menu */}
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
