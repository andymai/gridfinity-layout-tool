/**
 * Handler for the 'group-scaling' interaction mode.
 *
 * Scales all selected cutouts (position and size) relative to the
 * group center, preserving proportional layout.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { MIN_CUTOUT_SIZE } from '../geometry';
import { cutoutFitsInMask } from '../maskFit';
import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, BinBounds, PreviewSetters, DeadZoneRef } from './types';

/** Dead zone in mm before scale starts updating preview. */
const DEAD_ZONE_MM = 0.5;

/** Mode state for group scaling, derived from the global InteractionMode union. */
type GroupScalingMode = Extract<InteractionMode, { type: 'group-scaling' }>;

/**
 * Compute group scale preview for all members.
 */
export function handleGroupScaleMove(
  mode: GroupScalingMode,
  event: PointerMoveEvent,
  cutouts: readonly Cutout[],
  bounds: BinBounds,
  deadZoneRef: DeadZoneRef,
  setters: Pick<PreviewSetters, 'setPreview'>
): void {
  if (!deadZoneRef.current) {
    const curDist = Math.sqrt((event.mmX - mode.center.x) ** 2 + (event.mmY - mode.center.y) ** 2);
    if (Math.abs(curDist - mode.startDist) < DEAD_ZONE_MM) return;
    deadZoneRef.current = true;
  }

  const curDist = Math.sqrt((event.mmX - mode.center.x) ** 2 + (event.mmY - mode.center.y) ** 2);
  const scaleFactor = mode.startDist > 0 ? curDist / mode.startDist : 1;

  const nextPreview = new Map<string, Partial<Cutout>>();
  for (const [id, initial] of mode.initialStates) {
    // Scale size
    const newW = Math.max(MIN_CUTOUT_SIZE, initial.width * scaleFactor);
    const newD = Math.max(MIN_CUTOUT_SIZE, initial.depth * scaleFactor);
    // Scale position offset from center
    const cxI = initial.x + initial.width / 2;
    const cyI = initial.y + initial.depth / 2;
    const dx = (cxI - mode.center.x) * scaleFactor;
    const dy = (cyI - mode.center.y) * scaleFactor;
    nextPreview.set(id, {
      x: mode.center.x + dx - newW / 2,
      y: mode.center.y + dy - newD / 2,
      width: newW,
      depth: newD,
    });
  }

  // Polygon mask: reject the scale step if any member would overhang the polygon.
  if (bounds.cellMask && bounds.maskCellSize) {
    for (const [id, patch] of nextPreview) {
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) continue;
      const candidate = { ...orig, ...patch };
      if (!cutoutFitsInMask(candidate, bounds.cellMask, bounds.maskCellSize)) return;
    }
  }

  setters.setPreview(nextPreview);
}
