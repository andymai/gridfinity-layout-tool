/**
 * The grid every magnet diameter control works on: the baseplate magnet holes,
 * the underside mount magnets, the bin base and the lid retention magnets.
 * Only the controls and their setters snap to it. Load paths keep a stored
 * value as it is, so a design saved before this grid builds the same part.
 */

const STEPS_PER_MM = 20;

export const MAGNET_DIAMETER_STEP_MM = 1 / STEPS_PER_MM;

/**
 * Nearest value on the 0.05 mm grid. Divides by a whole number rather than
 * multiplying by the step, so the result is the clean double (6.15, not
 * 6.1499999999999995) that the params hash and the cache keys see.
 */
export function snapMagnetDiameter(mm: number): number {
  return Math.round(mm * STEPS_PER_MM) / STEPS_PER_MM;
}

/** Keeps one decimal where the value allows, so it reads like the depth beside it ("⌀6.0 × 2.0 mm"). */
export function formatMagnetDiameter(mm: number): string {
  const hundredths = mm.toFixed(2);
  return hundredths.endsWith('0') ? mm.toFixed(1) : hundredths;
}
