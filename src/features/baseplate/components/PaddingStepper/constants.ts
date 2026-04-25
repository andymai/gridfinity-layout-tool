export const PADDING_BUTTON_STEP = 0.25;
export const PADDING_INPUT_STEP = 0.01;
export const PADDING_MIN = 0;
export const PADDING_MAX = 100;

/**
 * Round to 2-decimal mm precision, eliminating IEEE-754 float noise that
 * can accumulate from repeated +0.25 button clicks or `* 0.01` snapping.
 * E.g. roundMm(0.1 + 0.2) === 0.3 and roundMm(5.5600000000000005) === 5.56.
 */
export function roundMm(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Format mm: round to 2 decimals, drop trailing zeros (e.g. 5 → "5", 5.5 → "5.5", 5.25 → "5.25"). */
export function formatMm(v: number): string {
  return String(roundMm(v));
}
