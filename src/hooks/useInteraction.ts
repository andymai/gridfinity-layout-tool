import { useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Bin, Coord, Rect, ResizeHandle } from '../types';
import { useUIStore, useLayoutStore, useUndoableAction } from '../store';
import { useGridCoords } from './useGridCoords';
import { canPlaceBin, clamp } from '../utils/validation';
import { constrainGroupDelta } from '../utils/selection';
import { STAGING_ID, getBaseCellSize } from '../constants';
import { throttleRAF, cancelThrottledRAF } from '../utils/throttle';

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
  const interaction = useUIStore(state => state.interaction);
  const setInteraction = useUIStore(state => state.setInteraction);
  const setDropTarget = useUIStore(state => state.setDropTarget);
  const selectedBinIds = useUIStore(state => state.selectedBinIds);
  const setSelectedBin = useUIStore(state => state.setSelectedBin);
  const setSelectedBins = useUIStore(state => state.setSelectedBins);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const activeCategoryId = useUIStore(state => state.activeCategoryId);
  const paintSize = useUIStore(state => state.paintSize);
  const layout = useLayoutStore(state => state.layout);
  const addBin = useLayoutStore(state => state.addBin);
  const updateBin = useLayoutStore(state => state.updateBin);
  const deleteBin = useLayoutStore(state => state.deleteBin);
  const { execute } = useUndoableAction();

  // Start drawing a new bin (or start paint drag if paint mode active)
  const startDraw = useCallback((coord: Coord, pointerId?: number) => {
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

    // If paint mode is active, start paint area selection (like draw mode)
    if (paintSize) {
      setInteraction({
        type: 'paint',
        paintSize,
        start: coord,
        current: coord,
      });
      return;
    }

    setInteraction({
      type: 'draw',
      start: coord,
      current: coord,
    });
  }, [paintSize, setInteraction]);

  // Start dragging bins (single or multiple)
  // Set duplicate=true for Alt+drag to duplicate bins instead of moving them
  const startDrag = useCallback((binId: string, clientX: number, clientY: number, pointerId?: number, duplicate?: boolean) => {
    const bin = layout.bins.find(b => b.id === binId);
    if (!bin) return;

    // Convert mouse click position to grid coordinates
    const clickCoord = getGridCoords(clientX, clientY);
    if (!clickCoord) return;

    // Set pointer ID immediately on interaction start (not lazily on first move)
    if (pointerId !== undefined) {
      activePointerIdRef.current = pointerId;
      // Capture pointer at document level for reliable event delivery
      try {
        document.body.setPointerCapture(pointerId);
        capturedPointerRef.current = { element: document.body, pointerId };
      } catch {
        // Ignore if capture fails (e.g., pointer already released)
      }
    }

    // Calculate pixel offset from bin origin to click position
    // This allows the bin to stay at the same relative position under the cursor
    let clickOffset: { x: number; y: number } | undefined;
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const zoom = useUIStore.getState().zoom;
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
  }, [layout.bins, layout.drawer.depth, selectedBinIds, setSelectedBin, setInteraction, getGridCoords, gridRef]);

  // Start resizing bins (single or multiple)
  const startResize = useCallback((binId: string, handle: ResizeHandle, pointerId?: number) => {
    const bin = layout.bins.find(b => b.id === binId);
    if (!bin) return;

    // Set pointer ID immediately on interaction start (not lazily on first move)
    if (pointerId !== undefined) {
      activePointerIdRef.current = pointerId;
      // Capture pointer at document level for reliable event delivery
      try {
        document.body.setPointerCapture(pointerId);
        capturedPointerRef.current = { element: document.body, pointerId };
      } catch {
        // Ignore if capture fails (e.g., pointer already released)
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
      const b = layout.bins.find(x => x.id === id);
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
  }, [layout.bins, selectedBinIds, setSelectedBin, setInteraction]);

  // Cancel current interaction
  const cancel = useCallback(() => {
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
          setInteraction(null);
          activePointerIdRef.current = null;
        }
      }
    };

    // Core move processing logic - separated for throttling
    // Draw and paint interactions are NOT throttled for instant visual feedback
    // Drag, resize, and stagingDrag ARE throttled because they involve heavy validation
    const processHeavyMove = throttleRAF((
      coords: Coord,
      clamped: Coord,
      currentInteraction: typeof interaction
    ) => {
      if (!currentInteraction) return;

      if (currentInteraction.type === 'drag') {
        // Check if mouse is over the grid
        const overGrid = isInBounds(coords);

        // Get all bins being dragged
        const draggedBins = currentInteraction.binIds
          .map(id => layout.bins.find(b => b.id === id))
          .filter((b): b is Bin => b !== undefined);

        if (draggedBins.length === 0) return;

        // Calculate raw delta from start position
        const rawDeltaX = clamped.x - currentInteraction.startCoord.x;
        const rawDeltaY = clamped.y - currentInteraction.startCoord.y;

        // Constrain delta to keep ENTIRE GROUP in bounds (preserves arrangement)
        const { deltaX, deltaY } = constrainGroupDelta(
          draggedBins,
          rawDeltaX,
          rawDeltaY,
          layout.drawer
        );

        // Validate all bins at their new positions (with uniform delta applied)
        let allValid = overGrid; // Only valid if over grid
        const otherBinIds = new Set(currentInteraction.binIds);

        if (overGrid) {
          for (const bin of draggedBins) {
            // Apply uniform delta - NO individual clamping
            const newX = bin.x + deltaX;
            const newY = bin.y + deltaY;

            // Check placement excluding all bins being dragged
            const result = canPlaceBin(
              { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
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
          ...currentInteraction,
          currentCoord: { x: deltaX, y: deltaY },
          valid: allValid,
          isOverGrid: overGrid,
        });
      } else if (currentInteraction.type === 'resize') {
        // Resize all selected bins by same delta
        const newRects = new Map<string, Rect>();
        let allValid = true;
        const otherBinIds = new Set(currentInteraction.binIds);

        for (const binId of currentInteraction.binIds) {
          const bin = layout.bins.find(b => b.id === binId);
          const startRect = currentInteraction.startRects.get(binId);
          if (!bin || !startRect) continue;

          // Get current minSize from halfBinMode state
          const halfBinModeNow = useUIStore.getState().halfBinMode;
          const minSizeNow = halfBinModeNow ? 0.5 : 1;
          const newRect = calculateResizeRect(
            startRect,
            currentInteraction.handle,
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
          ...currentInteraction,
          currentRects: newRects,
          valid: allValid,
        });
      } else if (currentInteraction.type === 'stagingDrag') {
        // Dragging a bin from staging to main grid
        const bin = layout.bins.find(b => b.id === currentInteraction.binId);
        if (!bin) return;

        // Calculate where the bin would be placed (centered on cursor)
        const targetX = clamp(clamped.x, 0, layout.drawer.width - bin.width);
        const targetY = clamp(clamped.y, 0, layout.drawer.depth - bin.depth);

        // Validate placement
        const result = canPlaceBin(
          { x: targetX, y: targetY, width: bin.width, depth: bin.depth, height: bin.height },
          activeLayerId,
          layout,
          bin.id
        );

        setInteraction({
          ...currentInteraction,
          currentCoord: { x: targetX, y: targetY },
          valid: result.valid,
        });
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

      // Read drop target directly from store to ensure we have the latest value
      const currentDropTarget = useUIStore.getState().dropTarget;

      if (interaction.type === 'draw') {
        const { start, current } = interaction;
        const x1 = Math.min(start.x, current.x);
        const y1 = Math.min(start.y, current.y);
        const x2 = Math.max(start.x, current.x);
        const y2 = Math.max(start.y, current.y);
        // In half-bin mode, minimum size is 0.5; otherwise it's 1
        // Width/depth = end - start + minSize (inclusive)
        const halfBinModeNow = useUIStore.getState().halfBinMode;
        const minSizeNow = halfBinModeNow ? 0.5 : 1;
        const width = x2 - x1 + minSizeNow;
        const depth = y2 - y1 + minSizeNow;

        const layer = layout.layers.find(l => l.id === activeLayerId);
        if (layer) {
          execute(() => {
            const binId = addBin({
              layerId: activeLayerId,
              x: x1,
              y: y1,
              width,
              depth,
              height: layer.height,
              category: activeCategoryId,
              label: '',
              notes: '',
            });
            if (binId) {
              setSelectedBin(binId);
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
        const halfBinModeNow = useUIStore.getState().halfBinMode;
        const minSizeNow = halfBinModeNow ? 0.5 : 1;
        const areaWidth = x2 - x1 + minSizeNow;
        const areaDepth = y2 - y1 + minSizeNow;

        const layer = layout.layers.find(l => l.id === activeLayerId);
        if (layer && ps) {
          // Calculate how many bins fit in the selected area
          const binsAcross = Math.floor(areaWidth / ps.width);
          const binsDown = Math.floor(areaDepth / ps.depth);

          if (binsAcross > 0 && binsDown > 0) {
            // Get fresh layout state for validation
            const currentLayout = useLayoutStore.getState().layout;
            const placedBinIds: string[] = [];

            execute(() => {
              // Place bins in a grid pattern
              for (let row = 0; row < binsDown; row++) {
                for (let col = 0; col < binsAcross; col++) {
                  const binX = x1 + col * ps.width;
                  const binY = y1 + row * ps.depth;

                  // Validate each placement
                  const result = canPlaceBin(
                    { x: binX, y: binY, width: ps.width, depth: ps.depth, height: layer.height },
                    activeLayerId,
                    currentLayout,
                    undefined,
                    new Set(placedBinIds) // Exclude bins we've already placed
                  );

                  if (result.valid) {
                    const binId = addBin({
                      layerId: activeLayerId,
                      x: binX,
                      y: binY,
                      width: ps.width,
                      depth: ps.depth,
                      height: layer.height,
                      category: activeCategoryId,
                      label: '',
                      notes: '',
                    });
                    if (binId) {
                      placedBinIds.push(binId);
                    }
                  }
                }
              }
            });

            // Select all placed bins
            if (placedBinIds.length > 0) {
              setSelectedBins(placedBinIds);
            }
          }
        }
      } else if (interaction.type === 'drag') {
        // Check for drop targets first
        if (currentDropTarget === 'trash') {
          // Delete all dragged bins
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

        if (currentDropTarget === 'staging') {
          // Move all dragged bins to staging
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

        // Normal drag placement
        if (interaction.valid) {
          // currentCoord now stores the constrained delta, not absolute position
          const deltaX = interaction.currentCoord.x;
          const deltaY = interaction.currentCoord.y;

          if (deltaX !== 0 || deltaY !== 0) {
            const layer = layout.layers.find(l => l.id === activeLayerId);

            if (interaction.duplicate) {
              // Duplicate mode: create copies at new position, keep originals in place
              const newBinIds: string[] = [];
              execute(() => {
                for (const binId of interaction.binIds) {
                  const bin = layout.bins.find(b => b.id === binId);
                  if (!bin) continue;

                  const newBinId = addBin({
                    layerId: activeLayerId,
                    x: bin.x + deltaX,
                    y: bin.y + deltaY,
                    width: bin.width,
                    depth: bin.depth,
                    height: Math.max(bin.height, layer?.height ?? bin.height),
                    clearanceHeight: bin.clearanceHeight,
                    category: bin.category,
                    label: bin.label,
                    notes: bin.notes,
                  });
                  if (newBinId) {
                    newBinIds.push(newBinId);
                  }
                }
              });
              // Select the newly created duplicates
              if (newBinIds.length > 0) {
                setSelectedBins(newBinIds);
              }
            } else {
              // Normal mode: move bins to new position
              execute(() => {
                // Update all dragged bins with uniform delta (preserves arrangement)
                for (const binId of interaction.binIds) {
                  const bin = layout.bins.find(b => b.id === binId);
                  if (!bin) continue;

                  // Apply uniform delta - NO individual clamping
                  updateBin(binId, {
                    x: bin.x + deltaX,
                    y: bin.y + deltaY,
                    layerId: activeLayerId,
                    height: Math.max(bin.height, layer?.height ?? bin.height),
                  });
                }
              });
            }
          }
        }
        // If not valid, interaction ends without changes (bins stay in original positions)
      } else if (interaction.type === 'resize' && interaction.valid) {
        let hasChanges = false;

        // Check if any bin changed
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
      } else if (interaction.type === 'stagingDrag') {
        // Check for trash drop first
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
          const bin = layout.bins.find(b => b.id === interaction.binId);
          if (bin) {
            const layer = layout.layers.find(l => l.id === activeLayerId);
            const { x, y } = interaction.currentCoord;
            execute(() => {
              updateBin(interaction.binId, {
                x,
                y,
                layerId: activeLayerId,
                height: Math.max(bin.height, layer?.height ?? bin.height),
              });
            });
            setSelectedBin(interaction.binId);
          }
        }
        // If invalid or no position, bin stays in staging (no action needed)
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
  }, [interaction, layout, activeLayerId, activeCategoryId, addBin, updateBin, deleteBin, setInteraction, setDropTarget, setSelectedBin, setSelectedBins, getGridCoords, clampCoords, isInBounds, execute]);

  return {
    interaction,
    startDraw,
    startDrag,
    startResize,
    cancel,
  };
}

/**
 * Calculate new rectangle based on resize handle and cursor position.
 * @param minSize - Minimum size for width/depth (0.5 in half-bin mode, 1 normally)
 */
function calculateResizeRect(
  start: Rect,
  handle: ResizeHandle,
  cursor: Coord,
  drawer: { width: number; depth: number },
  minSize: number = 1
): Rect {
  let { x, y, width, depth } = start;

  if (handle.includes('e')) {
    width = Math.max(minSize, cursor.x - x + minSize);
  }
  if (handle.includes('w')) {
    const newX = Math.min(cursor.x, x + width - minSize);
    width = x + width - newX;
    x = newX;
  }
  if (handle.includes('n')) {
    depth = Math.max(minSize, cursor.y - y + minSize);
  }
  if (handle.includes('s')) {
    const newY = Math.min(cursor.y, y + depth - minSize);
    depth = y + depth - newY;
    y = newY;
  }

  // Clamp to drawer bounds
  x = Math.max(0, x);
  y = Math.max(0, y);
  if (x + width > drawer.width) width = drawer.width - x;
  if (y + depth > drawer.depth) depth = drawer.depth - y;
  width = Math.max(minSize, width);
  depth = Math.max(minSize, depth);

  return { x, y, width, depth };
}
