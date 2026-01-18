/**
 * Hook for interpolating remote cursor positions at 60fps.
 *
 * This hook enables smooth cursor movement while keeping network updates
 * throttled to 20fps (50ms). It uses linear interpolation (lerp) to
 * create fluid motion between presence updates.
 *
 * Features:
 * - Single RAF loop for all cursors (efficient)
 * - Converts normalized (0-1) coords to pixels
 * - Smooth fade-out when cursor leaves grid (null)
 * - Auto-cleanup when users disconnect
 *
 * @example
 * ```tsx
 * const interpolated = useInterpolatedPresence(gridWidth, gridHeight);
 *
 * // Returns Map<connectionId, { x, y, isVisible }>
 * for (const [id, pos] of interpolated) {
 *   console.log(`User ${id}: (${pos.x}, ${pos.y})`);
 * }
 * ```
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { useOthers } from '@/liveblocks.config';

/** Lerp factor - higher = snappier response (0.2 = smooth, 0.5 = responsive) */
const INTERPOLATION_SPEED = 0.25;

/** Duration for fade-out when cursor goes null (ms) */
const FADE_OUT_DURATION = 300;

/** Minimum distance to consider cursor "arrived" at target (pixels) */
const ARRIVAL_THRESHOLD = 0.5;

interface InterpolatedState {
  /** Current interpolated position in pixels */
  current: { x: number; y: number };
  /** Target position (null when cursor left grid) */
  target: { x: number; y: number } | null;
  /** Whether cursor is visible (false during fade-out) */
  isVisible: boolean;
  /** Timestamp when fade-out started (for timing) */
  fadeStartTime: number | null;
  /** Opacity for smooth fade (1 = visible, 0 = hidden) */
  opacity: number;
}

export interface InterpolatedPosition {
  /** X position in pixels */
  x: number;
  /** Y position in pixels */
  y: number;
  /** Whether the cursor should be rendered */
  isVisible: boolean;
  /** Current opacity (0-1) for fade transitions */
  opacity: number;
}

/**
 * Interpolates remote cursor positions for smooth 60fps rendering.
 *
 * @param gridWidth - Total grid width in pixels
 * @param gridHeight - Total grid height in pixels
 * @returns Map of connection ID to interpolated pixel position
 */
export function useInterpolatedPresence(
  gridWidth: number,
  gridHeight: number
): Map<number, InterpolatedPosition> {
  const others = useOthers();

  // Internal state for each cursor's interpolation
  // Using ref to avoid re-renders on every frame
  const stateRef = useRef<Map<number, InterpolatedState>>(new Map());

  // Trigger re-render when positions change meaningfully
  // Using a counter instead of object to provide a stable dependency for useMemo
  const [updateTrigger, forceUpdate] = useState(0);

  // Track if component is mounted (for RAF cleanup)
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    let rafId: number;
    let lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      if (!isMountedRef.current) return;

      // Calculate delta time for frame-rate independent animation
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Adjust lerp factor based on frame time (normalize to 60fps)
      const frameAdjustedSpeed = Math.min(
        INTERPOLATION_SPEED * (deltaTime / 16.67),
        1
      );

      const state = stateRef.current;
      let hasChanges = false;

      // Update targets from Liveblocks presence
      for (const { connectionId, presence } of others) {
        const cursor = presence.cursor;
        const existing = state.get(connectionId);

        if (cursor) {
          // Convert normalized to pixels
          const targetPixels = {
            x: cursor.x * gridWidth,
            y: cursor.y * gridHeight,
          };

          if (existing) {
            // Update target for existing cursor
            existing.target = targetPixels;
            existing.isVisible = true;
            existing.fadeStartTime = null;
            existing.opacity = 1;
          } else {
            // New cursor - start at target position (no initial interpolation)
            state.set(connectionId, {
              current: { ...targetPixels },
              target: targetPixels,
              isVisible: true,
              fadeStartTime: null,
              opacity: 1,
            });
            hasChanges = true;
          }
        } else if (existing && existing.target !== null) {
          // Cursor went null - start fade out
          existing.target = null;
          existing.fadeStartTime = currentTime;
          hasChanges = true;
        }
      }

      // Remove disconnected users
      const activeIds = new Set(others.map((o) => o.connectionId));
      for (const id of state.keys()) {
        if (!activeIds.has(id)) {
          state.delete(id);
          hasChanges = true;
        }
      }

      // Interpolate all cursors
      for (const [id, cursorState] of state.entries()) {
        if (cursorState.target) {
          // Calculate distance to target
          const dx = cursorState.target.x - cursorState.current.x;
          const dy = cursorState.target.y - cursorState.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > ARRIVAL_THRESHOLD) {
            // Lerp toward target
            cursorState.current.x += dx * frameAdjustedSpeed;
            cursorState.current.y += dy * frameAdjustedSpeed;
            hasChanges = true;
          } else {
            // Snap to target when close enough
            cursorState.current.x = cursorState.target.x;
            cursorState.current.y = cursorState.target.y;
          }
        } else if (cursorState.fadeStartTime !== null) {
          // Handle fade out
          const elapsed = currentTime - cursorState.fadeStartTime;
          const progress = Math.min(elapsed / FADE_OUT_DURATION, 1);
          cursorState.opacity = 1 - progress;
          hasChanges = true;

          if (progress >= 1) {
            // Fully faded - remove from state
            state.delete(id);
          }
        }
      }

      // Only trigger re-render if something meaningful changed
      if (hasChanges) {
        forceUpdate((c) => c + 1);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      isMountedRef.current = false;
      cancelAnimationFrame(rafId);
    };
  }, [others, gridWidth, gridHeight]);

  // Convert internal state to public API
  // Memoize to prevent unnecessary downstream re-renders
  return useMemo(() => {
    const result = new Map<number, InterpolatedPosition>();

    for (const [id, state] of stateRef.current.entries()) {
      result.set(id, {
        x: state.current.x,
        y: state.current.y,
        isVisible: state.isVisible,
        opacity: state.opacity,
      });
    }

    return result;
    // Re-run when forceUpdate triggers via updateTrigger counter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTrigger]);
}
