/**
 * Measures the workspace canvas and derives the largest box inside it that
 * still holds the bin's true top-view proportions.
 *
 * The rulers need pixel lengths, not percentages, so the grid's drawn size has
 * to be a number this side of the render rather than something CSS works out
 * afterwards. Deriving the box here also keeps the rulers and the grid reading
 * from one measurement, so a tick can never land off the wall it labels.
 */

import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

/** Breathing room around the grid inside its pane, in CSS pixels. */
const CANVAS_PADDING_PX = 24;

export interface BentoCanvasBox {
  /** Drawn size of the grid in CSS pixels, at the bin's aspect ratio. */
  readonly width: number;
  readonly height: number;
  /** CSS pixels per mm along each axis, for the rulers. */
  readonly scaleX: number;
  readonly scaleY: number;
}

/**
 * The container ref belongs to the caller, not to the returned box: bundling a
 * ref in with plain measurements makes every read of `box.width` look like a
 * ref access to the render-safety lint rule.
 */
export function useBentoCanvasBox(
  containerRef: RefObject<HTMLDivElement | null>,
  aspectRatio: number,
  interiorW: number,
  interiorD: number
): BentoCanvasBox {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return useMemo(() => {
    const availableW = Math.max(0, size.width - CANVAS_PADDING_PX * 2);
    const availableH = Math.max(0, size.height - CANVAS_PADDING_PX * 2);
    const safeAspect = aspectRatio > 0 ? aspectRatio : 1;

    // Fit by whichever axis binds first, so the grid never overflows its pane.
    const width = Math.min(availableW, availableH * safeAspect);
    const height = safeAspect > 0 ? width / safeAspect : 0;

    return {
      width,
      height,
      scaleX: interiorW > 0 ? width / interiorW : 0,
      scaleY: interiorD > 0 ? height / interiorD : 0,
    };
  }, [size.width, size.height, aspectRatio, interiorW, interiorD]);
}
