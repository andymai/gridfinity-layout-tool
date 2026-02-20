/**
 * Format a height value as dual units + millimetres display.
 *
 * @example formatHeight(5, 7) // "5u (35mm)"
 * @example formatHeight(3, 7) // "3u (21mm)"
 */
export function formatHeight(units: number, heightUnitMm: number): string {
  const mm = Math.round(units * heightUnitMm);
  return `${units}u (${mm}mm)`;
}
