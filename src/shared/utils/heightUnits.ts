import { CONSTRAINTS } from '@/core/constants';
import { GRIDFINITY_SPEC } from '@/shared/printSettings';

/**
 * Height a single exposed stacking lip adds on top of a stack, in mm. The lip
 * nests into the socket of the bin above (verified: stack pitch = body height),
 * so only the topmost bin's lip protrudes. Equals the mesh's real lip
 * contribution (`LIP_HEIGHT − LIP_OVERLAP`), matching `BinDimensions`.
 */
export const STACK_LIP_MM = GRIDFINITY_SPEC.LIP_HEIGHT - GRIDFINITY_SPEC.LIP_OVERLAP;

/**
 * Vertical pitch a stacked bin adds, in mm. Bins nest — the lip sinks into the
 * socket above — so each added bin advances the stack by its body height
 * (`heightUnits × heightUnitMm`), NOT its printed height (which includes the
 * lip). This is why two 5u bins stack to the same height as one 10u bin.
 */
export function stackPitchMm(heightUnits: number, heightUnitMm: number): number {
  return heightUnits * heightUnitMm;
}

/**
 * Total printed height of a stack of `count` identical bins, in mm:
 * `count × pitch + one exposed top lip`. A single bin (count 1) returns its
 * full printed height (`h·u + STACK_LIP_MM`).
 */
export function stackedTotalMm(heightUnits: number, heightUnitMm: number, count: number): number {
  if (count <= 0) return 0;
  return count * stackPitchMm(heightUnits, heightUnitMm) + STACK_LIP_MM;
}

/**
 * Inverse of {@link stackedTotalMm}: the `heightUnitMm` that makes `count` bins
 * of `unitsPerBin` height units stack to exactly `targetTotalMm`. Solves
 * `count × unitsPerBin × u + STACK_LIP_MM = targetTotalMm`. Returns null when
 * the inputs can't yield a positive unit value (e.g. target below the lip, or
 * non-positive count/units).
 */
export function solveHeightUnitMm(
  targetTotalMm: number,
  unitsPerBin: number,
  count: number
): number | null {
  if (count <= 0 || unitsPerBin <= 0) return null;
  const perUnit = (targetTotalMm - STACK_LIP_MM) / (count * unitsPerBin);
  return perUnit > 0 ? perUnit : null;
}

/**
 * Format a (possibly fractional) height-unit value for display: up to two
 * decimals with trailing zeros stripped, so 5 -> "5", 4.37 -> "4.37".
 */
export function formatHeightUnits(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Whether a bin of `heightUnits` at `heightUnitMm` ends up a clean multiple of
 * the standard 7mm height unit. When false, the physical height won't stack
 * with standard Gridfinity bins — used to surface a non-blocking warning, not
 * to block the value.
 */
export function isStandardStackHeight(heightUnits: number, heightUnitMm: number): boolean {
  const physicalMm = heightUnits * heightUnitMm;
  const remainder = physicalMm % CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT;
  const distance = Math.min(remainder, CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT - remainder);
  return distance < 0.01;
}
