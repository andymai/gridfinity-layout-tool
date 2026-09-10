/**
 * Sidebar cutout editor — thin wrapper around CutoutCanvas3D.
 *
 * Wires store state, interaction hook, and UI chrome (toolbar, property panel,
 * alignment toolbar, context menu) around the reusable CutoutCanvas3D WebGL canvas.
 */

import { useCutoutSelection } from '@/features/bin-designer/store';
import { GroupBreadcrumb } from '../../CutoutWorkspace/GroupBreadcrumb';
import { CutoutCanvas3D } from './renderer';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { StlImportDialog } from './stlImport';
import { ScanWithPhoneDialog } from './scanImport';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { CutoutContextMenu } from './CutoutContextMenu';
import { CutoutEmptyState } from './CutoutEmptyState';
import { CutoutFillControls } from '@/features/bin-designer/components/controls';
import { useCutoutEditor } from './useCutoutEditor';
import { CANVAS_WIDTH } from './useCutoutEditor';

export function CutoutEditor() {
  const {
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
  } = useCutoutEditor();

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
