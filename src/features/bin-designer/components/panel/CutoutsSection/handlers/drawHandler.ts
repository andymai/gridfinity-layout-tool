/**
 * Handler for the 'drawing' interaction mode.
 *
 * Computes a corner-to-corner rectangle/circle preview with modifier
 * support: Shift constrains to square, Alt draws from center.
 */

import { MIN_CUTOUT_SIZE } from '../geometry';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters } from './types';

/** Mode state for drawing, derived from the global InteractionMode union. */
type DrawingMode = Extract<InteractionMode, { type: 'drawing' }>;

/**
 * Compute drawing preview dimensions from cursor position and modifiers.
 */
export function handleDrawMove(
  mode: DrawingMode,
  event: PointerMoveEvent,
  bounds: BinBounds,
  snap: SnapFn,
  setters: Pick<PreviewSetters, 'setDrawingPreview'>
): void {
  let w = Math.abs(event.mmX - mode.startMmX);
  let d = Math.abs(event.mmY - mode.startMmY);

  // Shift: constrain to square
  if (event.shiftKey) {
    const maxDim = Math.max(w, d);
    w = maxDim;
    d = maxDim;
  }

  let x: number;
  let y: number;
  if (event.altKey) {
    // Alt: draw from center
    x = Math.max(0, mode.startMmX - w);
    y = Math.max(0, mode.startMmY - d);
    w = Math.min(w * 2, bounds.binWidth - x);
    d = Math.min(d * 2, bounds.binDepth - y);
  } else {
    x = Math.max(0, Math.min(mode.startMmX, event.mmX));
    y = Math.max(0, Math.min(mode.startMmY, event.mmY));
    w = Math.min(w, bounds.binWidth - x);
    d = Math.min(d, bounds.binDepth - y);
  }

  setters.setDrawingPreview({
    x: snap(x),
    y: snap(y),
    width: Math.max(MIN_CUTOUT_SIZE, snap(w)),
    depth: Math.max(MIN_CUTOUT_SIZE, snap(d)),
    shape: mode.shape,
  });
}
