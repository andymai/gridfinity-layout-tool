/**
 * Handler for the 'resizing' interaction mode.
 *
 * Manages dead-zone detection, delegating to the geometry-level
 * resize calculation, snapping, and clamping to bin bounds.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle } from '../useCutoutInteraction';
import { calculateCutoutResize, MIN_CUTOUT_SIZE } from '../geometry';
import type { StartRect } from '../geometry';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters, DeadZoneRef } from './types';

/** Dead zone in mm before resize starts updating preview. */
const DEAD_ZONE_MM = 0.5;

/** Mode state for resizing. */
export interface ResizingMode {
  readonly type: 'resizing';
  readonly cutoutId: string;
  readonly handle: ResizeHandle;
  readonly startRect: StartRect;
}

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
  setters.setPreview(
    new Map([
      [
        mode.cutoutId,
        {
          x: Math.max(0, Math.min(snap(resized.x), bounds.binWidth - snappedW)),
          y: Math.max(0, Math.min(snap(resized.y), bounds.binDepth - snappedD)),
          width: snappedW,
          depth: snappedD,
        },
      ],
    ])
  );
}
