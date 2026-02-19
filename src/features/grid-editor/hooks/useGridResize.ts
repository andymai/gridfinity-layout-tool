import { useState, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store';
import { useUndoableAction } from '@/core/store';
import { useSettingsStore } from '@/core/store/settings';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { binId as toBinId } from '@/core/types';
import { isErr } from '@/core/result';

/**
 * Grid Resize Hook
 *
 * Handles grid edge resize logic including:
 * - Mouse drag to resize drawer dimensions
 * - Detection of bins that would be clipped
 * - Confirmation dialog state for clipped bins
 * - First-use pulse animation
 *
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export type ResizeDirection = 'width' | 'depth' | 'both' | null;

export interface PendingResize {
  newWidth: number;
  newDepth: number;
  clippedBinIds: string[];
}

export interface GridResizeState {
  /** Current resize direction being dragged (null when not resizing) */
  resizeDirection: ResizeDirection;
  /** Pending resize awaiting user confirmation (for clipped bins) */
  pendingResize: PendingResize | null;
  /** Whether resize handles should pulse (first-use hint) */
  shouldPulseResizeHandles: boolean;
  /** Start resize operation from pointer event */
  handleResizeStart: (direction: ResizeDirection, e: React.PointerEvent) => void;
  /** Confirm pending resize - moves clipped bins to staging */
  confirmResize: () => void;
  /** Cancel pending resize - reverts to original size */
  cancelResize: () => void;
}

export interface UseGridResizeOptions {
  /** Cell size in pixels (already scaled by zoom) */
  cellSize: number;
  /** Gap between grid cells in pixels */
  gap: number;
}

export function useGridResize(options: UseGridResizeOptions): GridResizeState {
  const { cellSize, gap } = options;

  const { drawer, updateDrawer, updateBin } = useLayoutStore(
    useShallow((state) => ({
      drawer: state.layout.drawer,
      updateDrawer: state.updateDrawer,
      updateBin: state.updateBin,
    }))
  );

  const { execute } = useUndoableAction();

  // Grid edge resize state
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    depth: number;
  } | null>(null);

  // Pending resize confirmation state
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null);

  // Track if grid resize handles should pulse (first load)
  const [shouldPulseResizeHandles, setShouldPulseResizeHandles] = useState(false);

  // Refs for timeout cleanup
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track captured pointer for explicit release on cleanup (matches useInteraction pattern)
  const capturedPointerRef = useRef<{ element: HTMLElement; pointerId: number } | null>(null);

  // Use ref to track current drawer dimensions without causing effect re-runs
  const drawerRef = useRef(drawer);
  useEffect(() => {
    drawerRef.current = drawer;
  }, [drawer]);

  // Pulse grid resize handles on first load
  useEffect(() => {
    const { settings, updateSetting } = useSettingsStore.getState();
    if (!settings.dismissedHints.includes('grid-resize')) {
      updateSetting('dismissedHints', [...settings.dismissedHints, 'grid-resize']);
      // Defer state update to avoid cascading renders
      pulseTimeoutRef.current = setTimeout(() => {
        setShouldPulseResizeHandles(true);
        // Stop pulsing after 3 seconds
        stopPulseTimeoutRef.current = setTimeout(() => setShouldPulseResizeHandles(false), 3000);
      }, 0);
    }

    // Cleanup timeouts on unmount
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (stopPulseTimeoutRef.current) clearTimeout(stopPulseTimeoutRef.current);
    };
  }, []);

  const handleResizeStart = useCallback((direction: ResizeDirection, e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
    capturedPointerRef.current = { element: target, pointerId: e.pointerId };
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: drawerRef.current.width,
      depth: drawerRef.current.depth,
    });
  }, []);

  useEffect(() => {
    if (!resizeDirection || !resizeStart) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      const cellStep = cellSize + gap;

      const updates: Partial<typeof drawer> = {};
      const currentDrawer = drawerRef.current;

      if (resizeDirection === 'width' || resizeDirection === 'both') {
        const widthDelta = Math.round(dx / cellStep);
        const newWidth = clamp(resizeStart.width + widthDelta, 1, CONSTRAINTS.GRID_MAX);
        if (newWidth !== currentDrawer.width) updates.width = newWidth;
      }

      if (resizeDirection === 'depth' || resizeDirection === 'both') {
        // Depth increases downward visually (positive dy = increase depth)
        const depthDelta = Math.round(dy / cellStep);
        const newDepth = clamp(resizeStart.depth + depthDelta, 1, CONSTRAINTS.GRID_MAX);
        if (newDepth !== currentDrawer.depth) updates.depth = newDepth;
      }

      if (Object.keys(updates).length > 0) {
        updateDrawer(updates);
      }
    };

    const releaseCapture = () => {
      if (capturedPointerRef.current) {
        try {
          capturedPointerRef.current.element.releasePointerCapture(
            capturedPointerRef.current.pointerId
          );
        } catch {
          // Element may have been removed from DOM
        }
        capturedPointerRef.current = null;
      }
    };

    const handlePointerUp = () => {
      releaseCapture();
      // Read current state directly from store to ensure we have the latest values
      const currentState = useLayoutStore.getState().layout;
      const currentDrawer = currentState.drawer;
      // Calculate clipped bins directly to avoid stale closure
      const clippedBins = currentState.bins.filter(
        (b) =>
          b.layerId !== STAGING_ID &&
          (b.x + b.width > currentDrawer.width || b.y + b.depth > currentDrawer.depth)
      );
      if (clippedBins.length > 0) {
        // Show confirmation dialog - user can confirm to stage bins or cancel to revert
        setPendingResize({
          newWidth: currentDrawer.width,
          newDepth: currentDrawer.depth,
          clippedBinIds: clippedBins.map((b) => b.id),
        });
        // Revert to original size temporarily (user will confirm or cancel)
        updateDrawer({ width: resizeStart.width, depth: resizeStart.depth });
      } else {
        // No clipped bins - track the completed resize
        // Only track if dimensions actually changed
        if (
          resizeStart.width !== currentDrawer.width ||
          resizeStart.depth !== currentDrawer.depth
        ) {
          mlTracking.trackDrawerResize(
            { width: resizeStart.width, depth: resizeStart.depth, height: currentDrawer.height },
            currentDrawer,
            0
          );
        }
      }
      setResizeDirection(null);
      setResizeStart(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      releaseCapture();
    };
  }, [resizeDirection, resizeStart, cellSize, gap, updateDrawer]);

  // Confirm pending resize - move clipped bins to staging
  const confirmResize = useCallback(() => {
    if (!pendingResize) return;

    // Capture old dimensions for tracking (current state before applying resize)
    const oldDrawer = { ...drawerRef.current };

    execute(() => {
      // Move clipped bins to staging
      for (const id of pendingResize.clippedBinIds) {
        if (isErr(updateBin(toBinId(id), { layerId: STAGING_ID }))) break;
      }
      // Apply the resize
      updateDrawer({ width: pendingResize.newWidth, depth: pendingResize.newDepth });
    });

    // Track drawer resize after execution
    mlTracking.trackDrawerResize(
      oldDrawer,
      { width: pendingResize.newWidth, depth: pendingResize.newDepth, height: oldDrawer.height },
      pendingResize.clippedBinIds.length
    );

    setPendingResize(null);
  }, [pendingResize, execute, updateBin, updateDrawer]);

  // Cancel pending resize
  const cancelResize = useCallback(() => {
    setPendingResize(null);
  }, []);

  return {
    resizeDirection,
    pendingResize,
    shouldPulseResizeHandles,
    handleResizeStart,
    confirmResize,
    cancelResize,
  };
}
