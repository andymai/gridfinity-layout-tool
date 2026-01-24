/**
 * Adaptive debounce for generation requests.
 *
 * Adjusts the debounce delay based on recent generation timings:
 * - Fast generations (<150ms) → ~50ms debounce (snappy UX)
 * - Medium generations (200-600ms) → ~100-200ms debounce
 * - Slow generations (>800ms) → ~280-300ms debounce (avoid stacking)
 *
 * Uses a rolling window of the last 5 timings to compute the average,
 * then returns avg * 0.35 clamped to [50, 300].
 */

/** Rolling window size for averaging timings */
const WINDOW_SIZE = 5;

/** Fraction of average timing to use as debounce delay */
const TIMING_FACTOR = 0.35;

/** Minimum debounce delay (ms) */
const MIN_DELAY = 50;

/** Maximum debounce delay (ms) */
const MAX_DELAY = 300;

/** Default delay when no timing history exists */
const DEFAULT_DELAY = 200;

/**
 * Tracks generation timings and provides adaptive debounce delays.
 */
export class AdaptiveDebounce {
  private timings: number[] = [];

  /**
   * Record a completed generation timing.
   * Keeps only the most recent WINDOW_SIZE entries.
   */
  recordTiming(ms: number): void {
    this.timings.push(ms);
    if (this.timings.length > WINDOW_SIZE) {
      this.timings.shift();
    }
  }

  /**
   * Get the current adaptive delay based on recent timings.
   * Returns DEFAULT_DELAY when no history is available.
   */
  getDelay(): number {
    if (this.timings.length === 0) {
      return DEFAULT_DELAY;
    }

    const sum = this.timings.reduce((a, b) => a + b, 0);
    const avg = sum / this.timings.length;
    const delay = avg * TIMING_FACTOR;

    return Math.max(MIN_DELAY, Math.min(MAX_DELAY, delay));
  }

  /**
   * Reset all timing history (e.g., on worker restart).
   */
  reset(): void {
    this.timings = [];
  }

  /**
   * Get the number of recorded timings (for testing).
   */
  get size(): number {
    return this.timings.length;
  }
}
