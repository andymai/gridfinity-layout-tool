/**
 * Sampling gate for the high-frequency generation diagnostics.
 *
 * `generation_cache_stats` and `generation_kernel_perf` fire once per geometry
 * generation, which puts them an order of magnitude above every product event
 * and makes them the bulk of ingested volume. They feed capacity planning and
 * regression watching, where a sample is as good as a census.
 *
 * The decision is taken once per page session rather than per event so a
 * sampled session emits a complete series: cache and kernel timings for the
 * same generation stay joinable, which per-event coin flips would break.
 */

export const PERF_SAMPLE_RATE = 0.1;

let sampled: boolean | null = null;

export function isPerfSampled(): boolean {
  sampled ??= Math.random() < PERF_SAMPLE_RATE;
  return sampled;
}

/** Test seam: clears the memoized per-session decision. */
export function resetPerfSampling(): void {
  sampled = null;
}
