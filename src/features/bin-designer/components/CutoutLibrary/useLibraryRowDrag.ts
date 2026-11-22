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
  onStart: (item: CutoutLibraryItem) => void,
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
      // A pen press can be captured by the row, which keeps its moves from the board.
      const row = event.currentTarget;
      if (row.hasPointerCapture(pointerId)) row.releasePointerCapture(pointerId);
      let dragging = false;

      function move(e: PointerEvent) {
        if (e.pointerId !== pointerId || dragging) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_START_PX) return;
        dragging = true;
        onStartRef.current(item);
      }
      function end(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        stop();
        if (!dragging) return;
        // The click, when there is one, comes in this same task.
        swallowClick.current = true;
        setTimeout(() => {
          swallowClick.current = false;
        }, 0);
        onEndRef.current();
      }
      function stop() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        stopRef.current = null;
      }

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
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
