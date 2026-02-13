import { useCallback } from 'react';
import { useInteractionStore } from '@/core/store';
import { useHalfBinModeStore } from '@/core/store';
import { canPlaceBin, clamp } from '@/shared/utils/validation';
import { capturePointer } from './interaction';
import { findBinById } from '@/utils/entity';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { InteractionContext, ModeHandlers, StagingDragStartArgs } from './types';
import type {
  Bin,
  Coord,
  Layout,
  LayerId,
  ValidationReason,
  BlockingInfo,
  BinId,
} from '@/core/types';

/**
 * When a staging drag position collides with an existing bin, try nudging
 * by ±1 step (or ±0.5 in half-bin mode) in each axis to find the nearest
 * valid position. This prevents flickering at bin boundaries.
 *
 * Returns the nudged valid position, or null if no nearby valid position exists.
 */
function findNearestValidPosition(
  targetX: number,
  targetY: number,
  bin: Bin,
  activeLayerId: LayerId,
  layout: Layout,
  step: number
): { x: number; y: number } | null {
  const maxX = layout.drawer.width - bin.width;
  const maxY = layout.drawer.depth - bin.depth;

  // Try nudges in order of increasing distance: axis-aligned first, then diagonal
  const nudges = [
    { dx: -step, dy: 0 },
    { dx: step, dy: 0 },
    { dx: 0, dy: -step },
    { dx: 0, dy: step },
    { dx: -step, dy: -step },
    { dx: step, dy: -step },
    { dx: -step, dy: step },
    { dx: step, dy: step },
  ];

  for (const { dx, dy } of nudges) {
    const nx = clamp(targetX + dx, 0, maxX);
    const ny = clamp(targetY + dy, 0, maxY);
    // Skip if clamping brought us back to the same position
    if (nx === targetX && ny === targetY) continue;
    const result = canPlaceBin(
      {
        x: nx,
        y: ny,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
      },
      activeLayerId,
      layout,
      bin.id
    );
    if (result.valid) return { x: nx, y: ny };
  }

  return null;
}

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
    (binId: BinId, pointerId?: number) => {
      const bin = findBinById(layout, binId);
      if (!bin) return;

      // Capture pointer at document level for reliable event delivery
      capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

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
      let invalidReason: ValidationReason | undefined;
      let blockingInfo: BlockingInfo | undefined;

      if (!result.valid && (result.reason === 'collision' || result.reason === 'blocked_zone')) {
        // Snap to nearest valid position to prevent flickering at bin boundaries
        const halfBinMode = useHalfBinModeStore.getState().halfBinMode;
        const step = halfBinMode ? 0.5 : 1;
        const snapped = findNearestValidPosition(
          targetX,
          targetY,
          bin,
          activeLayerId,
          layout,
          step
        );
        if (snapped) {
          finalX = snapped.x;
          finalY = snapped.y;
          finalValid = true;
        } else {
          invalidReason = result.reason;
          blockingInfo = result.blockingInfo;
        }
      } else if (!result.valid) {
        invalidReason = result.reason;
        blockingInfo = result.blockingInfo;
      }

      setInteraction({
        ...interaction,
        currentCoord: { x: finalX, y: finalY },
        valid: finalValid,
        invalidReason,
        blockingInfo,
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
