/**
 * Pure helpers for the generation bridge: deterministic params fingerprint,
 * INIT_READY threading-info validation, and dedup-cache initialization.
 */

import type { KernelName } from './types';
import type { DedupCache, ThreadingInfo } from './bridgeTypes';

/**
 * Deterministic fingerprint for generation params.
 *
 * Uses JSON.stringify with sorted keys to ensure identical params always
 * produce the same string, regardless of property insertion order.
 */
export function paramsFingerprint(params: unknown): string {
  return JSON.stringify(params, (_, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}

/** Extract threading info from INIT_READY with defensive validation. */
export function extractThreadingInfo(data: {
  isThreaded: boolean;
  hardwareConcurrency: number;
  kernel: KernelName;
}): ThreadingInfo {
  const isThreaded = typeof data.isThreaded === 'boolean' ? data.isThreaded : false;
  const hardwareConcurrency =
    Number.isFinite(data.hardwareConcurrency) && data.hardwareConcurrency > 0
      ? data.hardwareConcurrency
      : 4;
  const kernel: KernelName = data.kernel === 'brepkit' ? 'brepkit' : 'occt-wasm';
  return { isThreaded, hardwareConcurrency, kernel };
}

export function createDedupCache(): DedupCache {
  return { fingerprint: null, result: null, pendingFingerprint: null };
}
