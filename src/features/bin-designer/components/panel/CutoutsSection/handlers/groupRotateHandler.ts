/**
 * Handler for the 'group-rotating' interaction mode.
 *
 * Rotates all selected cutouts around the group center, preserving
 * their relative positions and individual rotations.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { rotatePoint } from '../geometry';
import { cutoutFitsInMask } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, PreviewSetters, DeadZoneRef } from './types';

/** Mode state for group rotation, derived from the global InteractionMode union. */
type GroupRotatingMode = Extract<InteractionMode, { type: 'group-rotating' }>;

/**
 * Compute group rotation preview for all members.
 */
export function handleGroupRotateMove(
  mode: GroupRotatingMode,
  event: PointerMoveEvent,
  cutouts: readonly Cutout[],
  bounds: BinBounds,
  deadZoneRef: DeadZoneRef,
  setters: Pick<PreviewSetters, 'setPreview'>
): void {
  if (!deadZoneRef.current) {
    const currentAngle =
      Math.atan2(event.mmY - mode.center.y, event.mmX - mode.center.x) * (180 / Math.PI);
    if (Math.abs(currentAngle - mode.startAngle) < 1) return;
    deadZoneRef.current = true;
  }

  const currentAngle =
    Math.atan2(event.mmY - mode.center.y, event.mmX - mode.center.x) * (180 / Math.PI);
  let delta = currentAngle - mode.startAngle;
  if (event.shiftKey) {
    delta = Math.round(delta / 15) * 15;
  }

  const nextPreview = new Map<string, Partial<Cutout>>();
  for (const [id, initial] of mode.initialStates) {
    const cutout = cutouts.find((c) => c.id === id);
    if (!cutout) continue;
    // Rotate position around group center
    const cxI = initial.x + cutout.width / 2;
    const cyI = initial.y + cutout.depth / 2;
    const rotated = rotatePoint(cxI, cyI, mode.center.x, mode.center.y, delta);
    nextPreview.set(id, {
      x: rotated.x - cutout.width / 2,
      y: rotated.y - cutout.depth / 2,
      rotation: (((initial.rotation + delta) % 360) + 360) % 360,
    });
  }

  // Polygon mask: reject the rotation if any member would overhang the polygon.
  if (bounds.cellMask && bounds.maskCellSize) {
    for (const [id, patch] of nextPreview) {
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) continue;
      const candidate = { ...orig, ...patch } as Cutout;
      if (!cutoutFitsInMask(candidate, bounds.cellMask, bounds.maskCellSize)) return;
    }
  }

  setters.setPreview(nextPreview);
}
