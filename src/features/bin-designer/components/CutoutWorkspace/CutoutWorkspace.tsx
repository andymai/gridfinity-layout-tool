/**
 * Full-workspace cutout editor layout shell.
 *
 * Replaces the sidebar when cutoutEditorOpen is true, providing a larger
 * canvas area for editing cutouts alongside the 3D preview.
 *
 * Composes: WorkspaceHeader, CutoutCanvas3D (WebGL renderer), and
 * wires useCutoutInteraction for the interaction state machine.
 */

import { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { centerInBin } from '../panel/CutoutsSection/geometry';
import { useCutoutInteraction } from '../panel/CutoutsSection/useCutoutInteraction';
import { CutoutCanvas3D } from '../panel/CutoutsSection/renderer';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  FIT_PADDING,
} from '../panel/CutoutsSection/renderer/constants';
import { WorkspaceHeader } from './WorkspaceHeader';
import { CutoutShapeToolbar } from '../panel/CutoutsSection/CutoutShapeToolbar';
import { FloatingInspector } from './FloatingInspector';
import { CutoutContextMenu } from '../panel/CutoutsSection/CutoutContextMenu';
import type { ContextMenuAction } from '../panel/CutoutsSection/CutoutContextMenu';
import { TopRuler, LeftRuler, RulerCorner } from './Rulers';
import { useTranslation } from '@/i18n';

/**
 * Placeholder zoom/pan state for the workspace mode.
 *
 * In the WebGL renderer, zoom/pan is managed by the OrthographicCamera
 * inside the R3F Canvas via useViewportCamera. Since the camera lives
 * inside the Canvas tree, we manage a lightweight mirror for the rulers
 * and header. The R3F SceneContent uses useViewportCamera internally.
 *
 * TODO: Connect ruler sync once useViewportCamera exposes state via ref/context.
 */
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
    updateCutoutsBatch,
    removeCutoutsBatch,
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
      clearCutouts: s.clearCutouts,
      duplicateCutouts: s.duplicateCutouts,
      groupCutouts: s.groupCutouts,
      ungroupCutouts: s.ungroupCutouts,
      updateCutoutsBatch: s.updateCutoutsBatch,
      removeCutoutsBatch: s.removeCutoutsBatch,
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

  const t = useTranslation();

  // Measure canvas container dynamically
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });

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

  const canvasWidth = containerSize.width;
  const canvasHeight = containerSize.height;

  // Lightweight zoom state for rulers & header (mirrors camera zoom)
  const defaultZoom = useMemo(() => {
    const pad = 1 - 2 * FIT_PADDING;
    return Math.min((canvasWidth * pad) / binWidth, (canvasHeight * pad) / binDepth, MAX_ZOOM);
  }, [canvasWidth, canvasHeight, binWidth, binDepth]);

  const [zoom, setZoom] = useState(defaultZoom);
  const [cameraCenter, setCameraCenter] = useState({ x: binWidth / 2, y: binDepth / 2 });

  // Re-fit camera when bin dimensions or container size change
  /* eslint-disable react-hooks/set-state-in-effect -- syncing camera to external bin dimension changes from designer store */
  useEffect(() => {
    setZoom(defaultZoom);
    setCameraCenter({ x: binWidth / 2, y: binDepth / 2 });
  }, [defaultZoom, binWidth, binDepth]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fitToView = useCallback(() => {
    const pad = 1 - 2 * FIT_PADDING;
    const newZoom = Math.min(
      (canvasWidth * pad) / binWidth,
      (canvasHeight * pad) / binDepth,
      MAX_ZOOM
    );
    setZoom(newZoom);
    setCameraCenter({ x: binWidth / 2, y: binDepth / 2 });
  }, [canvasWidth, canvasHeight, binWidth, binDepth]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  const zoomPercent = Math.round((zoom / defaultZoom) * 100);

  // Ruler sync: scale=1 for WebGL (world units = mm), zoom from camera
  const scale = 1;
  const rulerPanX = -(cameraCenter.x - canvasWidth / (2 * zoom));
  const rulerPanY = cameraCenter.y + canvasHeight / (2 * zoom) - binDepth;

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
    pathDrawingPreview,
    startDrag,
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

  // Marquee state — now in mm world coordinates (no SVG pixel conversion needed)
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

  // Cursor world position for coordinate display
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);

  // Keyboard shortcuts: Space-to-pan, Ctrl+0 fit-to-view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToView();
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
  }, [fitToView]);

  // Background click handler — receives world-space mm coords from R3F
  const handleBackgroundPointerDown = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      // Middle-click starts pan
      if (nativeEvent.button === 1) {
        nativeEvent.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        return;
      }

      // Space+click starts pan
      if (spaceHeld && nativeEvent.button === 0) {
        nativeEvent.preventDefault();
        spacePanRef.current = true;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        return;
      }

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
      // Marquee in mm world coords
      marqueeStartRef.current = { x: worldX, y: worldY };
      setMarquee({ x: worldX, y: worldY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll, spaceHeld, handlePathBackgroundDown, handleVertexBackgroundDown]
  );

  // Pointer move — receives world-space mm coords from R3F
  const handleCanvasPointerMove = useCallback(
    (worldX: number, worldY: number, nativeEvent: PointerEvent) => {
      // Track cursor world position for coordinate display
      setCursorWorldPos({ x: worldX, y: worldY });

      // Handle middle-click or space pan
      if (isPanningRef.current || spacePanRef.current) {
        const dx = nativeEvent.clientX - panStartRef.current.x;
        const dy = nativeEvent.clientY - panStartRef.current.y;
        panStartRef.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
        // Pan: adjust camera center
        setCameraCenter((prev) => ({
          x: prev.x - dx / zoom,
          y: prev.y + dy / zoom,
        }));
        return;
      }

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

      // Marquee update — in mm world coords
      if (!marqueeStartRef.current) return;
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: worldX - marqueeStartRef.current.x,
        h: worldY - marqueeStartRef.current.y,
      });
    },
    [mode, handlePointerMove, zoom]
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

    // Marquee selection — coordinates are already in mm world space
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

  // Wheel zoom handler on the container div
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      if (newZoom === zoom) return;

      // Cursor position in screen pixels relative to the container
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Cursor in world coordinates (before zoom change)
      const worldX = cameraCenter.x + (cx - canvasWidth / 2) / zoom;
      const worldY = cameraCenter.y - (cy - canvasHeight / 2) / zoom;

      // After zoom, same screen pixel should map to same world point
      setCameraCenter({
        x: worldX - (cx - canvasWidth / 2) / newZoom,
        y: worldY + (cy - canvasHeight / 2) / newZoom,
      });
      setZoom(newZoom);
    },
    [zoom, cameraCenter, canvasWidth, canvasHeight]
  );

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

      // Lock/hide/layer ordering
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
    <div className="flex h-full flex-col bg-surface-secondary select-none">
      <WorkspaceHeader
        zoomPercent={zoomPercent}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToView={fitToView}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        cursorWorldPos={cursorWorldPos}
        cutouts={cutouts}
        selection={selection}
        binWidth={binWidth}
        binDepth={binDepth}
        onUpdate={updateCutout}
        onRemove={removeCutout}
        onDuplicate={duplicateCutouts}
        onGroup={groupCutouts}
        onUngroup={ungroupCutouts}
        onClearAll={clearCutouts}
        disabled={isInteracting}
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
              gridSize={gridSize}
              onGridSizeChange={setGridSize}
              vertical
            />
          </div>
        </div>

        {/* Center: Rulers + Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top ruler row */}
          <div className="flex flex-shrink-0">
            <RulerCorner onDoubleClick={fitToView} />
            <TopRuler
              extent={binWidth}
              scale={scale}
              zoom={zoom}
              panOffset={rulerPanX}
              length={containerSize.width}
            />
          </div>
          {/* Left ruler + canvas row */}
          <div className="flex flex-1 overflow-hidden">
            <LeftRuler
              extent={binDepth}
              scale={scale}
              zoom={zoom}
              panOffset={rulerPanY}
              length={containerSize.height}
            />
            <div
              ref={canvasContainerRef}
              className={`relative flex-1 overflow-hidden bg-surface ${spaceHeld ? 'cursor-grab' : ''}`}
              onWheel={handleWheel}
              onContextMenu={handleContextMenu}
            >
              <CutoutCanvas3D
                cutouts={cutouts}
                binWidth={binWidth}
                binDepth={binDepth}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                selection={selection}
                preview={preview}
                mode={mode}
                drawingPreview={drawingPreview}
                pathDrawingPreview={pathDrawingPreview}
                activeGuides={activeGuides}
                marquee={marquee}
                onBackgroundPointerDown={handleBackgroundPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onSelectCutout={selectCutout}
                onDoubleClickCutout={(id: string) => {
                  const cutout = cutouts.find((c) => c.id === id);
                  if (cutout?.shape === 'path') {
                    enterVertexEditing(id);
                  } else {
                    selectIndividual(id);
                  }
                }}
                onDragStart={startDrag}
                onResizeStart={startResize}
                onRotateStart={startRotation}
                onGroupRotateStart={startGroupRotation}
                onGroupScaleStart={startGroupScale}
                segmentHover={segmentHover}
                onPathDrawingVertexDown={onPathDrawingVertexDown}
                onVertexPointDown={handleVertexPointDown}
                onVertexHandleDown={handleVertexHandleDown}
                externalZoom={zoom}
                externalCameraCenter={cameraCenter}
                rulerMeasurement={rulerMeasurement}
                rulerZoomRef={rulerZoomRef}
              />
              {/* Floating inspector overlay */}
              <FloatingInspector
                cutouts={cutouts}
                selection={selection}
                preview={preview}
                binWidth={binWidth}
                binDepth={binDepth}
                maxCutDepth={wallHeight}
                onUpdate={updateCutout}
                onUpdateBatch={updateCutoutsBatch}
                zoom={zoom}
                cameraCenter={cameraCenter}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                hidden={isInteracting}
                disabled={isInteracting}
              />
            </div>
          </div>
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
