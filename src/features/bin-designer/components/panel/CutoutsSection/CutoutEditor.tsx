/**
 * Sidebar cutout editor — thin wrapper around CutoutCanvas.
 *
 * Wires store state, interaction hook, and UI chrome (toolbar, property panel,
 * alignment toolbar, context menu) around the reusable CutoutCanvas SVG.
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { centerInBin } from './geometry';
import { useCutoutInteraction } from './useCutoutInteraction';
import { useTranslation } from '@/i18n';
import { CutoutCanvas } from './CutoutCanvas';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { CutoutContextMenu } from './CutoutContextMenu';
import type { ContextMenuAction } from './CutoutContextMenu';

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
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      duplicateCutouts: s.duplicateCutouts,
      groupCutouts: s.groupCutouts,
      ungroupCutouts: s.ungroupCutouts,
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

  const scale = CANVAS_WIDTH / binWidth;
  const canvasHeight = binDepth * scale;

  const {
    mode,
    setMode,
    selection,
    selectCutout,
    selectIndividual,
    deselectAll,
    selectAll,
    deleteSelected,
    containerRef,
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
    binWidth,
    binDepth,
  });

  const t = useTranslation();

  // Marquee state
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  const svgToMm = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      const rect = svg.getBoundingClientRect();
      const svgX = clientX - rect.left;
      const svgY = clientY - rect.top;
      const mmX = svgX / scale;
      const mmY = binDepth - svgY / scale;
      return { mmX, mmY, svgX, svgY };
    },
    [scale, binDepth]
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = containerRef.current;
      if (!svg) return;
      const { mmX, mmY, svgX, svgY } = svgToMm(e.clientX, e.clientY, svg);

      if (mode.type === 'placing') {
        setMode({ type: 'drawing', shape: mode.shape, startMmX: mmX, startMmY: mmY });
        return;
      }

      deselectAll();
      marqueeStartRef.current = { x: svgX, y: svgY };
      setMarquee({ x: svgX, y: svgY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll, svgToMm, containerRef]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (
        mode.type === 'dragging' ||
        mode.type === 'resizing' ||
        mode.type === 'rotating' ||
        mode.type === 'group-rotating' ||
        mode.type === 'group-scaling' ||
        mode.type === 'drawing'
      ) {
        const svg = containerRef.current;
        if (!svg) return;
        const { mmX, mmY } = svgToMm(e.clientX, e.clientY, svg);
        handlePointerMove(mmX, mmY, e.shiftKey, e.altKey);
        return;
      }

      if (!marqueeStartRef.current || !containerRef.current) return;
      const svg = containerRef.current;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: svgX - marqueeStartRef.current.x,
        h: svgY - marqueeStartRef.current.y,
      });
    },
    [containerRef, mode, svgToMm, handlePointerMove]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (
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
      const mx = Math.min(marquee.x, marquee.x + marquee.w);
      const my = Math.min(marquee.y, marquee.y + marquee.h);
      const mw = Math.abs(marquee.w);
      const mh = Math.abs(marquee.h);

      if (mw + mh > 5) {
        const mmLeft = mx / scale;
        const mmRight = (mx + mw) / scale;
        const mmTop = binDepth - my / scale;
        const mmBottom = binDepth - (my + mh) / scale;
        const minY = Math.min(mmBottom, mmTop);
        const maxY = Math.max(mmBottom, mmTop);

        for (const cutout of cutouts) {
          const cRight = cutout.x + cutout.width;
          const cTop = cutout.y + cutout.depth;
          if (cutout.x < mmRight && cRight > mmLeft && cutout.y < maxY && cTop > minY) {
            selectCutout(cutout.id, true);
          }
        }
      }
    }

    marqueeStartRef.current = null;
    setMarquee(null);
  }, [mode, handlePointerUp, marquee, scale, binDepth, cutouts, selectCutout]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
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
    t,
  ]);

  return (
    <div className="space-y-3">
      <CutoutShapeToolbar
        mode={mode}
        onSelectShape={setMode}
        snapEnabled={snapEnabled}
        onSnapToggle={setSnapEnabled}
      />

      {/* SVG Canvas */}
      <div className="rounded border border-stroke-subtle bg-surface-secondary overflow-hidden">
        <CutoutCanvas
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={canvasHeight}
          scale={scale}
          selection={selection}
          preview={preview}
          mode={mode}
          drawingPreview={drawingPreview}
          activeGuides={activeGuides}
          marquee={marquee}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerUp={handleCanvasPointerUp}
          onContextMenu={handleContextMenu}
          svgRef={containerRef}
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
