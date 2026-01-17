import { useCallback } from 'react';
import { useInteractionStore, useHalfBinModeStore } from '../../core/store';
import { canPlaceBin } from '../../utils/validation';
import { calculateResizeRect } from '../../utils/interaction';
import type { InteractionContext, ModeHandlers, ResizeStartArgs } from './types';
import type { Coord, Rect } from '../../core/types';

/**
 * Hook for resize mode interactions: resizing bins via corner/edge handles.
 *
 * ## Features
 *
 * - **Multi-bin resizing**: When resizing a selected bin, all selected bins resize together
 * - **Handle-aware**: Resizes from the handle being dragged (corners and edges)
 * - **Proportional**: All bins in group resize by the same delta
 * - **Half-bin aware**: Supports 0.5 unit increments when half-bin mode is enabled
 *
 * ## Validation
 *
 * - Throttled via RAF (handled by parent) due to heavy collision detection
 * - Validates all bins in group against collisions and bounds
 * - Invalid positions shown visually but not committed
 *
 * @param context - Shared interaction context from parent hook
 * @returns ModeHandlers for resize interactions
 */
export function useResizeInteraction(
  context: InteractionContext
): ModeHandlers<ResizeStartArgs> {
  const {
    layout,
    activeLayerId,
    selectedBinIds,
    setInteraction,
    setSelectedBin,
    updateBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
  } = context;

  /**
   * Start resizing bin(s).
   * @param binId - ID of the bin being resized
   * @param handle - Which resize handle is being dragged
   * @param pointerId - Pointer ID for capture
   */
  const start = useCallback(
    (binId: string, handle: ResizeStartArgs[1], pointerId?: number) => {
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

      // If clicked bin is in selection, resize all selected bins
      let binIds: string[];
      if (selectedBinIds.includes(binId)) {
        binIds = selectedBinIds;
      } else {
        binIds = [binId];
        setSelectedBin(binId);
      }

      // Store start rects for all bins being resized
      const startRects = new Map<string, Rect>();
      const currentRects = new Map<string, Rect>();
      for (const id of binIds) {
        const b = layout.bins.find((x) => x.id === id);
        if (b) {
          const rect = { x: b.x, y: b.y, width: b.width, depth: b.depth };
          startRects.set(id, rect);
          currentRects.set(id, { ...rect });
        }
      }

      setInteraction({
        type: 'resize',
        binIds,
        handle,
        startRects,
        currentRects,
        valid: true,
      });
    },
    [
      layout.bins,
      selectedBinIds,
      setSelectedBin,
      setInteraction,
      activePointerIdRef,
      capturedPointerRef,
    ]
  );

  /**
   * Handle pointer movement during resize.
   * Calculates new rects and validates placement.
   * NOTE: This is throttled via RAF by the parent hook.
   */
  const handleMove = useCallback(
    (_coords: Coord, clamped: Coord) => {
      const interaction = useInteractionStore.getState().interaction;
      if (!interaction || interaction.type !== 'resize') return;

      // Resize all selected bins by same delta
      const newRects = new Map<string, Rect>();
      let allValid = true;
      const otherBinIds = new Set(interaction.binIds);

      for (const binId of interaction.binIds) {
        const bin = layout.bins.find((b) => b.id === binId);
        const startRect = interaction.startRects.get(binId);
        if (!bin || !startRect) continue;

        const halfBinModeNow = useHalfBinModeStore.getState().halfBinMode;
        const minSizeNow = halfBinModeNow ? 0.5 : 1;
        const newRect = calculateResizeRect(
          startRect,
          interaction.handle,
          clamped,
          layout.drawer,
          minSizeNow
        );
        newRects.set(binId, newRect);

        const result = canPlaceBin(
          { ...newRect, height: bin.height },
          activeLayerId,
          layout,
          binId,
          otherBinIds
        );

        if (!result.valid) {
          allValid = false;
        }
      }

      setInteraction({
        ...interaction,
        currentRects: newRects,
        valid: allValid,
      });
    },
    [layout, activeLayerId, setInteraction]
  );

  /**
   * Complete the resize interaction.
   * Commits bin dimension changes if there were any valid changes.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction || interaction.type !== 'resize') return;

    // Only commit if the resize was valid
    if (!interaction.valid) return;

    let hasChanges = false;

    for (const binId of interaction.binIds) {
      const startRect = interaction.startRects.get(binId);
      const currentRect = interaction.currentRects.get(binId);
      if (!startRect || !currentRect) continue;

      if (
        startRect.x !== currentRect.x ||
        startRect.y !== currentRect.y ||
        startRect.width !== currentRect.width ||
        startRect.depth !== currentRect.depth
      ) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      execute(() => {
        for (const binId of interaction.binIds) {
          const currentRect = interaction.currentRects.get(binId);
          if (!currentRect) continue;

          updateBin(binId, {
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.width,
            depth: currentRect.depth,
          });
        }
      });
    }

    // Note: setInteraction(null) is called by the parent hook
  }, [execute, updateBin]);

  return { start, handleMove, handleUp };
}
