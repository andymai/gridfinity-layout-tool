import { useCallback } from 'react';
import { useLayoutStore, useInteractionStore, useHalfBinModeStore } from '@/core/store';
import { canPlaceBin } from '@/shared/utils/validation';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { InteractionContext, ModeHandlers, DrawStartArgs } from './types';
import type { Coord, Bin } from '@/core/types';

/**
 * Hook for draw mode interactions: creating new bins by dragging a rectangle.
 *
 * Also handles paint mode, which is similar to draw but fills the selected area
 * with multiple uniform-sized bins.
 *
 * ## Behavior
 *
 * **Draw Mode**:
 * - User drags from start to end position
 * - Rectangle preview shown during drag (no throttling - instant feedback)
 * - On release: create single bin with dimensions (end - start + minSize)
 * - New bin auto-selected
 *
 * **Paint Mode** (when paintSize is set):
 * - User drags to select area
 * - On release: fill area with bins of paintSize dimensions
 * - Validates each bin placement (skips invalid positions)
 * - All created bins selected
 *
 * @param context - Shared interaction context from parent hook
 * @returns ModeHandlers for draw/paint interactions
 */
export function useDrawInteraction(
  context: InteractionContext
): ModeHandlers<DrawStartArgs> {
  const {
    layout,
    activeLayerId,
    activeCategoryId,
    paintSize,
    setInteraction,
    setSelectedBin,
    setSelectedBins,
    addBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
  } = context;

  /**
   * Start a draw or paint interaction.
   * If paintSize is set in UI state, starts paint mode; otherwise draw mode.
   */
  const start = useCallback(
    (coord: Coord, pointerId?: number) => {
      // Capture pointer for reliable event delivery during draw
      if (pointerId !== undefined) {
        activePointerIdRef.current = pointerId;
        try {
          document.body.setPointerCapture(pointerId);
          capturedPointerRef.current = { element: document.body, pointerId };
        } catch {
          // Ignore if capture fails
        }
      }

      // If paint mode is active, start paint area selection
      if (paintSize) {
        setInteraction({
          type: 'paint',
          paintSize,
          start: coord,
          current: coord,
        });
        return;
      }

      // Normal draw mode
      setInteraction({
        type: 'draw',
        start: coord,
        current: coord,
      });
    },
    [paintSize, setInteraction, activePointerIdRef, capturedPointerRef]
  );

  /**
   * Handle pointer movement during draw/paint.
   * Updates the current position for visual feedback.
   * NOT throttled - needs instant response for smooth preview.
   */
  const handleMove = useCallback(
    (_coords: Coord, clamped: Coord) => {
      // Read current interaction state directly from store
      const interaction = useInteractionStore.getState().interaction;
      if (!interaction) return;

      if (interaction.type === 'draw') {
        setInteraction({
          ...interaction,
          current: clamped,
        });
      } else if (interaction.type === 'paint') {
        setInteraction({
          ...interaction,
          current: clamped,
        });
      }
    },
    [setInteraction]
  );

  /**
   * Complete the draw/paint interaction.
   * Creates bin(s) based on the selected area.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction) return;

    if (interaction.type === 'draw') {
      const { start, current } = interaction;
      const x1 = Math.min(start.x, current.x);
      const y1 = Math.min(start.y, current.y);
      const x2 = Math.max(start.x, current.x);
      const y2 = Math.max(start.y, current.y);

      // In half-bin mode, minimum size is 0.5; otherwise it's 1
      const halfBinModeNow = useHalfBinModeStore.getState().halfBinMode;
      const minSizeNow = halfBinModeNow ? 0.5 : 1;
      const width = x2 - x1 + minSizeNow;
      const depth = y2 - y1 + minSizeNow;

      const layer = layout.layers.find((l) => l.id === activeLayerId);
      if (layer) {
        execute(() => {
          const binData = {
            layerId: activeLayerId,
            x: x1,
            y: y1,
            width,
            depth,
            height: layer.height,
            category: activeCategoryId,
            label: '',
            notes: '',
          };
          const result = addBin(binData);
          if (isOk(result)) {
            setSelectedBin(result.value);
            // Track for ML telemetry
            const placedBin: Bin = { ...binData, id: result.value };
            mlTracking.trackPlacement(placedBin, 'draw');
            // Record creation for quick-correction detection
            mlTracking.recordCreation(result.value, 'draw', `${width}x${depth}x${layer.height}`);
          }
        });
      }
    } else if (interaction.type === 'paint') {
      // Paint mode - fill the selected area with bins of paintSize
      const { start, current, paintSize: ps } = interaction;
      const x1 = Math.min(start.x, current.x);
      const y1 = Math.min(start.y, current.y);
      const x2 = Math.max(start.x, current.x);
      const y2 = Math.max(start.y, current.y);

      const halfBinModeNow = useHalfBinModeStore.getState().halfBinMode;
      const minSizeNow = halfBinModeNow ? 0.5 : 1;
      const areaWidth = x2 - x1 + minSizeNow;
      const areaDepth = y2 - y1 + minSizeNow;

      const layer = layout.layers.find((l) => l.id === activeLayerId);
      if (layer && ps) {
        // Calculate how many bins fit in the selected area
        const binsAcross = Math.floor(areaWidth / ps.width);
        const binsDown = Math.floor(areaDepth / ps.depth);

        if (binsAcross > 0 && binsDown > 0) {
          const currentLayout = useLayoutStore.getState().layout;
          const placedBinIds: string[] = [];
          const placedBins: Bin[] = [];

          execute(() => {
            // Place bins in a grid pattern
            for (let row = 0; row < binsDown; row++) {
              for (let col = 0; col < binsAcross; col++) {
                const binX = x1 + col * ps.width;
                const binY = y1 + row * ps.depth;

                // Validate each placement
                const result = canPlaceBin(
                  {
                    x: binX,
                    y: binY,
                    width: ps.width,
                    depth: ps.depth,
                    height: layer.height,
                  },
                  activeLayerId,
                  currentLayout,
                  undefined,
                  new Set(placedBinIds) // Exclude bins we've already placed
                );

                if (result.valid) {
                  const binData = {
                    layerId: activeLayerId,
                    x: binX,
                    y: binY,
                    width: ps.width,
                    depth: ps.depth,
                    height: layer.height,
                    category: activeCategoryId,
                    label: '',
                    notes: '',
                  };
                  const addResult = addBin(binData);
                  if (isOk(addResult)) {
                    placedBinIds.push(addResult.value);
                    placedBins.push({ ...binData, id: addResult.value });
                  }
                }
              }
            }
          });

          // Select all placed bins
          if (placedBinIds.length > 0) {
            setSelectedBins(placedBinIds);
            // Track for ML telemetry (bulk placement)
            mlTracking.trackBulk(placedBins, 'paint');
            // Record creation for all placed bins (for quick-correction detection)
            for (const bin of placedBins) {
              mlTracking.recordCreation(bin.id, 'paint', `${bin.width}x${bin.depth}x${bin.height}`);
            }
          }
        }
      }
    }

    // Note: setInteraction(null) is called by the parent hook
  }, [layout, activeLayerId, activeCategoryId, addBin, execute, setSelectedBin, setSelectedBins]);

  return { start, handleMove, handleUp };
}
