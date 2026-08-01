/**
 * Zoom and pan for the pen editor canvas.
 *
 * The canvas works in a padded drawer-local frame: `[0, widthMm + 2·pad] ×
 * [0, depthMm + 2·pad]`, with the drawer itself inset by `pad` so edge handles
 * stay grabbable. Zoom and pan are expressed as the SVG viewBox over that
 * frame, which keeps every coordinate in millimetres — no second unit system,
 * and the vertex data never has to know the view exists.
 */

import { useCallback, useMemo, useState } from 'react';

/** Padding around the drawer inside the frame, in mm. */
export const VIEW_PAD_MM = 14;

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
/** Wheel notch to zoom factor. Matches the feel of the layout canvas. */
const WHEEL_STEP = 1.15;

export interface PenView {
  readonly zoom: number;
  /** `viewBox` attribute over the padded frame. */
  readonly viewBox: string;
  /** True once the view has moved off its default framing. */
  readonly moved: boolean;
  /** Frame-local mm for a client point, honouring the current view. */
  toFrame: (clientX: number, clientY: number, rect: DOMRect) => { x: number; y: number };
  zoomAt: (deltaY: number, clientX: number, clientY: number, rect: DOMRect) => void;
  panBy: (dxFrame: number, dyFrame: number) => void;
  reset: () => void;
}

export function usePenView(widthMm: number, depthMm: number, session: unknown): PenView {
  const frameW = widthMm + VIEW_PAD_MM * 2;
  const frameH = depthMm + VIEW_PAD_MM * 2;
  // One object rather than separate zoom/origin state: a wheel zoom changes
  // both together, and splitting them would let a render observe half a step.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  // A new session, or a resized drawer, must start in the default framing: the
  // dialog stays mounted, so the previous session's zoom and pan would
  // otherwise be inherited by a shape they were never framed for.
  const [viewSession, setViewSession] = useState<unknown>(session);
  if (viewSession !== session) {
    setViewSession(session);
    setView({ zoom: 1, x: 0, y: 0 });
  }
  const { zoom } = view;

  /** Keep the visible window inside the frame, so the drawer can't be lost. */
  const clamp = useCallback(
    (x: number, y: number, z: number) => ({
      x: Math.min(Math.max(x, 0), frameW - frameW / z),
      y: Math.min(Math.max(y, 0), frameH - frameH / z),
    }),
    [frameW, frameH]
  );

  const toFrame = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => ({
      x: view.x + ((clientX - rect.left) / rect.width) * (frameW / view.zoom),
      y: view.y + ((clientY - rect.top) / rect.height) * (frameH / view.zoom),
    }),
    [view, frameW, frameH]
  );

  const zoomAt = useCallback(
    (deltaY: number, clientX: number, clientY: number, rect: DOMRect) => {
      // A horizontal trackpad swipe reports deltaY 0, which would otherwise
      // take the zoom-out branch and drift the view sideways-into-out.
      if (deltaY === 0) return;
      setView((v) => {
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, v.zoom * (deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP))
        );
        if (next === v.zoom) return v;
        // Anchor the point under the cursor: its frame coordinate must be the
        // same before and after, which is what makes wheel zoom feel attached
        // to the drawing rather than to the viewport.
        const fx = (clientX - rect.left) / rect.width;
        const fy = (clientY - rect.top) / rect.height;
        const px = v.x + fx * (frameW / v.zoom);
        const py = v.y + fy * (frameH / v.zoom);
        const c = clamp(px - fx * (frameW / next), py - fy * (frameH / next), next);
        return { zoom: next, x: c.x, y: c.y };
      });
    },
    [frameW, frameH, clamp]
  );

  const panBy = useCallback(
    (dxFrame: number, dyFrame: number) => {
      setView((v) => {
        const c = clamp(v.x - dxFrame, v.y - dyFrame, v.zoom);
        return { zoom: v.zoom, x: c.x, y: c.y };
      });
    },
    [clamp]
  );

  const reset = useCallback(() => setView({ zoom: 1, x: 0, y: 0 }), []);

  const viewBox = useMemo(
    () => `${view.x} ${view.y} ${frameW / view.zoom} ${frameH / view.zoom}`,
    [view, frameW, frameH]
  );

  return {
    zoom,
    viewBox,
    moved: view.zoom !== 1 || view.x !== 0 || view.y !== 0,
    toFrame,
    zoomAt,
    panBy,
    reset,
  };
}
