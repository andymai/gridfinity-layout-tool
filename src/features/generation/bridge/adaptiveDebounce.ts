/**
 * Adaptive debounce for generation requests.
 *
 * Adjusts the debounce delay based on recent generation timings:
 * - Fast generations (<150ms) → ~50ms debounce (snappy UX)
 * - Medium generations (200-600ms) → ~100-200ms debounce
 * - Slow generations (>800ms) → ~280-500ms debounce (avoid stacking)
 *
 * Uses a rolling window of the last 5 timings to compute the average,
 * then returns avg * 0.35 clamped to [50, 500].
 */

/** Rolling window size for averaging timings */
const WINDOW_SIZE = 5;

/** Fraction of average timing to use as debounce delay */
const TIMING_FACTOR = 0.35;

/** Minimum debounce delay (ms) */
const MIN_DELAY = 50;

/** Maximum debounce delay (ms) - increased to reduce wasted generations for complex bins */
const MAX_DELAY = 500;

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

  /**
   * Get the average timing from recent history.
   * Returns null if no history available.
   */
  getAverageTiming(): number | null {
    if (this.timings.length === 0) return null;
    const sum = this.timings.reduce((a, b) => a + b, 0);
    return sum / this.timings.length;
  }

  /**
   * Get the last recorded timing.
   * Returns null if no history available.
   */
  getLastTiming(): number | null {
    if (this.timings.length === 0) return null;
    return this.timings[this.timings.length - 1];
  }
}

/**
 * Estimate generation complexity factor based on bin parameters.
 * Returns a multiplier relative to a baseline 1x1x3 bin (1.0).
 *
 * Factors:
 * - Cell count: O(n) for base socket building
 * - Compartments: O(cols * rows) for walls
 * - Magnets/screws: adds holes per full cell
 * - Inserts: O(count) boolean cuts
 */
export function estimateComplexity(params: {
  width: number;
  depth: number;
  height: number;
  compartments: { cols: number; rows: number };
  base: { style: string };
  inserts: unknown[];
}): number {
  // Base complexity from cell count
  const cells = Math.ceil(params.width) * Math.ceil(params.depth);
  let complexity = 1 + cells * 0.15;

  // Height adds slight complexity
  complexity += params.height * 0.02;

  // Compartment walls
  const wallCount = Math.max(0, params.compartments.cols - 1) + Math.max(0, params.compartments.rows - 1);
  complexity += wallCount * 0.1;

  // Magnet/screw holes (4 per full cell)
  if (params.base.style !== 'standard') {
    const fullCells = Math.floor(params.width) * Math.floor(params.depth);
    complexity += fullCells * 0.05;
  }

  // Inserts
  complexity += params.inserts.length * 0.15;

  return complexity;
}

/** Threshold for showing complexity warning (ms) */
export const COMPLEXITY_WARNING_THRESHOLD = 1500;
