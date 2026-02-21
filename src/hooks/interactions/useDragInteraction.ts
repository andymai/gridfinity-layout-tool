import { useCallback } from 'react';
import { useInteractionStore, useViewStore, useLayoutStore, useToastStore } from '@/core/store';
import { useHalfBinModeStore } from '@/core/store';
import { canPlaceBin } from '@/shared/utils/validation';
import { canSwapBins, findBinAtPosition } from '@/shared/utils/position';
import { snapGroupDelta } from '@/shared/utils/snap';
import { constrainGroupDelta } from './selection';
import { capturePointer } from './interaction';
import { findBinById, findBinsByIds } from '@/utils/entity';
import { STAGING_ID, getBaseCellSize } from '@/core/constants';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';
import type { InteractionContext, ModeHandlers, DragStartArgs } from './types';
import type { BinId, Coord, SwapTarget, ValidationReason, BlockingInfo } from '@/core/types';

/**
 * Hook for drag mode interactions: moving bins by clicking and dragging.
 *
 * ## Features
 *
 * - **Multi-bin dragging**: When dragging a selected bin, all selected bins move together
 * - **Click offset**: Bins stay at same relative position under cursor
 * - **Group constraints**: Group is constrained to stay within bounds
 * - **Duplicate mode**: Alt+drag creates copies instead of moving
 * - **Swap mode**: Shift+drag (desktop) or long-press (mobile) to swap with compatible bin
 * - **Drop targets**: Can drop to staging (stash)
 *
 * ## Validation
 *
 * - Throttled via RAF (handled by parent) due to heavy collision detection
 * - Validates all bins in group against collisions and bounds
 * - Invalid positions shown visually but not committed
 *
 * @param context - Shared interaction context from parent hook
 * @returns ModeHandlers for drag interactions
 */
export function useDragInteraction(context: InteractionContext): ModeHandlers<DragStartArgs> {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const {
    layout,
    activeLayerId,
    selectedBinIds,
    getGridCoords,
    gridRef,
    isInBounds,
    setInteraction,
    setDropTarget,
    setSelectedBin,
    setSelectedBins,
    addBin,
    updateBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
    ctrlKeyRef,
  } = context;

  /**
   * Start dragging bin(s).
   * @param binId - ID of the bin being dragged
   * @param clientX - Mouse X position (for click offset calculation)
   * @param clientY - Mouse Y position
   * @param pointerId - Pointer ID for capture
   * @param duplicate - If true, duplicate bins instead of moving (Alt+drag)
   * @param swapMode - If true, enable swap mode (Shift+drag on desktop)
   */
  const start = useCallback(
    (
      binId: BinId,
      clientX: number,
      clientY: number,
      pointerId?: number,
      duplicate?: boolean,
      swapMode?: boolean
    ) => {
      const bin = findBinById(layout, binId);
      if (!bin) return;

      // Convert mouse click position to grid coordinates
      const clickCoord = getGridCoords(clientX, clientY);
      if (!clickCoord) return;

      // Capture pointer at document level for reliable event delivery
      capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

      // Calculate pixel offset from bin origin to click position
      // This allows the bin to stay at the same relative position under the cursor
      let clickOffset: { x: number; y: number } | undefined;
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const zoom = useViewStore.getState().zoom;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
        const gap = 1;

        // Calculate the pixel position of the bin's visual top-left corner
        // Note: Y is inverted - bin.y is from bottom, but visual top is at drawer.depth - bin.y - bin.depth
        const binVisualLeft = gap + bin.x * (cellSize + gap);
        const binVisualTop = gap + (layout.drawer.depth - bin.y - bin.depth) * (cellSize + gap);

        // Calculate click position relative to grid
        const clickRelX = clientX - rect.left;
        const clickRelY = clientY - rect.top;

        // Store offset from bin's visual corner to click point
        clickOffset = {
          x: clickRelX - binVisualLeft,
          y: clickRelY - binVisualTop,
        };
      }

      // Use click position as startCoord so delta is calculated from where user clicked
      const startCoord = clickCoord;

      // If clicked bin is already in selection, drag all selected bins
      // Otherwise, select only this bin and drag it
      let binIds: BinId[];
      if (selectedBinIds.includes(binId)) {
        binIds = selectedBinIds;
      } else {
        binIds = [binId];
        setSelectedBin(binId);
      }

      setInteraction({
        type: 'drag',
        binIds,
        startCoord,
        currentCoord: { x: 0, y: 0 }, // Delta starts at zero (no movement yet)
        valid: true,
        isOverGrid: true,
        clickOffset,
        duplicate,
        swapMode: swapMode && binIds.length === 1, // Swap only works for single bin
      });
    },
    [
      layout,
      selectedBinIds,
      getGridCoords,
      gridRef,
      setSelectedBin,
      setInteraction,
      activePointerIdRef,
      capturedPointerRef,
    ]
  );

  /**
   * Handle pointer movement during drag.
   * Validates placement and updates interaction state.
   * Also detects swap targets when in swap mode.
   * NOTE: This is throttled via RAF by the parent hook.
   */
  const handleMove = useCallback(
    (coords: Coord, clamped: Coord) => {
      const interaction = useInteractionStore.getState().interaction;
      if (!interaction || interaction.type !== 'drag') return;

      const overGrid = isInBounds(coords);

      const draggedBins = findBinsByIds(layout, interaction.binIds);

      if (draggedBins.length === 0) return;

      const rawDeltaX = clamped.x - interaction.startCoord.x;
      const rawDeltaY = clamped.y - interaction.startCoord.y;

      // Constrain delta to keep entire group in bounds (preserves arrangement)
      const { deltaX, deltaY } = constrainGroupDelta(
        draggedBins,
        rawDeltaX,
        rawDeltaY,
        layout.drawer
      );

      let allValid = overGrid;
      const otherBinIds = new Set(interaction.binIds);
      let swapTarget: SwapTarget | undefined;
      let invalidReason: ValidationReason | undefined;
      let blockingInfo: BlockingInfo | undefined;
      let isSnapped = false;
      let finalDeltaX = deltaX;
      let finalDeltaY = deltaY;

      if (overGrid) {
        // Check for swap target when in swap mode (single bin only)
        if (interaction.swapMode && draggedBins.length === 1) {
          const draggedBin = draggedBins[0];

          // Find bin at current cursor position (excluding dragged bin)
          const targetBin = findBinAtPosition(clamped, activeLayerId, layout, otherBinIds);

          if (targetBin) {
            const swapResult = canSwapBins(draggedBin, targetBin, layout);
            if (swapResult.compatible) {
              // Preserve countdown if we're still hovering the same target
              const existingCountdown =
                interaction.swapTarget?.binId === targetBin.id
                  ? interaction.swapTarget.countdown
                  : undefined;

              swapTarget = {
                binId: targetBin.id,
                requiresRotation: swapResult.requiresRotation,
                countdown: existingCountdown,
              };
              // Swap is valid - mark overall interaction as valid
              allValid = true;
            }
          }
        }

        // If no swap target, check normal placement validity
        if (!swapTarget) {
          for (const bin of draggedBins) {
            const newX = bin.x + deltaX;
            const newY = bin.y + deltaY;

            const result = canPlaceBin(
              {
                x: newX,
                y: newY,
                width: bin.width,
                depth: bin.depth,
                height: bin.height,
                clearanceHeight: bin.clearanceHeight,
              },
              activeLayerId,
              layout,
              bin.id,
              otherBinIds // Pass all dragged bins to exclude from collision check
            );

            if (!result.valid) {
              allValid = false;
              invalidReason = result.reason;
              blockingInfo = result.blockingInfo;
              break;
            }
          }

          // Smart snap: if placement is invalid due to collision and Ctrl not held, try nearby positions
          if (
            !allValid &&
            !ctrlKeyRef.current &&
            (invalidReason === 'collision' || invalidReason === 'blocked_zone')
          ) {
            const halfBinMode = useHalfBinModeStore.getState().halfBinMode;
            const step = halfBinMode ? 0.5 : 1;
            const moveDirX = Math.sign(rawDeltaX);
            const moveDirY = Math.sign(rawDeltaY);

            const snapResult = snapGroupDelta(
              draggedBins,
              deltaX,
              deltaY,
              activeLayerId,
              layout,
              otherBinIds,
              moveDirX,
              moveDirY,
              step
            );

            if (snapResult) {
              finalDeltaX = snapResult.x;
              finalDeltaY = snapResult.y;
              isSnapped = snapResult.isSnapped;
              allValid = true;
              invalidReason = undefined;
              blockingInfo = undefined;
            }
          }
        }
      }

      // Store the constrained delta (not absolute position) for use in drop and overlay
      setInteraction({
        ...interaction,
        currentCoord: { x: finalDeltaX, y: finalDeltaY },
        valid: allValid,
        isOverGrid: overGrid,
        isSnapped,
        swapTarget,
        invalidReason,
        blockingInfo,
      });
    },
    [layout, activeLayerId, isInBounds, setInteraction, ctrlKeyRef]
  );

  /**
   * Complete the drag interaction.
   * Handles drop targets (staging), swaps, or commits bin movement/duplication.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction || interaction.type !== 'drag') return;

    const currentDropTarget = useInteractionStore.getState().dropTarget;

    // Handle swap completion
    if (interaction.swapTarget && interaction.swapMode) {
      const draggedBin = findBinById(layout, interaction.binIds[0]);
      const targetBin = findBinById(layout, interaction.swapTarget.binId);

      if (draggedBin && targetBin) {
        const { requiresRotation } = interaction.swapTarget;

        // Track swap for analytics
        mlTracking.trackMove(draggedBin, { x: draggedBin.x, y: draggedBin.y }, 'swap', 2);

        execute(() => {
          // Move dragged bin to target's position (with rotation if needed)
          updateBin(draggedBin.id, {
            x: targetBin.x,
            y: targetBin.y,
            width: requiresRotation ? draggedBin.depth : draggedBin.width,
            depth: requiresRotation ? draggedBin.width : draggedBin.depth,
          });

          // Move target bin to dragged bin's original position
          updateBin(targetBin.id, {
            x: draggedBin.x,
            y: draggedBin.y,
          });
        });

        // Show toast (operation is undoable via Ctrl+Z)
        const message = requiresRotation ? t('toast.binsSwappedRotated') : t('toast.binsSwapped');
        addToast(message, 'success');
      }

      setSelectedBins([]);
      setInteraction(null);
      return;
    }

    // Handle drop to staging
    if (currentDropTarget === 'staging') {
      // Capture original layer for tracking (use first bin as representative)
      const binsToStage = findBinsByIds(layout, interaction.binIds);

      if (binsToStage.length > 0) {
        const firstBin = binsToStage[0];
        const fromLayerId = firstBin.layerId;

        execute(() => {
          for (const binId of interaction.binIds) {
            updateBin(binId, { layerId: STAGING_ID });
          }
        });

        // Track layer movement to staging
        mlTracking.trackLayerMove(firstBin, fromLayerId, STAGING_ID, 'drag', binsToStage.length);
      }
      setSelectedBins([]);
      setDropTarget(null);
      setInteraction(null);
      return;
    }

    // Normal drag placement on grid
    if (interaction.valid) {
      // currentCoord stores the constrained delta, not absolute position
      const deltaX = interaction.currentCoord.x;
      const deltaY = interaction.currentCoord.y;

      if (deltaX !== 0 || deltaY !== 0) {
        if (interaction.duplicate) {
          // Duplicate mode: create copies at new position, keep originals in place
          const newBinIds: BinId[] = [];
          execute(() => {
            for (const binId of interaction.binIds) {
              const bin = findBinById(layout, binId);
              if (!bin) continue;

              const addResult = addBin({
                layerId: activeLayerId,
                x: bin.x + deltaX,
                y: bin.y + deltaY,
                width: bin.width,
                depth: bin.depth,
                height: bin.height, // Keep original height - don't auto-adjust to layer minimum
                clearanceHeight: bin.clearanceHeight,
                category: bin.category,
                label: bin.label,
                notes: bin.notes,
                customProperties: bin.customProperties,
              });
              if (isOk(addResult)) {
                newBinIds.push(addResult.value);
              }
            }
          });
          // Track ML telemetry for newly created duplicates
          if (newBinIds.length > 0) {
            const currentLayout = useLayoutStore.getState().layout;
            const newBins = findBinsByIds(currentLayout, newBinIds);
            if (newBins.length > 0) {
              mlTracking.trackBulk(newBins, 'duplicate');
              // Record creation for quick-correction detection
              for (const bin of newBins) {
                mlTracking.recordCreation(
                  bin.id,
                  'duplicate',
                  `${bin.width}x${bin.depth}x${bin.height}`
                );
              }
            }
          }
          // Select the newly created duplicates
          if (newBinIds.length > 0) {
            setSelectedBins(newBinIds);
          }
        } else {
          // Move mode: update bin positions
          // Track move BEFORE executing (capture old positions)
          const binsToMove = findBinsByIds(layout, interaction.binIds);
          if (binsToMove.length > 0) {
            const firstBin = binsToMove[0];
            const oldPosition = { x: firstBin.x, y: firstBin.y };
            // Track with new position (after move)
            const movedBin = { ...firstBin, x: firstBin.x + deltaX, y: firstBin.y + deltaY };
            mlTracking.trackMove(movedBin, oldPosition, 'drag', binsToMove.length);
          }

          execute(() => {
            for (const binId of interaction.binIds) {
              const bin = findBinById(layout, binId);
              if (!bin) continue;

              updateBin(binId, {
                x: bin.x + deltaX,
                y: bin.y + deltaY,
                layerId: activeLayerId,
                // Keep original height - don't auto-adjust to layer minimum
              });
            }
          });
        }
      }
    }
    // If not valid, interaction ends without changes (bins stay in original positions)

    // Note: setInteraction(null) is called by the parent hook
  }, [
    layout,
    activeLayerId,
    addBin,
    updateBin,
    execute,
    setSelectedBins,
    setDropTarget,
    setInteraction,
    t,
    addToast,
  ]);

  return { start, handleMove, handleUp };
}
