import { CONSTRAINTS } from '@/core/constants';

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
