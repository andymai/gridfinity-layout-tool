import { CONSTRAINTS } from '@/core/constants';

export interface AxisFit {
  /** Grid units that fit, clamped to [GRID_MIN, GRID_MAX]. */
  units: number;
  /** Leftover mm: measured − units × pitch. Negative when the clamp forced a larger grid. */
  slackMm: number;
}

const FLOAT_EPSILON = 1e-9;

/**
 * Largest unit count that fits inside a measured drawer axis. Floors rather
 * than rounds — the grid must fit INSIDE the physical drawer, so a near-miss
 * upward would produce a baseplate that physically doesn't fit.
 */
export function fitAxisUnits(measuredMm: number, gridUnitMm: number, allowHalf: boolean): AxisFit {
  const step = allowHalf ? 0.5 : 1;
  // The lower clamp must respect the step: clamping a tiny measurement to
  // GRID_MIN (0.5) in whole-unit mode would set a fractional dimension
  // while half-grid mode is off.
  const minUnits = allowHalf ? CONSTRAINTS.GRID_MIN : 1;
  const raw = Math.floor(measuredMm / gridUnitMm / step + FLOAT_EPSILON) * step;
  const units = Math.min(CONSTRAINTS.GRID_MAX, Math.max(minUnits, raw));
  return { units, slackMm: measuredMm - units * gridUnitMm };
}

/**
 * The tighter half-unit fit for an axis, or null when the whole-unit fit is
 * already as tight as a half-unit grid can get (remainder < pitch / 2).
 *
 * Two ways a half-unit grid wins. Usually it reaches further into the drawer
 * (`units` is larger). But below one full pitch the whole-unit fit is clamped
 * UP to 1 and overflows the drawer, and there `units` moves the other way — a
 * half unit that FITS is the upgrade over a whole unit that doesn't, so the
 * comparison has to be on slack, not size alone.
 */
export function halfUnitUpgrade(
  measuredMm: number,
  gridUnitMm: number,
  wholeUnits: number
): AxisFit | null {
  const half = fitAxisUnits(measuredMm, gridUnitMm, true);
  if (half.units > wholeUnits) return half;
  const wholeOverflows = measuredMm - wholeUnits * gridUnitMm < -FLOAT_EPSILON;
  return wholeOverflows && half.slackMm >= -FLOAT_EPSILON ? half : null;
}
