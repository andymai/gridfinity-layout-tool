/**
 * Full-workspace cutout editor layout shell.
 *
 * Replaces the sidebar when cutoutEditorOpen is true, providing a larger
 * canvas area for editing cutouts alongside the 3D preview.
 *
 * Composes: WorkspaceHeader, CutoutCanvas3D (WebGL renderer), and
 * wires useCutoutInteraction for the interaction state machine.
 *
 * Sub-modules in sibling files:
 *   - `useCutoutWorkspaceCamera`         — zoom/pan state + handleWheel
 *   - `useCutoutWorkspacePointer`        — background/move/up + marquee + pan
 *   - `cutoutWorkspaceContextActions`    — right-click menu builder
 */

import { useCallback, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useCutoutInteraction } from '../panel/CutoutsSection/useCutoutInteraction';
import { CutoutCanvas3D } from '../panel/CutoutsSection/renderer';
import { WorkspaceHeader } from './WorkspaceHeader';
import { CutoutShapeToolbar } from '../panel/CutoutsSection/CutoutShapeToolbar';
import { useSvgImport } from '../panel/CutoutsSection/svgImport';
import { ScanWithPhoneDialog } from '../panel/CutoutsSection/scanImport';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { InspectorDock } from './InspectorDock';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { applyFlattenArray } from '../panel/CutoutsSection/cutoutHelpers';
import { CutoutContextMenu } from '../panel/CutoutsSection/CutoutContextMenu';
import { TopRuler, LeftRuler, RulerCorner } from './Rulers';
import { CutoutQuickstartOverlay } from './CutoutQuickstartOverlay';
import { CutoutEmptyState } from '../panel/CutoutsSection/CutoutEmptyState';
import { useCutoutQuickstart } from '../../hooks/useCutoutQuickstart';
import { useTranslation } from '@/i18n';
import { useCutoutWorkspaceCamera } from './useCutoutWorkspaceCamera';
import { useCutoutWorkspacePointer } from './useCutoutWorkspacePointer';
import { buildCutoutContextActions } from './cutoutWorkspaceContextActions';

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
    }))
  );

  const { cutouts } = params;
  const { innerW: binWidth, innerD: binDepth, wallHeight } = binDimensions(params);
  // See CutoutEditor for rationale — separate X/Y cell sizes keep validator and
  // polygon rendering aligned for non-square bins.
  const maskCellSize = params.cellMask
    ? { cellMmX: binWidth / params.cellMask.cols, cellMmY: binDepth / params.cellMask.rows }
    : undefined;

  const t = useTranslation();
  const { triggerImport: triggerSvgImport } = useSvgImport();
  const scanEnabled = useFeatureFlag('scan_with_phone');
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  // Quickstart overlay state
  const { quickstartSeen, markQuickstartSeen } = useCutoutQuickstart();
  const [overlayForcedVisible, setOverlayForcedVisible] = useState(false);
  const showQuickstart = !quickstartSeen || overlayForcedVisible;

  const handleDismissQuickstart = useCallback(() => {
    markQuickstartSeen();
    setOverlayForcedVisible(false);
  }, [markQuickstartSeen]);

  const handleShowHelp = useCallback(() => {
    setOverlayForcedVisible(true);
  }, []);

  // Camera + container (zoom/pan/wheel + ResizeObserver)
  const {
    canvasContainerRef,
    containerSize,
    canvasWidth,
    canvasHeight,
    zoom,
    cameraCenter,
    setCameraCenter,
    zoomPercent,
    zoomIn,
    zoomOut,
    fitToView,
    handleWheel,
  } = useCutoutWorkspaceCamera(binWidth, binDepth);

  // Ruler sync: scale=1 for WebGL (world units = mm), zoom from camera
  const scale = 1;
  const rulerPanX = -(cameraCenter.x - canvasWidth / (2 * zoom));
  const rulerPanY = cameraCenter.y + canvasHeight / (2 * zoom) - binDepth;

  const [gridSize, setGridSize] = useState(0.5);
  const [fitCue, setFitCue] = useState<FitCue>(null);

  const handleFlattenArray = useCallback(
    (id: string) => applyFlattenArray(id, cutouts, updateCutout, addCutout),
    [cutouts, updateCutout, addCutout]
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
    undoWithToast,
    redoWithToast,
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
    cellMask: params.cellMask,
    maskCellSize,
  });

  // Pointer handlers + marquee + pan + Space-to-pan + cursor world pos
  const {
    marquee,
    spaceHeld,
    cursorWorldPos,
    handleBackgroundPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  } = useCutoutWorkspacePointer({
    mode,
    setMode,
    cutouts,
    selectCutout,
    deselectAll,
    handlePointerMove,
    handlePointerUp,
    handlePathBackgroundDown,
    handleVertexBackgroundDown,
    zoom,
    setCameraCenter,
    fitToView,
  });

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

  // Build context menu actions
  const contextMenuActions = useMemo(
    () =>
      buildCutoutContextActions({
        selection,
        clipboard,
        cutouts,
        binWidth,
        binDepth,
        copySelected,
        duplicateSelected,
        deleteSelected,
        pasteFromClipboard,
        selectAll,
        updateCutout,
        updateCutoutsBatch,
        lockCutouts,
        unlockCutouts,
        groupCutouts,
        setGroupOp,
        reorderCutouts,
        flattenArray: handleFlattenArray,
        t,
      }),
    [
      selection,
      clipboard,
      cutouts,
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
      groupCutouts,
      setGroupOp,
      reorderCutouts,
      handleFlattenArray,
      t,
    ]
  );

  return (
    <div className="relative flex h-full flex-col bg-surface-secondary select-none">
      <WorkspaceHeader
        zoomPercent={zoomPercent}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToView={fitToView}
        onUndo={undoWithToast}
        onRedo={redoWithToast}
        canUndo={canUndo}
        canRedo={canRedo}
        cursorWorldPos={cursorWorldPos}
        cutouts={cutouts}
        selection={selection}
        binWidth={binWidth}
        binDepth={binDepth}
        onUpdate={updateCutout}
        onUpdateBatch={updateCutoutsBatch}
        onRemove={removeCutout}
        onDuplicate={duplicateCutouts}
        onGroup={groupCutouts}
        onUngroup={ungroupCutouts}
        onSetGroupOp={setGroupOp}
        onReorder={reorderCutouts}
        onClearAll={clearCutouts}
        disabled={isInteracting}
        onShowHelp={handleShowHelp}
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
              onImportSvg={triggerSvgImport}
              onScanWithPhone={scanEnabled ? () => setScanDialogOpen(true) : undefined}
            />
          </div>
        </div>

        {scanEnabled && (
          <ScanWithPhoneDialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} />
        )}

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
              {cutouts.length === 0 && mode.type === 'idle' && (
                <CutoutEmptyState
                  variant="workspace"
                  onScanWithPhone={scanEnabled ? () => setScanDialogOpen(true) : undefined}
                />
              )}
              <CutoutCanvas3D
                cutouts={cutouts}
                binWidth={binWidth}
                binDepth={binDepth}
                cellMask={params.cellMask}
                canvasWidth={canvasWidth}
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
                onDoubleClickCutout={(id: string) => {
                  const cutout = cutouts.find((c) => c.id === id);
                  if (cutout?.shape === 'path') {
                    enterVertexEditing(id);
                  } else {
                    selectIndividual(id);
                  }
                }}
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
                externalZoom={zoom}
                externalCameraCenter={cameraCenter}
                rulerMeasurement={rulerMeasurement}
                rulerZoomRef={rulerZoomRef}
              />
            </div>
          </div>
        </div>

        {/* Right: docked properties inspector */}
        <InspectorDock
          cutouts={cutouts}
          selection={selection}
          preview={preview}
          binWidth={binWidth}
          binDepth={binDepth}
          maxCutDepth={wallHeight}
          onUpdate={updateCutout}
          onUpdateBatch={updateCutoutsBatch}
          disabled={isInteracting}
          onFitCue={setFitCue}
          onFlattenArray={handleFlattenArray}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          board={{
            gridSize,
            onGridSizeChange: setGridSize,
            snapEnabled,
            onSnapToggle: setSnapEnabled,
          }}
        />
      </div>

      {/* Quickstart overlay */}
      {showQuickstart && <CutoutQuickstartOverlay onDismiss={handleDismissQuickstart} />}

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
