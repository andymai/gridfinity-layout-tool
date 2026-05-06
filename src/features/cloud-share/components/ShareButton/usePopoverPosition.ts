import { useCallback, useEffect, useState } from 'react';

/** Minimum distance from viewport edge for popover positioning */
const VIEWPORT_PADDING = 16;

/** Estimated popover height for bottom-edge overflow detection */
const ESTIMATED_HEIGHT = 300;

export interface PopoverPosition {
  top: number;
  right: number;
}

/**
 * Anchors a fixed-position popover below an anchor button, flipping above
 * when the bottom would clip and clamping into the viewport on either side.
 * Recomputes on window resize.
 */
export function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  popoverWidth: number
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const calculate = useCallback((): PopoverPosition | null => {
    if (!anchorRef.current) return null;

    const rect = anchorRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 8;
    let right = viewportWidth - rect.right;

    if (right < VIEWPORT_PADDING) {
      right = VIEWPORT_PADDING;
    }

    const leftEdge = viewportWidth - right - popoverWidth;
    if (leftEdge < VIEWPORT_PADDING) {
      right = viewportWidth - popoverWidth - VIEWPORT_PADDING;
    }

    if (top + ESTIMATED_HEIGHT > viewportHeight - VIEWPORT_PADDING) {
      top = rect.top - ESTIMATED_HEIGHT - 8;
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      }
    }

    return { top, right };
  }, [anchorRef, popoverWidth]);

  // Initial setState here is needed because `calculate` measures the anchor
  // DOM node, which isn't attached during render. The handleResize setState
  // is in an external-event callback, which `set-state-in-effect` allows;
  // the initial-mount call is disabled inline with justification.
  useEffect(() => {
    const initial = calculate();
    if (initial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement after mount; ref isn't available during render
      setPosition(initial);
    }

    const handleResize = () => {
      const next = calculate();
      if (next) setPosition(next);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculate]);

  return position;
}
