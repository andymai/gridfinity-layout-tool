export const PADDING_BUTTON_STEP = 0.25;
export const PADDING_INPUT_STEP = 0.01;
export const PADDING_MIN = 0;
export const PADDING_MAX = 100;

/** Format mm: round to 2 decimals, drop trailing zeros (e.g. 5 → "5", 5.5 → "5.5", 5.25 → "5.25"). */
export function formatMm(v: number): string {
  return String(Math.round(v * 100) / 100);
}
