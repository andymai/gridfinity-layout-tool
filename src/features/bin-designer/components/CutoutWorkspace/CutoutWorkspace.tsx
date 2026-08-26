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

import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useCutoutSelection,
  useDesignerStore,
  remainingCutoutCapacity,
} from '@/features/bin-designer/store';
import { unitTag } from '@/features/bin-designer/utils/cutoutHierarchy';
import { MAX_LID_CUTOUTS, type Cutout } from '@/features/bin-designer/types';
import {
  binDimensions,
  cutoutInterior,
  cutoutTaperBand,
} from '@/features/bin-designer/utils/binDimensions';
import { lidCutoutHostFace, lidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import { useCutoutInteraction } from '../panel/CutoutsSection/useCutoutInteraction';
import {
  getOffBoardCutoutIds,
  centerOffBoardCutouts,
  clampOffBoardCutouts,
} from '../panel/CutoutsSection/offBoardCutouts';
import { computeGrowToFit } from '../panel/CutoutsSection/growBinToFit';
import { cutoutDepthShortfall } from '../panel/CutoutsSection/cutoutDepthShortfall';
import { CutoutCanvas3D } from '../panel/CutoutsSection/renderer';
import { WorkspaceHeader } from './WorkspaceHeader';
import { CutoutShapeToolbar } from '../panel/CutoutsSection/CutoutShapeToolbar';
import { useSvgImport } from '../panel/CutoutsSection/svgImport';
import { useStlImport, StlImportDialog } from '../panel/CutoutsSection/stlImport';
import { ScanWithPhoneDialog } from '../panel/CutoutsSection/scanImport';
import { InspectorDock } from './InspectorDock';
import { ShapeList } from './ShapeList';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { applyFlattenArray, applyFlattenGroupArray } from '../panel/CutoutsSection/cutoutHelpers';
import { CutoutContextMenu } from '../panel/CutoutsSection/CutoutContextMenu';
import { TopRuler, LeftRuler, RulerCorner } from './Rulers';
import { CutoutQuickstartOverlay } from './CutoutQuickstartOverlay';
import { RepeatSuggestion } from './RepeatSuggestion';
import { useRepeatSuggestion, applyRepeatMerge } from '../../hooks/useRepeatSuggestion';
import { loadInspectorCollapsed } from './inspectorDockStorage';
import { detectRepeatPattern, type RepeatDetection } from '@/shared/utils/cutoutRepeatDetect';
import { arrayInstanceCount, canArray } from '@/shared/utils/cutoutArray';
import { clampedDefaultConfig } from '../panel/CutoutsSection/repeatPresets';
import { trackEvent } from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { CutoutEmptyState } from '../panel/CutoutsSection/CutoutEmptyState';
import { useCutoutQuickstart } from '../../hooks/useCutoutQuickstart';
import { useGroupLevel } from '../../hooks/useGroupLevel';
import { useTranslation } from '@/i18n';
import { useCutoutWorkspaceCamera } from './useCutoutWorkspaceCamera';
import { useCutoutWorkspacePointer } from './useCutoutWorkspacePointer';
import { buildCutoutContextActions } from './cutoutWorkspaceContextActions';

export function CutoutWorkspace() {
  const {
    params,
    addCutout,
    startTransaction,
    commitTransaction,
    updateCutout,
    removeCutout,
    clearCutouts,
    duplicateCutouts,
    setGroupOp,
    updateCutoutsBatch,
    removeCutoutsBatch,
    reorderCutouts,
    moveCutoutsAbove,
    setCutoutProperty,
    reparentCutouts,
    moveUnitsIntoGroup,
    setCutoutGroupName,
    undo,
    redo,
    canUndo,
    canRedo,
    lockCutouts,
    unlockCutouts,
    halfGridMode,
    setParams,
    cutoutTarget,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      clearCutouts: s.clearCutouts,
      duplicateCutouts: s.duplicateCutouts,
      setGroupOp: s.setGroupOp,
      updateCutoutsBatch: s.updateCutoutsBatch,
      removeCutoutsBatch: s.removeCutoutsBatch,
      reorderCutouts: s.reorderCutouts,
      moveCutoutsAbove: s.moveCutoutsAbove,
      setCutoutProperty: s.setCutoutProperty,
      reparentCutouts: s.reparentCutouts,
      moveUnitsIntoGroup: s.moveUnitsIntoGroup,
      setCutoutGroupName: s.setCutoutGroupName,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
      lockCutouts: s.lockCutouts,
      unlockCutouts: s.unlockCutouts,
      halfGridMode: s.ui.halfGridMode,
      setParams: s.setParams,
      cutoutTarget: s.ui.cutoutTarget,
    }))
  );

  // Which part is being drawn on. The store actions already follow this (see
  // `cutoutOwner`), so everything below is about the BOARD: which array to draw,
  // how big it is, and what a depth means on it.
  const isLid = cutoutTarget === 'lid';
  const lidWindow = useMemo(() => (isLid ? lidCutoutWindow(params) : null), [isLid, params]);
  const lidHost = useMemo(() => (isLid ? lidCutoutHostFace(params) : null), [isLid, params]);

  // Memoized because `lid.cutouts` is absent rather than empty on a lid with no
  // holes, and a fresh `[]` each render would invalidate every memo below it.
  const cutouts = useMemo(
    () => (isLid ? params.lid.cutouts : params.cutouts) ?? [],
    [isLid, params.lid.cutouts, params.cutouts]
  );
  // Cutouts live on the interior floor, which grows outward with overhang — use
  // the overhang-expanded interior so cutouts can be placed/centered over that
  // extra floor and land where the generator puts them. wallHeight is
  // unaffected (overhang is outward-only).
  const { wallHeight } = binDimensions(params);
  // The worker cuts from the solid FILL surface, which the global top offset
  // lowers below the rim — the depth ceiling and the shortfall warning both
  // measure from there, not the wall top. A lid host bores its plate through.
  const maxCutDepth = lidHost?.thickness ?? Math.max(0, wallHeight - params.cutoutConfig.topOffset);
  const interior = cutoutInterior(params);
  // The lid's board is its mating-cavity window, which is neither the bin's
  // interior nor the lid's outer plate. A null window means a gate refused the
  // lid cutouts entirely; fall back to the interior so the canvas still has a
  // finite extent rather than collapsing to zero mid-render.
  const binWidth = lidWindow?.spanW ?? interior.innerW;
  const binDepth = lidWindow?.spanD ?? interior.innerD;
  // Both are bin-interior concepts. A lid cutout goes clean through a flat plate:
  // there is no tapered wall to clip against, and a polygon lid never reaches the
  // editor because `lidCutoutsAllowed` refuses one.
  const taperBand = isLid ? null : cutoutTaperBand(params);
  const boardMask = isLid ? undefined : params.cellMask;
  // On the lid, put the bin's interior on screen as a dashed underlay. The two
  // frames are deliberately separate (a shared origin would be one more
  // relationship to keep true), so this is what makes "put the slot over the
  // contents" something the user can see rather than compute. Both rectangles are
  // centred on their own part, so no rebasing is needed.
  const binInteriorReference = useMemo(
    () => (isLid ? { width: interior.innerW, depth: interior.innerD } : null),
    [isLid, interior.innerW, interior.innerD]
  );
  // See CutoutEditor for rationale — separate X/Y cell sizes keep validator and
  // polygon rendering aligned for non-square bins. Memoized so the off-board
  // hooks below keep a stable dependency across renders.
  const maskCellSize = useMemo(
    () =>
      boardMask
        ? { cellMmX: binWidth / boardMask.cols, cellMmY: binDepth / boardMask.rows }
        : undefined,
    [boardMask, binWidth, binDepth]
  );

  // What the generator will actually cut on. Resizing the bin can strand cutouts
  // past the new (smaller) footprint (they are stored in absolute mm and never
  // auto-rescaled); on the lid, the window is rounded and a retention magnet's
  // boss is a hole the cut must leave intact. Both are the same question, so
  // both feed one flagged set, one banner and one clamp.
  const cutoutBoard = useMemo(
    () => ({
      width: binWidth,
      depth: binDepth,
      mask: boardMask,
      cellSize: maskCellSize,
      lidWindow: lidWindow ?? undefined,
      meshAssets: params.meshAssets,
    }),
    [binWidth, binDepth, boardMask, maskCellSize, lidWindow, params.meshAssets]
  );

  const offBoardIds = useMemo(
    () => getOffBoardCutoutIds(cutouts, cutoutBoard),
    [cutouts, cutoutBoard]
  );

  // Cutouts the generator will cut shallower than their requested depth (a
  // stored depth outliving a shrunken bin, or a lean sliding the pocket into
  // a wall or the floor). Hidden cutouts are not cut at all, so they cannot
  // fall short. Through-cut lid holes have no depth to miss.
  const depthShortfallCount = useMemo(() => {
    if (isLid) return 0;
    let count = 0;
    for (const c of cutouts) {
      if (c.hidden === true) continue;
      if (cutoutDepthShortfall(c, binWidth, binDepth, maxCutDepth)) count++;
    }
    return count;
  }, [isLid, cutouts, binWidth, binDepth, maxCutDepth]);

  const t = useTranslation();
  const { triggerImport: triggerSvgImport } = useSvgImport();
  const stlImport = useStlImport();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  // Mirrors the dock's own collapsed state (which it persists) so the canvas
  // knows whether the inspector is there to hold the repeat suggestion.
  const [dockCollapsed, setDockCollapsed] = useState(loadInspectorCollapsed);

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
  const mergeCutoutsIntoArray = useDesignerStore((s) => s.mergeCutoutsIntoArray);
  const addToast = useToastStore((s) => s.addToast);
  const { groupContext, handleGroup, handleUngroup } = useGroupLevel({
    cutouts,
    transaction: { start: startTransaction, commit: commitTransaction },
  });

  const makeRepeatRef = useRef<() => void>(() => {});

  const handleFlattenGroupArray = useCallback(
    (id: string) => {
      const member = cutouts.find((c) => c.id === id);
      // Read the config off the same unit the flatten will act on. Matching on
      // `groupId` finds the first loose cutout with a repeat ANYWHERE once the
      // member is a container's loose child, whose groupId is null.
      const tag = member ? unitTag(member, groupContext) : null;
      const config =
        tag === null
          ? undefined
          : cutouts.find((c) => unitTag(c, groupContext) === tag && c.array !== undefined)?.array;
      const capacity = remainingCutoutCapacity(cutoutTarget, params.lid.cutouts);
      const outcome = applyFlattenGroupArray(
        id,
        cutouts,
        updateCutout,
        addCutout,
        capacity,
        { start: startTransaction, commit: commitTransaction },
        groupContext
      );
      if (outcome === 'no-room') {
        addToast(t('toast.flattenNoRoom', { max: MAX_LID_CUTOUTS }), 'error');
        return;
      }
      if (outcome === 'flattened' && config) {
        trackEvent('cutout_repeat_flattened', {
          mode: config.mode,
          instances: arrayInstanceCount(config),
        });
      }
    },
    [
      cutouts,
      groupContext,
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

  const handleFlattenArray = useCallback(
    (id: string) => {
      const master = cutouts.find((c) => c.id === id);
      const capacity = remainingCutoutCapacity(cutoutTarget, params.lid.cutouts);
      const outcome = applyFlattenArray(id, cutouts, updateCutout, addCutout, capacity, {
        start: startTransaction,
        commit: commitTransaction,
      });
      if (outcome === 'no-room') {
        addToast(t('toast.flattenNoRoom', { max: MAX_LID_CUTOUTS }), 'error');
        return;
      }
      // Tracked after the fact: a declined flatten is not a flatten, and the
      // repeat it would have baked is still on the design.
      if (outcome === 'flattened' && master?.array) {
        trackEvent('cutout_repeat_flattened', {
          mode: master.array.mode,
          instances: arrayInstanceCount(master.array),
        });
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

  const handleMergeIntoRepeat = useCallback(
    (detection: RepeatDetection) =>
      applyRepeatMerge(detection, { mergeCutoutsIntoArray, addToast, t }, 'context_menu'),
    [mergeCutoutsIntoArray, addToast, t]
  );

  // Grow-to-fit companion to the clamp: a typed W/H past the board is kept
  // rather than truncated, so the warning offers to move the board to
  // the cutouts as well as the cutouts to the board. `null` = growing can't
  // clear the warning, and the action is hidden rather than half-applied.
  // Not offered on the lid: `computeGrowToFit` measures candidates against
  // `cutoutInterior`, which is ~6.7mm per axis wider than the lid's window, so it
  // would either hide a fix that would have worked or resize the bin and leave the
  // warning standing. `undefined` rather than `null` there, because the two say
  // different things to the banner: `null` is "growing was considered and cannot
  // clear this", which prints "the bin can't grow far enough". Growing is not the
  // mechanism at all on a lid — a shape sitting on a magnet boss is not short of
  // room — so the line would be a false explanation.
  const growTarget = useMemo(
    () => (isLid ? undefined : computeGrowToFit(params, cutouts, halfGridMode)),
    [isLid, params, cutouts, halfGridMode]
  );

  const handleGrowToFit = useCallback(() => {
    if (!growTarget) return;
    // One setParams, so growing both axes is a single undo step.
    setParams({ width: growTarget.width, depth: growTarget.depth });
  }, [growTarget, setParams]);

  // Computed once and shared by the button's visibility and its click, so the
  // two can't disagree and the mask scan in the clamp isn't run twice. Hidden
  // rather than inert: when the clamp can fix nothing (an oversized path or
  // mesh, no valid mask/lid placement) a visible button would click without
  // effect and read as broken.
  const offBoardUpdates = useMemo(
    () =>
      offBoardIds.size > 0
        ? clampOffBoardCutouts(cutouts, cutoutBoard, offBoardIds)
        : new Map<string, Partial<Cutout>>(),
    [offBoardIds, cutouts, cutoutBoard]
  );

  const handleClampOffBoard = useCallback(() => {
    if (offBoardUpdates.size > 0) updateCutoutsBatch(offBoardUpdates);
  }, [offBoardUpdates, updateCutoutsBatch]);

  // Same shape of contract as the clamp above: empty means centering cannot
  // clear the warning, and the action is hidden rather than offered inert.
  const centerUpdates = useMemo(
    () =>
      offBoardIds.size > 0
        ? centerOffBoardCutouts(cutouts, cutoutBoard, offBoardIds)
        : new Map<string, Partial<Cutout>>(),
    [offBoardIds, cutouts, cutoutBoard]
  );

  const handleCenterOffBoard = useCallback(() => {
    if (centerUpdates.size > 0) updateCutoutsBatch(centerUpdates);
  }, [centerUpdates, updateCutoutsBatch]);

  const {
    mode,
    setMode,
    selection,
    selectCutout,
    selectIds,
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
    onGroup: handleGroup,
    onUngroup: handleUngroup,
    // Via a ref because the handler needs `selection`, which this hook returns.
    onMakeRepeat: () => makeRepeatRef.current(),
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
    cellMask: boardMask,
    maskCellSize,
  });

  /**
   * Select a shape-list row, moving the editor into that row's branch first.
   *
   * Without the context move the list and the canvas disagree: the list shows a
   * nested row selected while every arrange operation still treats its
   * outermost ancestor as the unit, so aligning "these two subgroups" would
   * slide the whole assembly instead.
   */
  const handleSelectRow = useCallback(
    (ids: readonly string[], additive: boolean, context: readonly string[]) => {
      useCutoutSelection.getState().setGroupContext(context);
      selectIds(ids, additive);
    },
    [selectIds]
  );

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

  // Ctrl+Shift+D. One cutout means "repeat this"; a detected pattern means
  // "these are already a repeat, make it one". Both readings of the same
  // intent, so the binding does not change meaning with the selection.
  const handleMakeRepeat = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 1) {
      const cutout = selected[0];
      if (!canArray(cutout) || cutout.array) return;
      const config = clampedDefaultConfig(cutout, binWidth, binDepth);
      if (!config) return;
      updateCutout(cutout.id, { array: config });
      trackEvent('cutout_repeat_created', {
        source: 'shortcut',
        mode: config.mode,
        instances: arrayInstanceCount(config),
      });
      return;
    }
    const detection = detectRepeatPattern(selected, binWidth, binDepth);
    if (detection) {
      applyRepeatMerge(detection, { mergeCutoutsIntoArray, addToast, t }, 'shortcut');
    }
  }, [cutouts, selection, binWidth, binDepth, updateCutout, mergeCutoutsIntoArray, addToast, t]);

  useEffect(() => {
    makeRepeatRef.current = handleMakeRepeat;
  }, [handleMakeRepeat]);

  // Only enabled while the dock is closed: the inspector carries the row
  // otherwise, and a hidden instance would still record an impression.
  const repeatSuggestion = useRepeatSuggestion(
    cutouts,
    selection,
    binWidth,
    binDepth,
    'canvas',
    dockCollapsed
  );

  const isInteracting =
    mode.type === 'dragging' ||
    mode.type === 'resizing' ||
    mode.type === 'rotating' ||
    mode.type === 'group-rotating' ||
    mode.type === 'group-scaling';

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
        onGroup: handleGroup,
        groupContext,
        ungroupCutouts: handleUngroup,
        setGroupOp,
        reorderCutouts,
        flattenArray: handleFlattenArray,
        mergeIntoRepeat: handleMergeIntoRepeat,
        t,
      }),
    [
      selection,
      clipboard,
      cutouts,
      handleMergeIntoRepeat,
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
      handleGroup,
      groupContext,
      handleUngroup,
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
        onUpdateBatch={updateCutoutsBatch}
        onRemove={removeCutout}
        onDuplicate={duplicateCutouts}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
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
              // Both land via `addMeshCutout`, which is pinned to the BIN's array
              // (a lid cutout can never be a mesh imprint). Offered on the lid
              // board they would report success and add the shape to a part the
              // canvas is not showing.
              onImportStl={isLid ? undefined : stlImport.triggerImport}
              onScanWithPhone={!isLid ? () => setScanDialogOpen(true) : undefined}
            />
          </div>
        </div>

        <ScanWithPhoneDialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} />

        <StlImportDialog
          pending={stlImport.pending}
          importing={stlImport.importing}
          onRotate={stlImport.setAxisRotation}
          onPlace={stlImport.place}
          onCancel={stlImport.cancel}
        />

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
                  onScanWithPhone={!isLid ? () => setScanDialogOpen(true) : undefined}
                />
              )}
              <CutoutCanvas3D
                cutouts={cutouts}
                binWidth={binWidth}
                binDepth={binDepth}
                cellMask={boardMask}
                taperBand={taperBand}
                referenceOutline={binInteriorReference}
                lidWindow={lidWindow}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                selection={selection}
                offBoardIds={offBoardIds}
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
          shapeList={
            <ShapeList
              cutouts={cutouts}
              groupNames={params.cutoutGroupNames}
              selection={selection}
              onSelect={handleSelectRow}
              onSetProperty={setCutoutProperty}
              onMoveAbove={moveCutoutsAbove}
              onReparent={reparentCutouts}
              onMoveUnits={moveUnitsIntoGroup}
              onRenameGroup={setCutoutGroupName}
            />
          }
          cutouts={cutouts}
          selection={selection}
          preview={preview}
          binWidth={binWidth}
          binDepth={binDepth}
          maxCutDepth={maxCutDepth}
          throughOnly={isLid}
          onUpdate={updateCutout}
          onUpdateBatch={updateCutoutsBatch}
          disabled={isInteracting}
          onFitCue={setFitCue}
          onFlattenArray={handleFlattenArray}
          onFlattenGroupArray={handleFlattenGroupArray}
          offBoardCount={offBoardIds.size}
          onClampOffBoard={offBoardUpdates.size > 0 ? handleClampOffBoard : undefined}
          onCenterOffBoard={centerUpdates.size > 0 ? handleCenterOffBoard : undefined}
          depthShortfallCount={depthShortfallCount}
          growTarget={growTarget}
          onGrowToFit={handleGrowToFit}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onCollapsedChange={setDockCollapsed}
          board={{
            gridSize,
            onGridSizeChange: setGridSize,
            snapEnabled,
            onSnapToggle: setSnapEnabled,
          }}
        />
      </div>

      {/* Only while the dock is closed: the inspector already carries the row,
          and two copies of one offer reads as two offers. */}
      {dockCollapsed && repeatSuggestion && (
        <RepeatSuggestion suggestion={repeatSuggestion} placement="chip" disabled={isInteracting} />
      )}

      {showQuickstart && <CutoutQuickstartOverlay onDismiss={handleDismissQuickstart} />}

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
