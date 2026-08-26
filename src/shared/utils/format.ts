/**
 * Millimeter value for display: rounded to 2 decimal places with no trailing
 * zeros and no unit suffix. Every surface that prints a raw mm number uses
 * this so the same dimension never renders with different precision.
 */
export function formatMm(value: number): string {
  return String(Math.round(value * 100) / 100);
}
