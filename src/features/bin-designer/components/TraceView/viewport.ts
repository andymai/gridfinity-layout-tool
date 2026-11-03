import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import type { Point } from '@/shared/scanTrace';

/** Where the photo sits on screen: its top-left corner and screen pixels per image pixel. */
export interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Screen pixels kept clear round a fitted photo. */
const FIT_MARGIN = 24;
/** Deepest zoom, in screen pixels per image pixel: past this a pixel is a block. */
export const MAX_SCALE = 8;

export function fitView(image: Size, box: Size): View {
  const room = (n: number) => Math.max(1, n - 2 * FIT_MARGIN);
  const scale = Math.min(room(box.width) / image.width, room(box.height) / image.height);
  return {
    scale,
    x: (box.width - image.width * scale) / 2,
    y: (box.height - image.height * scale) / 2,
  };
}

/** `view` zoomed by `factor` about the screen point `at`, which stays put. */
export function zoomAt(view: View, factor: number, at: Point, min: number, max: number): View {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const k = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}

export const toImage = (view: View, p: Point): Point => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale,
});

export interface Viewport {
  readonly view: View;
  /** The box's measured size, once measured. */
  readonly box: Size | null;
  /** Zoom about a screen point, the box's middle when none is given. */
  readonly zoomBy: (factor: number, at?: Point) => void;
  readonly panBy: (dx: number, dy: number) => void;
  readonly fit: () => void;
}

const UNMEASURED: View = { scale: 1, x: 0, y: 0 };

/**
 * The photo's place in `box`: fitted, and refitted as the box resizes, until
 * the user zooms or pans. The wheel zooms about the cursor. Mount it afresh
 * for a new photo, so a zoom on one never carries over to the next.
 */
export function useViewport(image: Size, box: RefObject<HTMLElement | null>): Viewport {
  const [size, setSize] = useState<Size | null>(null);
  // Null while fitted; set once the user zooms or pans.
  const [moved, setMoved] = useState<View | null>(null);
  const { width, height } = image;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);

  const fitted = useMemo(
    () => (size ? fitView({ width, height }, size) : UNMEASURED),
    [size, width, height]
  );
  const view = moved ?? fitted;

  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      const centre = at ?? (size ? { x: size.width / 2, y: size.height / 2 } : { x: 0, y: 0 });
      setMoved((v) => zoomAt(v ?? fitted, factor, centre, fitted.scale / 2, MAX_SCALE));
    },
    [size, fitted]
  );

  const panBy = useCallback(
    (dx: number, dy: number) =>
      setMoved((v) => {
        const from = v ?? fitted;
        return { ...from, x: from.x + dx, y: from.y + dy };
      }),
    [fitted]
  );

  const fit = useCallback(() => setMoved(null), []);

  // Not a React handler: the wheel has to be cancelled, and React's is passive.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [box, zoomBy]);

  return { view, box: size, zoomBy, panBy, fit };
}
