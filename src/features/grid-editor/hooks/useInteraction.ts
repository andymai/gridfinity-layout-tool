import { useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import type { RefObject } from 'react';
import type { Coord, ResizeHandle } from '@/core/types';
import { useLayoutStore, useUndoableAction, useSelectionStore, useInteractionStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useGridCoords } from './useGridCoords';
import { useCollabPresence } from '@/hooks/useCollabPresence';
import { throttleRAF, cancelThrottledRAF } from '@/shared/utils';
import { mapInteractionToHint } from '@/utils/interaction';
import { useDrawInteraction } from '@/hooks/interactions/useDrawInteraction';
import { useDragInteraction } from '@/hooks/interactions/useDragInteraction';
import { useResizeInteraction } from '@/hooks/interactions/useResizeInteraction';
import { useStagingDragInteraction } from '@/features/staging/hooks/useStagingDragInteraction';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { InteractionContext, ModeHandlers, DrawStartArgs, DragStartArgs, ResizeStartArgs, StagingDragStartArgs } from '@/hooks/interactions/types';

/**
 * Hook for managing all grid interactions including bin creation, movement, and resizing.
 *
 * This hook provides the core interaction logic for the grid editor, handling five distinct
 * interaction modes:
 *
 * ## Interaction Modes
 *
 * 1. **draw** - Create a new bin by clicking and dragging on an empty grid area.
 *    The drawn rectangle becomes a new bin when the mouse is released.
 *
 * 2. **drag** - Move one or more selected bins by clicking and dragging them.
 *    Supports multi-select dragging when bins are already selected.
 *
 * 3. **resize** - Resize bins using corner/edge handles. Supports resizing multiple
 *    selected bins simultaneously with proportional scaling.
 *
 * 4. **stagingDrag** - Drag a bin from the staging area (stash) onto the grid.
 *    Shows a ghost preview until the bin is placed.
 *
 * 5. **paint** - Fill mode where dragging selects an area to fill with uniform-sized bins.
 *    Activated when paintSize is set in UI state.
 *
 * ## Validation
 *
 * All interactions validate placement against:
 * - Grid bounds (drawer dimensions)
 * - Collision with existing bins
 * - Blocked zones from bins on lower layers
 * - Height constraints (bin must fit within remaining drawer height)
 *
 * @param gridRef - React ref to the grid container element for coordinate conversion
 * @returns Object with interaction handlers:
 *   - `startDraw(coord)` - Begin drawing a new bin
 *   - `startDrag(binId, clientX, clientY)` - Begin dragging bin(s)
 *   - `startResize(binId, handle)` - Begin resizing bin(s)
 *   - `startStagingDrag(binId)` - Begin dragging from staging area
 *   - `handlePointerDown(e)` - Generic pointer down handler
 *   - `handlePointerMove(e)` - Generic pointer move handler
 *   - `handlePointerUp(e)` - Generic pointer up handler
 *
 * @example
 * ```tsx
 * function GridCanvas() {
 *   const gridRef = useRef<HTMLDivElement>(null);
 *   const {
 *     handlePointerDown,
 *     handlePointerMove,
 *     handlePointerUp,
 *   } = useInteraction(gridRef);
 *
 *   return (
 *     <div
 *       ref={gridRef}
 *       onPointerDown={handlePointerDown}
 *       onPointerMove={handlePointerMove}
 *       onPointerUp={handlePointerUp}
 *     >
 *       {/* Grid content *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export function useInteraction(gridRef: RefObject<HTMLDivElement | null>) {
  // Track active pointer for multi-touch detection
  const activePointerIdRef = useRef<number | null>(null);
  // Track captured pointer for reliable event delivery
  const capturedPointerRef = useRef<{ element: HTMLElement; pointerId: number } | null>(null);
  const { getGridCoords, clampCoords, isInBounds } = useGridCoords(gridRef);
  const { updateInteraction } = useCollabPresence();
  // Interaction state
  const interaction = useInteractionStore(state => state.interaction);
  const setInteraction = useInteractionStore(state => state.setInteraction);
  const setDropTarget = useInteractionStore(state => state.setDropTarget);
  const paintSize = useInteractionStore(state => state.paintSize);
  // Selection state
  const selectedBinIds = useSelectionStore(state => state.selectedBinIds);
  const setSelectedBin = useSelectionStore(state => state.setSelectedBin);
  const setSelectedBins = useSelectionStore(state => state.setSelectedBins);
  const activeLayerId = useSelectionStore(state => state.activeLayerId);
  const activeCategoryId = useSelectionStore(state => state.activeCategoryId);
  // Layout state
  const layout = useLayoutStore(state => state.layout);
  const { addBin, updateBin, deleteBin } = useMutations();
  const { execute } = useUndoableAction();

  // Build shared context for mode hooks
  const interactionContext: InteractionContext = useMemo(
    () => ({
      getGridCoords,
      clampCoords,
      isInBounds,
      gridRef,
      layout,
      activeLayerId,
      activeCategoryId,
      paintSize,
      selectedBinIds,
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
    }),
    [
      getGridCoords,
      clampCoords,
      isInBounds,
      gridRef,
      layout,
      activeLayerId,
      activeCategoryId,
      paintSize,
      selectedBinIds,
      setInteraction,
      setDropTarget,
      setSelectedBin,
      setSelectedBins,
      addBin,
      updateBin,
      deleteBin,
      execute,
    ]
  );

  // Mode hooks - use refs to always access current handlers while keeping
  // wrapper functions stable (fixes stale closure bug from empty deps)
  const drawMode = useDrawInteraction(interactionContext);
  const dragMode = useDragInteraction(interactionContext);
  const resizeMode = useResizeInteraction(interactionContext);
  const stagingDragMode = useStagingDragInteraction(interactionContext);

  // Refs to hold current mode handlers - allows stable callbacks while using current handlers
  const drawModeRef = useRef<ModeHandlers<DrawStartArgs>>(drawMode);
  const dragModeRef = useRef<ModeHandlers<DragStartArgs>>(dragMode);
  const resizeModeRef = useRef<ModeHandlers<ResizeStartArgs>>(resizeMode);
  const stagingDragModeRef = useRef<ModeHandlers<StagingDragStartArgs>>(stagingDragMode);

  // Keep refs in sync with current mode handlers (useLayoutEffect runs before any event handlers)
  useLayoutEffect(() => {
    drawModeRef.current = drawMode;
    dragModeRef.current = dragMode;
    resizeModeRef.current = resizeMode;
    stagingDragModeRef.current = stagingDragMode;
  });

  // Start drawing a new bin (or start paint drag if paint mode active)
  // Uses ref to always access current drawMode handlers
  const startDraw = useCallback(
    (coord: Coord, pointerId?: number) => {
      drawModeRef.current.start(coord, pointerId);
    },
    []
  );

  // Start dragging bins (single or multiple)
  // Set duplicate=true for Alt+drag to duplicate bins instead of moving them
  // Uses ref to always access current dragMode handlers
  const startDrag = useCallback(
    (binId: string, clientX: number, clientY: number, pointerId?: number, duplicate?: boolean) => {
      dragModeRef.current.start(binId, clientX, clientY, pointerId, duplicate);
    },
    []
  );

  // Start resizing bins (single or multiple)
  // Uses ref to always access current resizeMode handlers
  const startResize = useCallback(
    (binId: string, handle: ResizeHandle, pointerId?: number) => {
      resizeModeRef.current.start(binId, handle, pointerId);
    },
    []
  );

  // Cancel current interaction
  const cancel = useCallback(() => {
    // Track rejection for draw/paint interactions (ML negative signal)
    const currentInteraction = useInteractionStore.getState().interaction;
    if (currentInteraction?.type === 'draw' || currentInteraction?.type === 'paint') {
      mlTracking.trackRejection(
        'cancelled',
        currentInteraction.type,
        { start: currentInteraction.start, current: currentInteraction.current }
      );
    }
    setInteraction(null);
  }, [setInteraction]);

  // Document-level pointer tracking (unified mouse/touch/pen)
  useEffect(() => {
    if (!interaction) {
      // Reset pointer tracking when no interaction
      activePointerIdRef.current = null;
      return;
    }

    // Cancel draw/paint if a second finger arrives (allow two-finger pan)
    const handlePointerDown = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        // Second finger - cancel current interaction to allow pan
        if (interaction.type === 'draw' || interaction.type === 'paint') {
          // Track rejection (ML negative signal)
          mlTracking.trackRejection(
            'second_touch',
            interaction.type,
            { start: interaction.start, current: interaction.current }
          );
          setInteraction(null);
          activePointerIdRef.current = null;
        }
      }
    };

    // Core move processing logic - separated for throttling
    // Draw and paint interactions are NOT throttled for instant visual feedback
    // Drag, resize, and stagingDrag ARE throttled because they involve heavy validation
    // Uses refs to always access current handlers (avoids stale closures)
    const processHeavyMove = throttleRAF((
      coords: Coord,
      clamped: Coord,
      currentInteraction: typeof interaction
    ) => {
      if (!currentInteraction) return;

      if (currentInteraction.type === 'drag') {
        dragModeRef.current.handleMove(coords, clamped);
      } else if (currentInteraction.type === 'resize') {
        resizeModeRef.current.handleMove(coords, clamped);
      } else if (currentInteraction.type === 'stagingDrag') {
        stagingDragModeRef.current.handleMove(coords, clamped);
      }
    });

    const handlePointerMove = (e: PointerEvent) => {
      // Ignore secondary touches (allow two-finger pan)
      if (!e.isPrimary) return;
      // Track the first pointer that moves during interaction (fallback for draw/paint mode)
      if (activePointerIdRef.current === null) {
        activePointerIdRef.current = e.pointerId;
      }
      // Ignore events from other pointers
      if (e.pointerId !== activePointerIdRef.current) return;
      const coords = getGridCoords(e.clientX, e.clientY);
      if (!coords) return;
      const clamped = clampCoords(coords);

      // Draw and paint are NOT throttled - they need instant visual feedback
      // and don't involve heavy collision detection
      if (interaction.type === 'draw' || interaction.type === 'paint') {
        drawModeRef.current.handleMove(coords, clamped);
      } else {
        // Drag, resize, stagingDrag involve heavy validation - throttle to RAF
        processHeavyMove(coords, clamped, interaction);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      // Clear pointer tracking
      if (e.pointerId === activePointerIdRef.current) {
        activePointerIdRef.current = null;
      }

      // Release pointer capture
      if (capturedPointerRef.current) {
        try {
          capturedPointerRef.current.element.releasePointerCapture(capturedPointerRef.current.pointerId);
        } catch {
          // Ignore if release fails
        }
        capturedPointerRef.current = null;
      }

      // Delegate to mode hooks (using refs for current handlers)
      if (interaction.type === 'draw' || interaction.type === 'paint') {
        drawModeRef.current.handleUp();
      } else if (interaction.type === 'drag') {
        dragModeRef.current.handleUp();
      } else if (interaction.type === 'resize') {
        resizeModeRef.current.handleUp();
      } else if (interaction.type === 'stagingDrag') {
        stagingDragModeRef.current.handleUp();
      }

      setInteraction(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      // Cancel any pending throttled move operations
      cancelThrottledRAF(processHeavyMove);
      // Release pointer capture on cleanup
      if (capturedPointerRef.current) {
        try {
          capturedPointerRef.current.element.releasePointerCapture(capturedPointerRef.current.pointerId);
        } catch {
          // Ignore
        }
        capturedPointerRef.current = null;
      }
    };
  // Mode handlers are accessed via refs (drawModeRef, dragModeRef, etc.) so they're
  // always current. The refs are updated on every render, allowing this effect to
  // have minimal deps while still using current handler implementations.
   
  }, [interaction, setInteraction, getGridCoords, clampCoords]);

  // Broadcast interaction state to remote users for collaborative previews
  useEffect(() => {
    const hint = mapInteractionToHint(interaction);
    updateInteraction(hint);
  }, [interaction, updateInteraction]);

  return {
    interaction,
    startDraw,
    startDrag,
    startResize,
    cancel,
  };
}

