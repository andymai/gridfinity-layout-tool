/** Exponential lerp speed — higher = faster convergence. */
export const LERP_SPEED = 8;

/** Threshold below which we snap to target to avoid infinite tiny updates. */
export const SNAP_THRESHOLD = 0.001;

/**
 * Pure lerp step function. Returns the new current value after one frame.
 * Returns null if no update is needed (already at target).
 */
export function lerpStep(current: number, target: number, delta: number): number | null {
  const diff = target - current;
  if (Math.abs(diff) > SNAP_THRESHOLD) {
    return current + diff * Math.min(delta * LERP_SPEED, 1);
  } else if (current !== target) {
    return target;
  }
  return null;
}
