/**
 * Full-workspace Bento editor: the layout planner's mental model applied to
 * a bin's interior. Drag on empty grid to draw a compartment; drag drawn
 * compartments to move them (Alt duplicates), resize them by their handles,
 * drop them on the stash shelf, and pull stashed ones back out. Undrawn
 * cells stay background lattice — they still print as 1×1 pockets, which
 * the footer says out loud.
 *
 * Chrome mirrors the cutout workspace: camera (wheel zoom + fit), rulers,
 * header undo/redo + zoom pill, right-hand compartment dock, context menu.
 * Escape cancels the in-flight gesture first, then clears the selection,
 * then closes the workspace.
 */

import {
  TopRuler,
  LeftRuler,
  RulerCorner,
} from '@/features/bin-designer/components/CutoutWorkspace/Rulers';
import { CutoutContextMenu } from '@/features/bin-designer/components/panel/CutoutsSection/CutoutContextMenu';
import { BentoWorkspaceHeader } from './BentoWorkspaceHeader';
import { BentoCanvas } from './BentoCanvas';
import { BentoGridSetup } from './BentoGridSetup';
import { BentoDock } from './BentoDock';
import { BentoStashShelf } from './BentoStashShelf';
import { BentoQuickstartOverlay } from './BentoQuickstartOverlay';
import { useBentoWorkspace } from './useBentoWorkspace';

export function BentoWorkspace() {
  const {
    t,
    compartments,
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    dividerTiltPreview,
    canUndo,
    canRedo,
    undo,
    redo,
    setBentoWorkspaceOpen,
    setSelectedBentoCompartmentId,
    setCompartmentText,
    removeBentoCompartment,
    removeBentoStashEntry,
    clearBentoCompartments,
    isTouchDevice,
    previewColor,
    quickstartSeen,
    markQuickstartSeen,
    interiorW,
    interiorD,
    cols,
    rows,
    canvasContainerRef,
    zoom,
    cameraCenter,
    canvasWidth,
    canvasHeight,
    zoomPercent,
    zoomIn,
    zoomOut,
    fitToView,
    handleWheel,
    pan,
    stashShelfRef,
    hoveredId,
    setHoveredIdLocal,
    drop,
    labelEditRequest,
    drawnIds,
    selectedId,
    stashWithToast,
    interaction,
    handleCanvasPointerMove,
    handleGridChange,
    duplicateToFreeSpot,
    contextMenu,
    closeContextMenu,
    menuTargetId,
    setMenuTargetId,
    handleContextMenu,
    contextActions,
    rulerPanX,
    rulerPanY,
    instructionText,
    stash,
    hasDrawn,
    isPristineGrid,
    movingId,
  } = useBentoWorkspace();

  return (
    // relative: the quickstart card positions against this root — without it
    // the card escaped to the app shell and floated over the 3D preview.
    <div className="relative flex h-full flex-col bg-surface">
      <BentoWorkspaceHeader
        cols={cols}
        rows={rows}
        drawnCount={drawnIds.size}
        hasDrawnCompartments={hasDrawn}
        onGridChange={handleGridChange}
        onClearAll={clearBentoCompartments}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoomPercent={zoomPercent}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToView={fitToView}
        onClose={() => setBentoWorkspaceOpen(false)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex">
            <RulerCorner onDoubleClick={fitToView} />
            <TopRuler
              extent={interiorW}
              scale={1}
              zoom={zoom}
              panOffset={rulerPanX}
              length={canvasWidth}
            />
          </div>
          <div className="flex min-h-0 flex-1">
            <LeftRuler
              extent={interiorD}
              scale={1}
              zoom={zoom}
              panOffset={rulerPanY}
              length={canvasHeight}
            />
            <div
              ref={canvasContainerRef}
              className={`relative flex-1 overflow-hidden ${
                pan.isPanning
                  ? 'cursor-grabbing'
                  : pan.spaceHeld
                    ? 'cursor-grab'
                    : 'cursor-crosshair'
              }`}
              onWheel={handleWheel}
              onPointerDown={(e) => {
                if (pan.onPointerDown(e)) return;
                interaction.onCanvasPointerDown(e);
              }}
              onPointerMove={handleCanvasPointerMove}
              onPointerLeave={() => setHoveredIdLocal(null)}
              onDoubleClick={interaction.onCanvasDoubleClick}
              onContextMenu={handleContextMenu}
              data-testid="bento-canvas-container"
            >
              <BentoCanvas
                config={compartments}
                interiorW={interiorW}
                interiorD={interiorD}
                camera={{ zoom, cameraCenter, canvasWidth, canvasHeight }}
                drawnIds={drawnIds}
                selectedId={selectedId}
                hoveredId={hoveredId}
                previewColor={previewColor}
                ghost={interaction.ghost}
                movingId={movingId}
                drop={drop}
                showHoverHandles={!isTouchDevice}
                dividerTiltPreview={dividerTiltPreview}
                onResizeHandlePointerDown={interaction.onResizeHandlePointerDown}
              />
              {isPristineGrid ? (
                <BentoGridSetup
                  width={width}
                  depth={depth}
                  wallThickness={wallThickness}
                  compartmentThickness={compartments.thickness}
                  gridUnitMm={gridUnitMm}
                  gridUnitMmY={gridUnitMmY}
                  interiorW={interiorW}
                  interiorD={interiorD}
                  onPick={handleGridChange}
                />
              ) : (
                !hasDrawn &&
                stash.length === 0 &&
                !interaction.gesture && (
                  /* Anchored at the bottom, not centered — a centered pill
                     lies across the grid and visually cuts it in half. */
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                    <p className="rounded-md bg-surface/80 px-3 py-1.5 text-sm text-content-tertiary">
                      {t('binDesigner.bento.emptyStateHint')}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <BentoStashShelf
            stash={stash}
            shelfRef={stashShelfRef}
            dropActive={interaction.gesture?.type === 'move' && interaction.gesture.overStash}
            draggingIndex={
              interaction.gesture?.type === 'stashDrag' && interaction.gesture.armed
                ? interaction.gesture.index
                : null
            }
            onEntryPointerDown={interaction.onStashEntryPointerDown}
            onRemoveEntry={removeBentoStashEntry}
          />

          <footer className="flex flex-shrink-0 items-center gap-3 border-t border-stroke-subtle bg-surface-secondary px-4 py-2">
            <p
              id="bento-workspace-instructions"
              className={`text-xs transition-colors duration-150 ${
                interaction.gesture ? 'font-medium text-accent' : 'text-content-tertiary'
              }`}
              aria-live={interaction.gesture ? 'off' : 'polite'}
            >
              {instructionText}
            </p>
            <p className="ml-auto text-xs tabular-nums text-content-tertiary">
              {t('binDesigner.bento.backgroundNote')}
              {' · '}
              {t('binDesigner.bento.interiorReadout', {
                width: Math.round(interiorW),
                depth: Math.round(interiorD),
              })}
            </p>
          </footer>
        </div>

        <BentoDock
          config={compartments}
          drawnIds={drawnIds}
          interiorW={interiorW}
          interiorD={interiorD}
          selectedId={selectedId}
          onSelect={setSelectedBentoCompartmentId}
          labelFocusToken={
            labelEditRequest !== null && labelEditRequest.id === selectedId
              ? labelEditRequest.token
              : undefined
          }
          onCommitLabel={setCompartmentText}
          onDuplicate={duplicateToFreeSpot}
          onStash={(id) => {
            if (stashWithToast(id)) setSelectedBentoCompartmentId(null);
          }}
          onDelete={removeBentoCompartment}
        />
      </div>

      {!quickstartSeen && <BentoQuickstartOverlay onDismiss={markQuickstartSeen} />}

      {contextMenu && menuTargetId !== null && (
        <CutoutContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => {
            closeContextMenu();
            setMenuTargetId(null);
          }}
        />
      )}
    </div>
  );
}
