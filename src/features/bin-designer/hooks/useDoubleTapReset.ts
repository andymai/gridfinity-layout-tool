/**
 * Detects a clean single-finger double-tap on a touch surface and fires a callback.
 *
 * Distinguishes a tap from a drag/orbit (movement threshold) and from a pinch
 * or multi-finger gesture (any frame where more than one pointer was active
 * disqualifies the whole gesture from producing a tap). This prevents the
 * 3D preview from snapping back to the isometric preset whenever the user
 * pinch-zooms — both fingers produce near-simultaneous `pointerup` events
 * that a naive timestamp-based handler mistakes for a double-tap.
 */

import { useCallback, useRef } from 'react';
import type { PointerEvent } from 'react';

/** Max pixels between tap start and end to still count as a tap (not a drag). */
const TAP_MAX_DISTANCE_PX = 10;
/** Max duration (ms) of a single tap before it's treated as a long-press. */
const TAP_MAX_DURATION_MS = 500;
/** Default window (ms) between two taps to count as a double-tap. */
const DEFAULT_DOUBLE_TAP_WINDOW_MS = 300;

interface UseDoubleTapResetOptions {
  /** Called when a clean single-finger double-tap is detected. */
  onDoubleTap: () => void;
  /** When true, handlers are a no-op (e.g. disable on desktop / non-touch). */
  disabled?: boolean;
  /** Max ms between two taps to count as a double-tap. */
  windowMs?: number;
}

interface DoubleTapHandlers {
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  /**
   * Must be wired to `onPointerCancel`. Without it, a browser-interrupted touch
   * (system notification, app switch, etc.) leaves stale pointer IDs in the
   * active set and permanently blocks future tap detection.
   */
  onPointerCancel: (e: PointerEvent) => void;
}

/**
 * React hook returning `onPointerDown` / `onPointerUp` handlers to attach to
 * a surface for robust double-tap detection that survives multi-touch gestures.
 */
export function useDoubleTapReset({
  onDoubleTap,
  disabled = false,
  windowMs = DEFAULT_DOUBLE_TAP_WINDOW_MS,
}: UseDoubleTapResetOptions): DoubleTapHandlers {
  const activePointersRef = useRef<Set<number>>(new Set());
  const wasMultiTouchRef = useRef(false);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapTimeRef = useRef(0);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.pointerType !== 'touch') return;
      activePointersRef.current.add(e.pointerId);
      if (activePointersRef.current.size === 1) {
        tapStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      } else {
        // Additional finger landed — this gesture can no longer be a tap.
        wasMultiTouchRef.current = true;
        lastTapTimeRef.current = 0;
      }
    },
    [disabled]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.pointerType !== 'touch') return;
      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size > 0) return;

      const wasMulti = wasMultiTouchRef.current;
      const start = tapStartRef.current;
      wasMultiTouchRef.current = false;
      tapStartRef.current = null;

      if (wasMulti || !start) return;

      const now = Date.now();
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const movedFar = dx * dx + dy * dy > TAP_MAX_DISTANCE_PX * TAP_MAX_DISTANCE_PX;
      const heldTooLong = now - start.time > TAP_MAX_DURATION_MS;
      if (movedFar || heldTooLong) {
        lastTapTimeRef.current = 0;
        return;
      }

      if (lastTapTimeRef.current && now - lastTapTimeRef.current < windowMs) {
        e.preventDefault();
        onDoubleTap();
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    },
    [disabled, windowMs, onDoubleTap]
  );

  const onPointerCancel = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.pointerType !== 'touch') return;
      activePointersRef.current.delete(e.pointerId);
      // If the interrupted finger was the last active one, reset the whole
      // gesture so a subsequent clean single-tap starts from scratch.
      if (activePointersRef.current.size === 0) {
        wasMultiTouchRef.current = false;
        tapStartRef.current = null;
        lastTapTimeRef.current = 0;
      }
    },
    [disabled]
  );

  return { onPointerDown, onPointerUp, onPointerCancel };
}
