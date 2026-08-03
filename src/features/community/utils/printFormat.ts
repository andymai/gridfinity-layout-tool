/**
 * Display formatting for print reports.
 *
 * Kept out of the components so the rounding rules are testable on their own:
 * these numbers are the decision inputs the whole feature exists to provide,
 * and a summary that rounds badly is worse than no summary.
 */

/**
 * Minutes as a compact duration. Hours-and-minutes above an hour, bare minutes
 * below it, and the minute part is dropped when it is zero so a clean two-hour
 * print reads "2h" rather than "2h 0m".
 */
export function formatPrintDuration(minutes: number): { hours: number; minutes: number } {
  const safe = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/**
 * Round a summary duration to something a reader can act on. A median of 127
 * minutes is not meaningfully different from 125, and quoting it to the minute
 * implies a precision the sample does not have.
 */
export function roundSummaryMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (minutes < 60) return Math.round(minutes / 5) * 5;
  return Math.round(minutes / 15) * 15;
}

/** Trailing-zero-free millimetre reading: 0.20 renders as 0.2, 0.4 stays 0.4. */
export function formatMillimetres(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Number(value.toFixed(2)));
}

/** Whole grams: sub-gram precision is noise against spool-to-spool variation. */
export function formatGrams(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return String(Math.round(value));
}
