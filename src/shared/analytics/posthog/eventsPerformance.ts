/**
 * Performance + diagnostics tracking events.
 *
 * Emits the WASM-threading status, generation cache hit/miss
 * statistics, brepjs kernel category timings, and the baseplate
 * preview's two-stage timing (direct mesh vs. final BREP).
 */

import type { WorkerCacheStats } from '@/shared/types/generation';
import { trackEvent } from './trackEvent';

const toCacheKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

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
 *
 * Per-cache hit_rate and evictions are flattened into top-level properties
 * (`cache_<name>_hit_rate`, `cache_<name>_evictions`) so PostHog filters/aggregates
 * can identify which cache is dragging the aggregate hit rate down.
 */
export function trackCachePerformance(stats: {
  total_hits: number;
  total_misses: number;
  total_evictions: number;
  hit_rate: number;
  cache_count: number;
  per_cache?: readonly WorkerCacheStats[];
}): void {
  const properties: Record<string, number> = {
    total_hits: stats.total_hits,
    total_misses: stats.total_misses,
    total_evictions: stats.total_evictions,
    hit_rate: stats.hit_rate,
    cache_count: stats.cache_count,
  };

  const seenKeys = new Set<string>();
  let collisions = 0;
  for (const c of stats.per_cache ?? []) {
    const total = c.hits + c.misses;
    if (total === 0) continue;
    const key = toCacheKey(c.name);
    if (seenKeys.has(key)) {
      collisions++;
      continue;
    }
    seenKeys.add(key);
    properties[`cache_${key}_hit_rate`] = Math.round((c.hits / total) * 1000) / 1000;
    properties[`cache_${key}_evictions`] = c.evictions;
  }
  if (collisions > 0) properties.cache_key_collisions = collisions;

  trackEvent('generation_cache_stats', properties);
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
 * Track each batch→sequential fallback that fires inside `batchWithFallback`.
 *
 * One event per fallback record (zero events on the common path). The
 * `successful_count` / `target_count` ratio is the diagnostic for #1792:
 *   `successful = target - 1`  → concentrated failure (bisect wins)
 *   `successful = 0`           → structural failure (bisect doesn't help)
 *   anything in between        → mixed; investigate `error_category`.
 */
export function trackBooleanFallbacks(payload: {
  records: ReadonlyArray<{
    category: 'fuse' | 'cut' | 'pattern_cut';
    targetCount: number;
    successfulCount: number;
    errorCategory: string;
  }>;
}): void {
  for (const r of payload.records) {
    trackEvent('generation_boolean_fallback', {
      op_category: r.category,
      target_count: r.targetCount,
      successful_count: r.successfulCount,
      failed_count: r.targetCount - r.successfulCount,
      error_category: r.errorCategory,
    });
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
