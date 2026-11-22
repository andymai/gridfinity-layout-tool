/**
 * A press on a library row that moves becomes a drag: the item's ghost follows
 * the pointer over the board, and a release there drops it (`LibraryGhost3D`).
 *
 * Not an HTML5 drag: Firefox drags a button only from its content, not its
 * padding, and the board gets no pointer events during one, which the ghost
 * needs.
 * Touch keeps tap to place, because a touch drag in the tab scrolls the list.
 */

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useLatestRef } from '@/shared/hooks/useLatestRef';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';

/** How far the pointer moves before a press counts as a drag, in CSS pixels. */
export const DRAG_START_PX = 5;

export interface LibraryRowDrag {
  readonly press: (item: CutoutLibraryItem, event: ReactPointerEvent<HTMLElement>) => void;
  /**
   * True once for the click that a drag released over its own row makes, so
   * that click does not also start a placement.
   */
  readonly takeClick: () => boolean;
}

export function useLibraryRowDrag(
  onStart: (item: CutoutLibraryItem, pointerId: number) => void,
  onEnd: () => void
): LibraryRowDrag {
  const onStartRef = useLatestRef(onStart);
  const onEndRef = useLatestRef(onEnd);
  const stopRef = useRef<(() => void) | null>(null);
  const swallowClick = useRef(false);

  useEffect(() => () => stopRef.current?.(), []);

  const press = useCallback(
    (item: CutoutLibraryItem, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      stopRef.current?.();
      const { pointerId, clientX: startX, clientY: startY } = event;
      // A pen press is captured by the element it lands on, which can be a
      // label inside the row. Captured moves never reach the board.
      for (const el of new Set([event.currentTarget, event.target])) {
        if (el instanceof Element && el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      }
      let dragging = false;

      function move(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        // A release outside the window can go unseen: the next move has no button down.
        if ((e.buttons & 1) === 0) {
          finish(false);
          return;
        }
        if (dragging) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_START_PX) return;
        dragging = true;
        onStartRef.current(item, pointerId);
      }
      function end(e: PointerEvent) {
        if (e.pointerId === pointerId) finish(e.type === 'pointerup');
      }
      function blur() {
        finish(false);
      }
      function finish(released: boolean) {
        stop();
        if (!dragging) return;
        if (released) {
          // The click, when there is one, comes in this same task.
          swallowClick.current = true;
          setTimeout(() => {
            swallowClick.current = false;
          }, 0);
        }
        onEndRef.current();
      }
      function stop() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        window.removeEventListener('blur', blur);
        stopRef.current = null;
      }

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      window.addEventListener('blur', blur);
      stopRef.current = stop;
    },
    [onStartRef, onEndRef]
  );

  const takeClick = useCallback(() => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { press, takeClick };
}
