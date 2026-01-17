import { useCallback } from 'react';
import { useInteractionStore, useViewStore } from '../../core/store';
import { canPlaceBin } from '../../shared/utils/validation';
import { constrainGroupDelta } from '../../utils/selection';
import { STAGING_ID, getBaseCellSize } from '../../core/constants';
import { isOk } from '../../core/result';
import type { InteractionContext, ModeHandlers, DragStartArgs } from './types';
import type { Coord, Bin } from '../../core/types';

/**
 * Hook for drag mode interactions: moving bins by clicking and dragging.
 *
 * ## Features
 *
 * - **Multi-bin dragging**: When dragging a selected bin, all selected bins move together
 * - **Click offset**: Bins stay at same relative position under cursor
 * - **Group constraints**: Group is constrained to stay within bounds
 * - **Duplicate mode**: Alt+drag creates copies instead of moving
 * - **Drop targets**: Can drop to trash (delete) or staging (stash)
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
export function useDragInteraction(
  context: InteractionContext
): ModeHandlers<DragStartArgs> {
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
    deleteBin,
    execute,
    activePointerIdRef,
    capturedPointerRef,
  } = context;

  /**
   * Start dragging bin(s).
   * @param binId - ID of the bin being dragged
   * @param clientX - Mouse X position (for click offset calculation)
   * @param clientY - Mouse Y position
   * @param pointerId - Pointer ID for capture
   * @param duplicate - If true, duplicate bins instead of moving (Alt+drag)
   */
  const start = useCallback(
    (
      binId: string,
      clientX: number,
      clientY: number,
      pointerId?: number,
      duplicate?: boolean
    ) => {
      const bin = layout.bins.find((b) => b.id === binId);
      if (!bin) return;

      // Convert mouse click position to grid coordinates
      const clickCoord = getGridCoords(clientX, clientY);
      if (!clickCoord) return;

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

      // Calculate pixel offset from bin origin to click position
      // This allows the bin to stay at the same relative position under the cursor
      let clickOffset: { x: number; y: number } | undefined;
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const zoom = useViewStore.getState().zoom;
        const viewportWidth =
          typeof window !== 'undefined' ? window.innerWidth : 1280;
        const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
        const gap = 1;

        // Calculate the pixel position of the bin's visual top-left corner
        // Note: Y is inverted - bin.y is from bottom, but visual top is at drawer.depth - bin.y - bin.depth
        const binVisualLeft = gap + bin.x * (cellSize + gap);
        const binVisualTop =
          gap + (layout.drawer.depth - bin.y - bin.depth) * (cellSize + gap);

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
      let binIds: string[];
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
      });
    },
    [
      layout.bins,
      layout.drawer.depth,
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
   * NOTE: This is throttled via RAF by the parent hook.
   */
  const handleMove = useCallback(
    (coords: Coord, clamped: Coord) => {
      const interaction = useInteractionStore.getState().interaction;
      if (!interaction || interaction.type !== 'drag') return;

      const overGrid = isInBounds(coords);

      const draggedBins = interaction.binIds
        .map((id) => layout.bins.find((b) => b.id === id))
        .filter((b): b is Bin => b !== undefined);

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

      if (overGrid) {
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
            },
            activeLayerId,
            layout,
            bin.id,
            otherBinIds // Pass all dragged bins to exclude from collision check
          );

          if (!result.valid) {
            allValid = false;
            break;
          }
        }
      }

      // Store the constrained delta (not absolute position) for use in drop and overlay
      setInteraction({
        ...interaction,
        currentCoord: { x: deltaX, y: deltaY },
        valid: allValid,
        isOverGrid: overGrid,
      });
    },
    [layout, activeLayerId, isInBounds, setInteraction]
  );

  /**
   * Complete the drag interaction.
   * Handles drop targets (trash, staging) or commits bin movement/duplication.
   */
  const handleUp = useCallback(() => {
    const interaction = useInteractionStore.getState().interaction;
    if (!interaction || interaction.type !== 'drag') return;

    const currentDropTarget = useInteractionStore.getState().dropTarget;

    // Handle drop to trash
    if (currentDropTarget === 'trash') {
      execute(() => {
        for (const binId of interaction.binIds) {
          deleteBin(binId);
        }
      });
      setSelectedBins([]);
      setDropTarget(null);
      setInteraction(null);
      return;
    }

    // Handle drop to staging
    if (currentDropTarget === 'staging') {
      execute(() => {
        for (const binId of interaction.binIds) {
          updateBin(binId, { layerId: STAGING_ID });
        }
      });
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
          const newBinIds: string[] = [];
          execute(() => {
            for (const binId of interaction.binIds) {
              const bin = layout.bins.find((b) => b.id === binId);
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
          // Select the newly created duplicates
          if (newBinIds.length > 0) {
            setSelectedBins(newBinIds);
          }
        } else {
          // Move mode: update bin positions
          execute(() => {
            for (const binId of interaction.binIds) {
              const bin = layout.bins.find((b) => b.id === binId);
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
    deleteBin,
    execute,
    setSelectedBins,
    setDropTarget,
    setInteraction,
  ]);

  return { start, handleMove, handleUp };
}
