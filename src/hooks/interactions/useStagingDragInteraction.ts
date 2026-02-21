import { useCallback, useRef } from 'react';
import { useInteractionStore } from '@/core/store';
import { useHalfBinModeStore } from '@/core/store';
import { canPlaceBin, clamp } from '@/shared/utils/validation';
import { snapPosition } from '@/shared/utils/snap';
import { capturePointer } from './interaction';
import { findBinById } from '@/utils/entity';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { InteractionContext, ModeHandlers, StagingDragStartArgs } from './types';
import type { Coord, ValidationReason, BlockingInfo, BinId } from '@/core/types';

/**
 * Hook for staging drag mode interactions: dragging bins from the stash onto the grid.
 *
 * ## Features
 *
 * - **Staging to grid**: Drag bins from the staging area (stash) onto the main grid
 * - **Ghost preview**: Shows a preview of where the bin would be placed
 * - **Validation**: Validates placement against bounds and collisions
 * - **Staging to grid**: Drag bins from the staging area (stash) onto the main grid
 *
 * ## Usage
 *
 * The staging drag is typically started by the Staging component directly setting
 * the interaction state, but this hook can also be used via its start method.
 *
 * ## Validation
 *
 * - Throttled via RAF (handled by parent) due to collision detection
 * - Validates placement at current position
 * - Invalid positions shown visually but not committed
 *
 * @param context - Shared interaction context from parent hook
 * @returns ModeHandlers for staging drag interactions
 */
export function useStagingDragInteraction(
  context: InteractionContext
): ModeHandlers<StagingDragStartArgs> {
  const {
    layout,
    activeLayerId,
    setInteraction,
    setSelectedBin,
    updateBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
    ctrlKeyRef,
  } = context;

  // Track previous cursor position for movement direction
  const prevCoordRef = useRef<Coord | null>(null);

  /**
   * Start dragging a bin from staging.
   * Note: The Staging component often starts this interaction directly
   * by calling setInteraction, but this method provides a consistent API.
   * @param binId - ID of the bin to drag from staging
   * @param pointerId - Pointer ID for capture
   */
  const start = useCallback(
    (binId: BinId, pointerId?: number) => {
      const bin = findBinById(layout, binId);
      if (!bin) return;

      // Capture pointer at document level for reliable event delivery
      capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

      // Reset movement direction tracking for fresh drag
      prevCoordRef.current = null;

      setInteraction({
        type: 'stagingDrag',
        binId,
        currentCoord: null,
        valid: false,
      });
    },
    [layout, setInteraction, activePointerIdRef, capturedPointerRef]
  );

  /**
   * Handle pointer movement during staging drag.
   * Calculates target position and validates placement.
   * NOTE: This is throttled via RAF by the parent hook.
   */
  const handleMove = useCallback(
    (_coords: Coord, clamped: Coord) => {
      const interaction = useInteractionStore.getState().interaction;
      if (!interaction || interaction.type !== 'stagingDrag') return;

      // Dragging a bin from staging to main grid
      const bin = findBinById(layout, interaction.binId);
      if (!bin) return;

      // Calculate where the bin would be placed (clamped to grid bounds)
      const targetX = clamp(clamped.x, 0, layout.drawer.width - bin.width);
      const targetY = clamp(clamped.y, 0, layout.drawer.depth - bin.depth);

      // Validate placement using bin's actual height (no auto-adjustment)
      const result = canPlaceBin(
        {
          x: targetX,
          y: targetY,
          width: bin.width,
          depth: bin.depth,
          height: bin.height,
          clearanceHeight: bin.clearanceHeight,
        },
        activeLayerId,
        layout,
        bin.id
      );

      let finalX = targetX;
      let finalY = targetY;
      let finalValid = result.valid;
      let isSnapped = false;
      let invalidReason: ValidationReason | undefined;
      let blockingInfo: BlockingInfo | undefined;

      if (!result.valid) {
        if (!ctrlKeyRef.current) {
          // Smart snap: search nearby for a valid position
          const halfBinMode = useHalfBinModeStore.getState().halfBinMode;
          const step = halfBinMode ? 0.5 : 1;
          const prevCoord = prevCoordRef.current;
          const moveDirX = prevCoord ? Math.sign(targetX - prevCoord.x) : 0;
          const moveDirY = prevCoord ? Math.sign(targetY - prevCoord.y) : 0;

          const snapResult = snapPosition(
            targetX,
            targetY,
            bin.width,
            bin.depth,
            bin.height,
            activeLayerId,
            layout,
            bin.id,
            moveDirX,
            moveDirY,
            step,
            bin.clearanceHeight
          );

          if (snapResult) {
            finalX = snapResult.x;
            finalY = snapResult.y;
            finalValid = true;
            isSnapped = snapResult.isSnapped;
          }
        }

        // Propagate validation failure info when snap didn't find a position
        if (!finalValid) {
          invalidReason = result.reason;
          blockingInfo = result.blockingInfo;
        }
      }

      prevCoordRef.current = { x: targetX, y: targetY };

      setInteraction({
        ...interaction,
        currentCoord: { x: finalX, y: finalY },
        valid: finalValid,
        isSnapped,
        invalidReason,
        blockingInfo,
      });
    },
    [layout, activeLayerId, setInteraction, ctrlKeyRef]
  );

  /**
   * Complete the staging drag interaction.
   * Places the bin on the grid if valid.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction || interaction.type !== 'stagingDrag') return;

    // Place bin on grid if valid position
    if (interaction.valid && interaction.currentCoord) {
      const bin = findBinById(layout, interaction.binId);
      if (bin) {
        const { x, y } = interaction.currentCoord;
        const fromLayerId = bin.layerId; // Should be STAGING_ID

        execute(() => {
          updateBin(interaction.binId, {
            x,
            y,
            layerId: activeLayerId,
            // Keep bin's original height - don't auto-adjust to layer minimum
          });
        });
        setSelectedBin(interaction.binId);
        // Track for ML telemetry (bin moved from staging to grid)
        mlTracking.trackPlacement({ ...bin, x, y, layerId: activeLayerId }, 'staging');
        // Also track layer movement (from staging to active layer)
        mlTracking.trackLayerMove(bin, fromLayerId, activeLayerId, 'drag', 1);
      }
    }
    // If invalid or no position, bin stays in staging (no action needed)

    // Note: setInteraction(null) is called by the parent hook
  }, [layout, activeLayerId, updateBin, execute, setSelectedBin]);

  return { start, handleMove, handleUp };
}
