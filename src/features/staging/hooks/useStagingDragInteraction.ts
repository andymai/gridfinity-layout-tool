import { useCallback } from 'react';
import { useInteractionStore } from '@/core/store';
import { canPlaceBin, clamp } from '@/shared/utils/validation';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { InteractionContext, ModeHandlers, StagingDragStartArgs } from '@/hooks/interactions/types';
import type { Coord } from '@/core/types';

/**
 * Hook for staging drag mode interactions: dragging bins from the stash onto the grid.
 *
 * ## Features
 *
 * - **Staging to grid**: Drag bins from the staging area (stash) onto the main grid
 * - **Ghost preview**: Shows a preview of where the bin would be placed
 * - **Validation**: Validates placement against bounds and collisions
 * - **Drop to trash**: Can drop bin on trash to delete it
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
    setDropTarget,
    setSelectedBin,
    updateBin,
    deleteBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
  } = context;

  /**
   * Start dragging a bin from staging.
   * Note: The Staging component often starts this interaction directly
   * by calling setInteraction, but this method provides a consistent API.
   * @param binId - ID of the bin to drag from staging
   * @param pointerId - Pointer ID for capture
   */
  const start = useCallback(
    (binId: string, pointerId?: number) => {
      const bin = layout.bins.find((b) => b.id === binId);
      if (!bin) return;

      // Set pointer ID immediately on interaction start
      if (pointerId !== undefined) {
        activePointerIdRef.current = pointerId;
        // Capture pointer at document level for reliable event delivery
        try {
          document.body.setPointerCapture(pointerId);
          capturedPointerRef.current = { element: document.body, pointerId };
        } catch {
          // Ignore if capture fails
        }
      }

      setInteraction({
        type: 'stagingDrag',
        binId,
        currentCoord: null,
        valid: false,
      });
    },
    [layout.bins, setInteraction, activePointerIdRef, capturedPointerRef]
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
      const bin = layout.bins.find((b) => b.id === interaction.binId);
      if (!bin) return;

      // Calculate where the bin would be placed (clamped to grid bounds)
      const targetX = clamp(clamped.x, 0, layout.drawer.width - bin.width);
      const targetY = clamp(clamped.y, 0, layout.drawer.depth - bin.depth);

      // Validate placement using bin's actual height (no auto-adjustment)
      const result = canPlaceBin(
        { x: targetX, y: targetY, width: bin.width, depth: bin.depth, height: bin.height },
        activeLayerId,
        layout,
        bin.id
      );

      setInteraction({
        ...interaction,
        currentCoord: { x: targetX, y: targetY },
        valid: result.valid,
      });
    },
    [layout, activeLayerId, setInteraction]
  );

  /**
   * Complete the staging drag interaction.
   * Places the bin on the grid if valid, or deletes if dropped on trash.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction || interaction.type !== 'stagingDrag') return;

    const currentDropTarget = useInteractionStore.getState().dropTarget;

    // Handle drop to trash
    if (currentDropTarget === 'trash') {
      execute(() => {
        deleteBin(interaction.binId);
      });
      setDropTarget(null);
      setInteraction(null);
      return;
    }

    // Place bin on grid if valid position
    if (interaction.valid && interaction.currentCoord) {
      const bin = layout.bins.find((b) => b.id === interaction.binId);
      if (bin) {
        const { x, y } = interaction.currentCoord;
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
        mlTracking.trackPlacement(
          { ...bin, x, y, layerId: activeLayerId },
          'staging'
        );
      }
    }
    // If invalid or no position, bin stays in staging (no action needed)

    // Note: setInteraction(null) is called by the parent hook
  }, [
    layout,
    activeLayerId,
    updateBin,
    deleteBin,
    execute,
    setDropTarget,
    setSelectedBin,
    setInteraction,
  ]);

  return { start, handleMove, handleUp };
}
