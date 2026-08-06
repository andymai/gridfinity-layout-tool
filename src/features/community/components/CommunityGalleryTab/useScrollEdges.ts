import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface ScrollEdges {
  /** Content is hidden off the leading edge. */
  readonly atStart: boolean;
  /** Content is hidden off the trailing edge. */
  readonly atEnd: boolean;
}

/**
 * Sub-pixel slack. Fractional scroll offsets (zoom, trackpad momentum, RTL)
 * leave `scrollLeft + clientWidth` a hair short of `scrollWidth` at the true
 * end, which would strand a fade over nothing.
 */
const EPSILON = 2;

function measure(element: HTMLElement): ScrollEdges {
  // `Math.abs` so this reads the same under RTL, where scrollLeft is negative.
  const offset = Math.abs(element.scrollLeft);
  return {
    atStart: offset > EPSILON,
    atEnd: offset + element.clientWidth < element.scrollWidth - EPSILON,
  };
}

/**
 * Which edges of a horizontal scroller currently hide content.
 *
 * Drives the fades on the shelf rails. A permanent gradient is the easy
 * version and the wrong one: on a shelf that fits, it implies cards that are
 * not there, and at the true end it hides the last card behind a hint that it
 * is not the last card.
 *
 * `revision` re-measures when the content changes without the box resizing —
 * a rail swapping to a different shelf's cards keeps its dimensions.
 */
export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
  revision?: unknown
): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ atStart: false, atEnd: false });

  const sync = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = measure(element);
    // Bail on an unchanged result: this runs on every scroll event.
    setEdges((previous) =>
      previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next
    );
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    sync();
    element.addEventListener('scroll', sync, { passive: true });

    const observer = new ResizeObserver(sync);
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [ref, sync, revision]);

  return edges;
}
