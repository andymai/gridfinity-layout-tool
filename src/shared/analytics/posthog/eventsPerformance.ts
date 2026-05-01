/**
 * Performance + diagnostics tracking events.
 *
 * Emits the WASM-threading status, generation cache hit/miss
 * statistics, brepjs kernel category timings, and the baseplate
 * preview's two-stage timing (direct mesh vs. final BREP).
 */

import { trackEvent } from './trackEvent';

/**
 * Track WASM threading status when generation bridge initializes.
 * This helps understand hardware capabilities across our user base.
 */
export function trackWasmThreadingStatus(isThreaded: boolean, hardwareConcurrency: number): void {
  trackEvent('wasm_threading_status', {
    is_threaded: isThreaded,
    hardware_concurrency: hardwareConcurrency,
  });
}

/**
 * Track generation cache performance for capacity planning.
 * Called after each geometry generation with per-generation hit/miss/eviction deltas.
 */
export function trackCachePerformance(stats: {
  total_hits: number;
  total_misses: number;
  total_evictions: number;
  hit_rate: number;
  cache_count: number;
}): void {
  trackEvent('generation_cache_stats', {
    total_hits: stats.total_hits,
    total_misses: stats.total_misses,
    total_evictions: stats.total_evictions,
    hit_rate: stats.hit_rate,
    cache_count: stats.cache_count,
  });
}

const toSnakeCase = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/**
 * Track brepjs kernel operation timing for performance monitoring.
 * Called after each geometry generation with per-category timing breakdown.
 */
export function trackKernelPerformance(payload: {
  stats: Readonly<Record<string, { totalMs: number; count: number }>>;
}): void {
  // Flatten stats into snake_case properties: boolean_ms, edge_mesh_count, etc.
  const properties: Record<string, number> = {};
  for (const [category, { totalMs, count }] of Object.entries(payload.stats)) {
    if (count > 0) {
      const key = toSnakeCase(category);
      properties[`${key}_ms`] = Math.round(totalMs * 10) / 10;
      properties[`${key}_count`] = count;
    }
  }
  if (Object.keys(properties).length > 0) {
    trackEvent('generation_kernel_perf', properties);
  }
}

/**
 * Track time-to-first-mesh (direct-mesh placeholder) and time-to-final-mesh
 * (BREP) for the baseplate page. Lets us validate the perceived-perf win
 * post-launch and catch regressions if the direct-mesh path stalls.
 *
 * `directMeshMs` is the synchronous procedural path (~50-200 ms typical).
 * `brepMs` is the WASM BREP path (~1-3 s warm, +2-4 s cold for WASM init).
 * `pieceCount` is 1 for unsplit baseplates; >1 for split tilings.
 * `success` distinguishes completed BREP from errored/timed-out runs so
 * failures are visible in PostHog dashboards.
 */
export function trackBaseplatePreviewTiming(payload: {
  directMeshMs: number;
  brepMs: number;
  pieceCount: number;
  isSplit: boolean;
  wasmCold: boolean;
  success: boolean;
}): void {
  trackEvent('baseplate_preview_timing', {
    direct_mesh_ms: Math.round(payload.directMeshMs * 10) / 10,
    brep_ms: Math.round(payload.brepMs * 10) / 10,
    piece_count: payload.pieceCount,
    is_split: payload.isSplit,
    wasm_cold: payload.wasmCold,
    success: payload.success,
  });
}
