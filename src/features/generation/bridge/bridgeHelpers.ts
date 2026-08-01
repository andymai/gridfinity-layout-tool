/**
 * Pure helpers for the generation bridge: deterministic params fingerprint,
 * INIT_READY threading-info validation, and dedup-cache initialization.
 */

import type { KernelName } from './types';
import type { DedupCache, ThreadingInfo } from './bridgeTypes';

// Re-exported rather than defined here: the worker needs the same encoding for
// its `lastSolid` identity, and worker → bridge value imports are not allowed.
export { paramsFingerprint } from '@/shared/generation/paramsFingerprint';

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
