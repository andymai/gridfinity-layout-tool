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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import {
  findFreeRect,
  getCompartmentRect,
  getDrawnCompartmentIds,
} from '@/features/bin-designer/utils/bentoDraw';
import { getCompartmentCount } from '@/features/bin-designer/utils/compartments';
import { usePreviewColor } from '@/features/bin-designer/hooks/usePreviewColor';
import { useBentoQuickstart } from '@/features/bin-designer/hooks/useBentoQuickstart';
import { useCutoutWorkspaceCamera } from '@/features/bin-designer/components/CutoutWorkspace/useCutoutWorkspaceCamera';
import {
  TopRuler,
  LeftRuler,
  RulerCorner,
} from '@/features/bin-designer/components/CutoutWorkspace/Rulers';
import {
  CutoutContextMenu,
  type ContextMenuAction,
} from '@/features/bin-designer/components/panel/CutoutsSection/CutoutContextMenu';
import { useCutoutContextMenu } from '@/features/bin-designer/components/panel/CutoutsSection/useCutoutContextMenu';
import { BentoWorkspaceHeader } from './BentoWorkspaceHeader';
import { BentoCanvas } from './BentoCanvas';
import { BentoDock } from './BentoDock';
import { BentoStashShelf } from './BentoStashShelf';
import { BentoQuickstartOverlay } from './BentoQuickstartOverlay';
import { useBentoInteraction } from './useBentoInteraction';

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && !!target.closest('input, textarea, [contenteditable="true"]');

export function BentoWorkspace() {
  const t = useTranslation();
  const {
    compartments,
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    dividerTiltPreview,
    selectedBentoCompartmentId,
    canUndo,
    canRedo,
    undo,
    redo,
    setBentoWorkspaceOpen,
    setSelectedBentoCompartmentId,
    setHoveredCompartmentId,
    setPreviewCompartments,
    setPreviewSelection,
    setCompartmentText,
    drawBentoCompartment,
    moveBentoCompartment,
    resizeBentoCompartment,
    duplicateBentoCompartment,
    removeBentoCompartment,
    stashBentoCompartment,
    placeBentoStashEntry,
    removeBentoStashEntry,
    setBentoGridPreserving,
    clearBentoCompartments,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      wallThickness: s.params.wallThickness,
      dividerTiltPreview: s.ui.dividerTiltPreview,
      selectedBentoCompartmentId: s.ui.selectedBentoCompartmentId,
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
      undo: s.undo,
      redo: s.redo,
      setBentoWorkspaceOpen: s.setBentoWorkspaceOpen,
      setSelectedBentoCompartmentId: s.setSelectedBentoCompartmentId,
      setHoveredCompartmentId: s.setHoveredCompartmentId,
      setPreviewCompartments: s.setPreviewCompartments,
      setPreviewSelection: s.setPreviewSelection,
      setCompartmentText: s.setCompartmentText,
      drawBentoCompartment: s.drawBentoCompartment,
      moveBentoCompartment: s.moveBentoCompartment,
      resizeBentoCompartment: s.resizeBentoCompartment,
      duplicateBentoCompartment: s.duplicateBentoCompartment,
      removeBentoCompartment: s.removeBentoCompartment,
      stashBentoCompartment: s.stashBentoCompartment,
      placeBentoStashEntry: s.placeBentoStashEntry,
      removeBentoStashEntry: s.removeBentoStashEntry,
      setBentoGridPreserving: s.setBentoGridPreserving,
      clearBentoCompartments: s.clearBentoCompartments,
    }))
  );
  const addToast = useToastStore((s) => s.addToast);
  const previewColor = usePreviewColor();
  const { quickstartSeen, markQuickstartSeen } = useBentoQuickstart();

  const { innerW: interiorW, innerD: interiorD } = getInteriorDims({
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
  });
  const { cols, rows } = compartments;
  const cellW = interiorW / cols;
  const cellH = interiorD / rows;

  // Destructured (not held as one object): the compiler treats an object
  // holding a ref as a ref itself and flags every property read in JSX.
  const {
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
  } = useCutoutWorkspaceCamera(interiorW, interiorD);
  const stashShelfRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredIdLocal] = useState<number | null>(null);
  const [labelFocusToken, setLabelFocusToken] = useState(0);

  const drawnIds = useMemo(() => getDrawnCompartmentIds(compartments), [compartments]);

  // Selection survives in the ui slice, but IDs renumber on every mutation —
  // treat anything no longer drawn as no selection.
  const selectedId =
    selectedBentoCompartmentId !== null && drawnIds.has(selectedBentoCompartmentId)
      ? selectedBentoCompartmentId
      : null;

  const requestLabelEdit = useCallback(
    (id: number) => {
      setSelectedBentoCompartmentId(id);
      setLabelFocusToken((token) => token + 1);
    },
    [setSelectedBentoCompartmentId]
  );

  const stashWithToast = useCallback(
    (id: number): boolean => {
      const ok = stashBentoCompartment(id);
      if (!ok) {
        addToast({ message: t('binDesigner.bento.toastStashFull'), type: 'error', duration: 4000 });
      }
      return ok;
    },
    [stashBentoCompartment, addToast, t]
  );

  const interactionActions = useMemo(
    () => ({
      draw: drawBentoCompartment,
      move: moveBentoCompartment,
      resize: resizeBentoCompartment,
      duplicate: duplicateBentoCompartment,
      stash: stashWithToast,
      placeFromStash: placeBentoStashEntry,
    }),
    [
      drawBentoCompartment,
      moveBentoCompartment,
      resizeBentoCompartment,
      duplicateBentoCompartment,
      stashWithToast,
      placeBentoStashEntry,
    ]
  );

  const interaction = useBentoInteraction({
    config: compartments,
    cellW,
    cellH,
    canvasRef: canvasContainerRef,
    zoom,
    cameraCenter,
    canvasWidth,
    canvasHeight,
    stashShelfRef,
    selectedId,
    onSelect: setSelectedBentoCompartmentId,
    onRequestLabelEdit: requestLabelEdit,
    actions: interactionActions,
    setPreviewCompartments,
    setPreviewSelection,
  });

  // Mirror the hovered drawn compartment to the store so the 3D preview can
  // draw its dimension lines (same contract as the sidebar grid editor).
  useEffect(() => {
    setHoveredCompartmentId(interaction.gesture ? null : hoveredId);
    return () => setHoveredCompartmentId(null);
  }, [hoveredId, interaction.gesture, setHoveredCompartmentId]);

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    const world = interaction.worldAt(e.clientX, e.clientY);
    const col = Math.floor(world.x / cellW);
    const row = Math.floor(world.y / cellH);
    if (col < 0 || row < 0 || col >= cols || row >= rows) {
      setHoveredIdLocal(null);
      return;
    }
    const id = compartments.cells[row * cols + col];
    setHoveredIdLocal(drawnIds.has(id) ? id : null);
  };

  const handleGridChange = useCallback(
    (nextCols: number, nextRows: number) => {
      const result = setBentoGridPreserving(nextCols, nextRows);
      if (result === null) {
        addToast({
          message: t('binDesigner.bento.toastGridTooSmall'),
          type: 'error',
          duration: 4000,
        });
        return;
      }
      if (result.stashedCount > 0) {
        addToast({
          message: t('binDesigner.bento.toastStashed', { count: result.stashedCount }),
          type: 'info',
          duration: 4000,
        });
      }
      if (result.droppedCount > 0) {
        addToast({
          message: t('binDesigner.bento.toastDropped', { count: result.droppedCount }),
          type: 'error',
          duration: 5000,
        });
      }
    },
    [setBentoGridPreserving, addToast, t]
  );

  const duplicateToFreeSpot = useCallback(
    (id: number) => {
      const rect = getCompartmentRect(compartments, id);
      if (!rect) return;
      const target = findFreeRect(compartments, rect.w, rect.h);
      if (!target) {
        addToast({ message: t('binDesigner.bento.toastNoRoom'), type: 'info', duration: 4000 });
        return;
      }
      const newId = duplicateBentoCompartment(id, target);
      if (newId !== null) setSelectedBentoCompartmentId(newId);
    },
    [compartments, duplicateBentoCompartment, setSelectedBentoCompartmentId, addToast, t]
  );

  // Context menu on drawn compartments.
  const { contextMenu, openContextMenu, closeContextMenu } = useCutoutContextMenu();
  const [menuTargetId, setMenuTargetId] = useState<number | null>(null);
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const world = interaction.worldAt(e.clientX, e.clientY);
    const col = Math.floor(world.x / cellW);
    const row = Math.floor(world.y / cellH);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const id = compartments.cells[row * cols + col];
    if (!drawnIds.has(id)) return;
    setSelectedBentoCompartmentId(id);
    setMenuTargetId(id);
    openContextMenu(e.clientX, e.clientY);
  };

  const contextActions = useMemo((): ContextMenuAction[] => {
    if (menuTargetId === null) return [];
    const id = menuTargetId;
    return [
      { label: t('binDesigner.bento.menuEditLabel'), onClick: () => requestLabelEdit(id) },
      { label: t('binDesigner.bento.duplicate'), onClick: () => duplicateToFreeSpot(id) },
      {
        label: t('binDesigner.bento.stashAction'),
        onClick: () => {
          if (stashWithToast(id)) setSelectedBentoCompartmentId(null);
        },
        dividerAfter: true,
      },
      {
        label: t('binDesigner.bento.delete'),
        onClick: () => removeBentoCompartment(id),
        danger: true,
        shortcut: { keys: 'Del' },
      },
    ];
  }, [
    menuTargetId,
    t,
    requestLabelEdit,
    duplicateToFreeSpot,
    stashWithToast,
    setSelectedBentoCompartmentId,
    removeBentoCompartment,
  ]);

  // Keyboard: Escape unwinds (gesture → selection → workspace); Delete
  // removes; arrows nudge the selection a cell at a time.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') {
        if (interaction.cancel()) return;
        if (selectedId !== null) {
          setSelectedBentoCompartmentId(null);
          return;
        }
        if (quickstartSeen) setBentoWorkspaceOpen(false);
        return;
      }
      if (selectedId === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeBentoCompartment(selectedId);
        return;
      }
      const nudge: Partial<Record<string, readonly [number, number]>> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        // Row 0 is the front (bottom of the screen): ArrowUp moves back.
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      const delta = nudge[e.key];
      if (delta) {
        e.preventDefault();
        const newId = moveBentoCompartment(selectedId, delta[0], delta[1]);
        if (newId !== null) setSelectedBentoCompartmentId(newId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    interaction,
    selectedId,
    quickstartSeen,
    setBentoWorkspaceOpen,
    setSelectedBentoCompartmentId,
    removeBentoCompartment,
    moveBentoCompartment,
  ]);

  // Ruler adapter (same formula as the cutout workspace): world units are mm,
  // so scale stays 1 and zoom carries px/mm.
  const rulerPanX = -(cameraCenter.x - canvasWidth / (2 * zoom));
  const rulerPanY = cameraCenter.y + canvasHeight / (2 * zoom) - interiorD;

  const instructionText = useMemo(() => {
    const g = interaction.gesture;
    if (g?.type === 'draw') {
      const ghost = interaction.ghost;
      if (ghost && !ghost.valid) return t('binDesigner.bento.hintBlocked');
      return t('binDesigner.bento.hintRelease', {
        w: ghost?.rect.w ?? 1,
        h: ghost?.rect.h ?? 1,
      });
    }
    if (g?.type === 'move') {
      return g.overStash ? t('binDesigner.bento.hintDropStash') : t('binDesigner.bento.hintMove');
    }
    if (g?.type === 'resize') return t('binDesigner.bento.hintResize');
    if (g?.type === 'stashDrag') return t('binDesigner.bento.hintPlace');
    if (selectedId !== null) return t('binDesigner.bento.hintSelected');
    return t('binDesigner.bento.hintIdle');
  }, [interaction.gesture, interaction.ghost, selectedId, t]);

  const stash = compartments.stash ?? [];
  const hasDrawn = drawnIds.size > 0;
  const movingId =
    interaction.gesture?.type === 'move' &&
    interaction.gesture.moved &&
    !interaction.gesture.duplicate
      ? interaction.gesture.id
      : null;

  return (
    <div className="flex h-full flex-col bg-surface">
      <BentoWorkspaceHeader
        cols={cols}
        rows={rows}
        compartmentCount={getCompartmentCount(compartments)}
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
              className="relative flex-1 cursor-crosshair overflow-hidden"
              onWheel={handleWheel}
              onPointerDown={interaction.onCanvasPointerDown}
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
                dividerTiltPreview={dividerTiltPreview}
                onResizeHandlePointerDown={interaction.onResizeHandlePointerDown}
              />
              {!hasDrawn && stash.length === 0 && !interaction.gesture && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rounded-md bg-surface/70 px-3 py-1.5 text-sm text-content-tertiary">
                    {t('binDesigner.bento.emptyStateHint')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <BentoStashShelf
            stash={stash}
            shelfRef={stashShelfRef}
            dropActive={interaction.gesture?.type === 'move' && interaction.gesture.overStash}
            draggingIndex={
              interaction.gesture?.type === 'stashDrag' ? interaction.gesture.index : null
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
          labelFocusToken={labelFocusToken}
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
