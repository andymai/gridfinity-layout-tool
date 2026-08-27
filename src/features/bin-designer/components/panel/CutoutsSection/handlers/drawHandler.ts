/**
 * Handler for the 'drawing' interaction mode.
 *
 * Computes a corner-to-corner rectangle/circle preview with modifier
 * support: Shift constrains to square, Alt draws from center.
 */

import { createDefaultCutout } from '../cutoutHelpers';
import { DEFAULT_KNIFE_PRESET } from '../knifeSlotPresets';
import { knifeSlotDimensions } from '@/features/bin-designer/types';
import { MIN_CUTOUT_SIZE } from '../geometry';
import { cutoutFitsInMask } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters } from './types';

/** Mode state for drawing, derived from the global InteractionMode union. */
type DrawingMode = Extract<InteractionMode, { type: 'drawing' }>;

/**
 * A dragged knife slot is not sized by the drag — the blade measurements fix
 * its size. The drag only aims it: the dominant axis picks whether the handle
 * exits along the bin's width or its depth, and the sign picks which wall. The
 * slot always keeps `openEnd: 'end'`, so the angle alone carries the exit.
 */
function knifeDrawPreview(mode: DrawingMode, event: PointerMoveEvent) {
  const dims = knifeSlotDimensions(DEFAULT_KNIFE_PRESET.knife);
  const dx = event.mmX - mode.startMmX;
  const dy = event.mmY - mode.startMmY;
  let rotation: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    rotation = dx >= 0 ? 0 : 180; // exit right : left
  } else {
    rotation = dy >= 0 ? 270 : 90; // exit back (+Y) : front (-Y)
  }
  // Unrotated box centred on the press point, so the knife pivots about where
  // the flick began; the rotation is stamped on the placed slot at commit. Left
  // unclamped like an over-long knife, so a blade longer than the bin lands off
  // the board where the grow-bin banner offers to take it.
  return {
    x: mode.startMmX - dims.widthMm / 2,
    y: mode.startMmY - dims.depthMm / 2,
    width: dims.widthMm,
    depth: dims.depthMm,
    shape: 'knifeSlot' as const,
    rotation,
  };
}

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
  if (mode.shape === 'knifeSlot') {
    setters.setDrawingPreview(knifeDrawPreview(mode, event));
    return;
  }

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

  const preview = {
    x: snap(x),
    y: snap(y),
    width: Math.max(MIN_CUTOUT_SIZE, snap(w)),
    depth: Math.max(MIN_CUTOUT_SIZE, snap(d)),
    shape: mode.shape,
  };

  // Polygon mask: hard-reject draw preview that overhangs the polygon. Tested
  // as the shape being drawn, not its box, so a circle can nest into a notch
  // corner its bounding rect would straddle.
  if (bounds.cellMask && bounds.maskCellSize) {
    const candidate = createDefaultCutout(
      'draw-preview',
      preview.shape,
      preview.x,
      preview.y,
      preview.width,
      preview.depth
    );
    if (!cutoutFitsInMask(candidate, bounds.cellMask, bounds.maskCellSize, bounds.meshAssets)) {
      return;
    }
  }

  setters.setDrawingPreview(preview);
}
