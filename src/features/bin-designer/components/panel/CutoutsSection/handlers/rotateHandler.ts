/**
 * Handler for the 'rotating' interaction mode (single cutout).
 *
 * Manages dead-zone detection, angle calculation, shift-snap to 15-degree
 * increments, and clamping rotation to keep the cutout within bin bounds.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { clampRotationToBounds } from '../geometry';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, PreviewSetters, DeadZoneRef } from './types';

/** Mode state for rotating a single cutout, derived from the global InteractionMode union. */
type RotatingMode = Extract<InteractionMode, { type: 'rotating' }>;

/**
 * Compute rotation preview for the target cutout.
 */
export function handleRotateMove(
  mode: RotatingMode,
  event: PointerMoveEvent,
  cutouts: readonly Cutout[],
  bounds: BinBounds,
  deadZoneRef: DeadZoneRef,
  setters: Pick<PreviewSetters, 'setPreview'>
): void {
  // Dead zone check
  if (!deadZoneRef.current) {
    const cutout = cutouts.find((c) => c.id === mode.cutoutId);
    if (!cutout) return;
    const cx = cutout.x + cutout.width / 2;
    const cy = cutout.y + cutout.depth / 2;
    // Check if we've rotated far enough from start
    const currentAngle = Math.atan2(event.mmY - cy, event.mmX - cx) * (180 / Math.PI);
    if (Math.abs(currentAngle - mode.startAngle) < 1) return;
    deadZoneRef.current = true;
  }

  const cutout = cutouts.find((c) => c.id === mode.cutoutId);
  if (!cutout) return;

  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const currentAngle = Math.atan2(event.mmY - cy, event.mmX - cx) * (180 / Math.PI);
  const delta = currentAngle - mode.startAngle;
  let newRotation = (((mode.initialRotation - delta) % 360) + 360) % 360;

  // Snap to 15-degree increments when Shift is held
  if (event.shiftKey) {
    newRotation = Math.round(newRotation / 15) * 15;
  }

  // Clamp rotation to keep within bin bounds
  newRotation = clampRotationToBounds(cutout, newRotation, bounds.binWidth, bounds.binDepth);

  setters.setPreview(new Map([[mode.cutoutId, { rotation: newRotation }]]));
}
