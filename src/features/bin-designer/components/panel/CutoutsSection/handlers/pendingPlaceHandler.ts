/**
 * Handler for the 'pending-place' interaction mode.
 *
 * Monitors cursor distance from the initial click point and transitions
 * to 'drawing' mode once the threshold is exceeded.
 */

import type { InteractionMode } from '../useCutoutInteraction';
import type { PointerMoveEvent, SetModeFn } from './types';

/** Minimum drag distance (mm) to enter drawing mode vs click-to-place. */
const PLACE_DRAG_THRESHOLD = 2;

/** Mode state for pending-place, derived from the global InteractionMode union. */
type PendingPlaceMode = Extract<InteractionMode, { type: 'pending-place' }>;

/**
 * Check if the cursor has moved far enough to transition from
 * pending-place to drawing mode.
 */
export function handlePendingPlaceMove(
  mode: PendingPlaceMode,
  event: PointerMoveEvent,
  setMode: SetModeFn
): void {
  const dist = Math.sqrt((event.mmX - mode.startMmX) ** 2 + (event.mmY - mode.startMmY) ** 2);
  if (dist >= PLACE_DRAG_THRESHOLD) {
    setMode({
      type: 'drawing',
      shape: mode.shape,
      startMmX: mode.startMmX,
      startMmY: mode.startMmY,
    });
  }
}
