/**
 * Handler for the 'resizing' interaction mode.
 *
 * Manages dead-zone detection, delegating to the geometry-level
 * resize calculation, snapping, and clamping to bin bounds.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { calculateCutoutResize, MIN_CUTOUT_SIZE } from '../geometry';
import { cutoutFitsInMask } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters, DeadZoneRef } from './types';

/** Dead zone in mm before resize starts updating preview. */
const DEAD_ZONE_MM = 0.5;

/** Mode state for resizing, derived from the global InteractionMode union. */
type ResizingMode = Extract<InteractionMode, { type: 'resizing' }>;

/**
 * Compute resize preview for the target cutout.
 */
export function handleResizeMove(
  mode: ResizingMode,
  event: PointerMoveEvent,
  cutouts: readonly Cutout[],
  bounds: BinBounds,
  snap: SnapFn,
  deadZoneRef: DeadZoneRef,
  setters: Pick<PreviewSetters, 'setPreview'>
): void {
  // Dead zone check
  if (!deadZoneRef.current) {
    const cutout = cutouts.find((c) => c.id === mode.cutoutId);
    if (!cutout) return;
    // Use start center as reference
    const cx = mode.startRect.x + mode.startRect.width / 2;
    const cy = mode.startRect.y + mode.startRect.depth / 2;
    const startDist = Math.sqrt(
      (mode.startRect.x + mode.startRect.width - cx) ** 2 +
        (mode.startRect.y + mode.startRect.depth - cy) ** 2
    );
    const curDist = Math.sqrt((event.mmX - cx) ** 2 + (event.mmY - cy) ** 2);
    if (Math.abs(curDist - startDist) < DEAD_ZONE_MM) return;
    deadZoneRef.current = true;
  }

  const cutout = cutouts.find((c) => c.id === mode.cutoutId);
  if (!cutout) return;

  const resized = calculateCutoutResize(
    mode.startRect,
    mode.handle,
    event.mmX,
    event.mmY,
    bounds.binWidth,
    bounds.binDepth,
    cutout.shape,
    cutout.rotation,
    event.shiftKey,
    event.altKey
  );

  // Snap, then clamp to bin bounds (snap can round past non-integer edges)
  const snappedW = Math.max(MIN_CUTOUT_SIZE, snap(resized.width));
  const snappedD = Math.max(MIN_CUTOUT_SIZE, snap(resized.depth));
  const nextPatch = {
    x: Math.max(0, Math.min(snap(resized.x), bounds.binWidth - snappedW)),
    y: Math.max(0, Math.min(snap(resized.y), bounds.binDepth - snappedD)),
    width: snappedW,
    depth: snappedD,
  };

  // Polygon mask: hard-reject resizes that would overhang the polygon.
  if (bounds.cellMask && bounds.maskCellSize) {
    const candidate = { ...cutout, ...nextPatch } as Cutout;
    if (!cutoutFitsInMask(candidate, bounds.cellMask, bounds.maskCellSize)) {
      return;
    }
  }

  setters.setPreview(new Map([[mode.cutoutId, nextPatch]]));
}
