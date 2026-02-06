/**
 * Full-workspace cutout editor layout shell.
 *
 * Replaces the sidebar when cutoutEditorOpen is true, providing a larger
 * canvas area for editing cutouts alongside the 3D preview.
 *
 * Composes: WorkspaceHeader, CutoutCanvas (from CutoutsSection), and
 * wires useCutoutInteraction + useCanvasViewport.
 */

import { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { centerInBin } from '../panel/CutoutsSection/geometry';
import { useCutoutInteraction } from '../panel/CutoutsSection/useCutoutInteraction';
import { useCanvasViewport } from './useCanvasViewport';
import { WorkspaceHeader } from './WorkspaceHeader';
import { CutoutCanvas } from '../panel/CutoutsSection/CutoutCanvas';
import { CutoutShapeToolbar } from '../panel/CutoutsSection/CutoutShapeToolbar';
import { InspectorPanel } from './InspectorPanel';
import { CutoutContextMenu } from '../panel/CutoutsSection/CutoutContextMenu';
import type { ContextMenuAction } from '../panel/CutoutsSection/CutoutContextMenu';
import { TopRuler, LeftRuler, RulerCorner } from './Rulers';
import { useTranslation } from '@/i18n';

export function CutoutWorkspace() {
  const {
    params,
    addCutout,
    updateCutout,
    removeCutout,
    clearCutouts,
    duplicateCutouts,
    groupCutouts,
    ungroupCutouts,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      clearCutouts: s.clearCutouts,
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

  const t = useTranslation();

  // Measure canvas container dynamically
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });
  const needsAutoFit = useRef(true);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Canvas fills the container; scale maps mm → SVG pixels
  const { canvasWidth, canvasHeight, scale } = useMemo(() => {
    const cw = containerSize.width;
    const ch = containerSize.height;
    // Scale: fit the bin within the container (whichever axis is tighter)
    const s = Math.min(cw / binWidth, ch / binDepth);
    return { canvasWidth: cw, canvasHeight: ch, scale: s };
  }, [binWidth, binDepth, containerSize]);

  const viewport = useCanvasViewport({
    canvasWidth,
    canvasHeight,
    scale,
    binWidth,
    binDepth,
  });

  // Auto-fit on first meaningful container measurement
  useEffect(() => {
    if (needsAutoFit.current && containerSize.width > 100 && containerSize.height > 100) {
      needsAutoFit.current = false;
      requestAnimationFrame(() => viewport.fitToView());
    }
  }, [containerSize, viewport]);

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

  // Marquee state
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Middle-click pan state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Space-to-pan state
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spacePanRef = useRef(false);

  // Keyboard shortcuts: Space-to-pan, Ctrl+0 fit-to-view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        viewport.fitToView();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        spacePanRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [viewport]);

  const svgToMm = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      // Use getScreenCTM for zoom-safe coordinate conversion
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const svgPoint = point.matrixTransform(ctm.inverse());
        const mmX = svgPoint.x / scale;
        const mmY = binDepth - svgPoint.y / scale;
        return { mmX, mmY, svgX: svgPoint.x, svgY: svgPoint.y };
      }
      // Fallback
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
      // Middle-click starts pan
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Space+click starts pan
      if (spaceHeld && e.button === 0) {
        e.preventDefault();
        spacePanRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

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
    [mode, setMode, deselectAll, svgToMm, containerRef, spaceHeld]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Handle middle-click or space pan
      if (isPanningRef.current || spacePanRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        viewport.panBy(dx, dy);
        return;
      }

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
      const { svgX, svgY } = svgToMm(e.clientX, e.clientY, svg);
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: svgX - marqueeStartRef.current.x,
        h: svgY - marqueeStartRef.current.y,
      });
    },
    [containerRef, mode, svgToMm, handlePointerMove, viewport]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    if (spacePanRef.current) {
      spacePanRef.current = false;
      return;
    }

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
    <div className="flex h-full flex-col bg-surface-secondary">
      <WorkspaceHeader
        zoomPercent={viewport.zoomPercent}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onFitToView={viewport.fitToView}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbar */}
        <div className="flex w-11 flex-shrink-0 flex-col border-r border-stroke-subtle bg-surface-secondary">
          <div className="p-1.5">
            <CutoutShapeToolbar
              mode={mode}
              onSelectShape={setMode}
              snapEnabled={snapEnabled}
              onSnapToggle={setSnapEnabled}
              vertical
            />
          </div>
        </div>

        {/* Center: Rulers + Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top ruler row */}
          <div className="flex flex-shrink-0">
            <RulerCorner onDoubleClick={viewport.fitToView} />
            <TopRuler
              extent={binWidth}
              scale={scale}
              zoom={viewport.zoom}
              panOffset={viewport.rulerPanX}
              length={containerSize.width}
            />
          </div>
          {/* Left ruler + canvas row */}
          <div className="flex flex-1 overflow-hidden">
            <LeftRuler
              extent={binDepth}
              scale={scale}
              zoom={viewport.zoom}
              panOffset={viewport.rulerPanY}
              length={containerSize.height}
            />
            <div
              ref={canvasContainerRef}
              className={`flex-1 overflow-hidden bg-surface ${spaceHeld ? 'cursor-grab' : ''}`}
              onWheel={viewport.handleWheel}
            >
              <CutoutCanvas
                cutouts={cutouts}
                binWidth={binWidth}
                binDepth={binDepth}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                scale={scale}
                viewBox={viewport.viewBox}
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
          </div>
        </div>

        {/* Right: Inspector panel */}
        <div className="w-56 flex-shrink-0 overflow-y-auto border-l-2 border-stroke-subtle bg-surface-secondary p-3">
          <InspectorPanel
            cutouts={cutouts}
            selection={selection}
            binWidth={binWidth}
            binDepth={binDepth}
            maxCutDepth={wallHeight}
            onUpdate={updateCutout}
            onRemove={removeCutout}
            onDuplicate={duplicateCutouts}
            onGroup={groupCutouts}
            onUngroup={ungroupCutouts}
            onClearAll={clearCutouts}
            disabled={isInteracting}
          />
        </div>
      </div>

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
