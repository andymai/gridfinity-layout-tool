/**
 * Generation flow for `GenerationBridge` — bin and baseplate.
 *
 * Both flows share the same shape:
 *   1. Reject if destroyed.
 *   2. Check the dedup cache; return cached result on hit.
 *   3. Cancel any in-flight request and pending debounce.
 *   4. Set up the resolve/reject promise and the generation timeout.
 *   5. Either debounce or send the worker message immediately.
 *
 * Extracted from the bridge class to keep the state-machine file focused on
 * lifecycle. Each function takes a `BridgeGenerationContext` — a narrow view
 * of the private fields it needs to mutate.
 */

import type { BinParams, BaseplateParams } from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { WorkerMessage } from './types';
import type { AdaptiveDebounce } from './adaptiveDebounce';
import { computeBaseplateTimeoutMs, computeGenerationTimeoutMs } from './generationTimeout';
import { paramsFingerprint } from './bridgeHelpers';
import type { ProgressCallback, GenerationResult, DedupCache } from './bridgeTypes';

export interface BridgeGenerationContext {
  readonly isDestroyed: boolean;
  readonly binCache: DedupCache;
  readonly baseplateCache: DedupCache;
  readonly itemCache: DedupCache;
  readonly adaptiveDebounce: AdaptiveDebounce;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  generationTimer: ReturnType<typeof setTimeout> | null;
  pendingResolve: ((result: GenerationResult) => void) | null;
  pendingReject: ((error: Error) => void) | null;
  currentRequestId: string | null;
  onProgress: ProgressCallback | null;
  cancelCurrentRequest: () => void;
  clearPending: () => void;
  postMessage: (message: WorkerMessage) => void;
  nextRequestId: () => string;
}

export function generateBin(
  ctx: BridgeGenerationContext,
  params: BinParams,
  onProgress: ProgressCallback | undefined,
  debounce: boolean
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  const fingerprint = paramsFingerprint(params);
  if (ctx.binCache.fingerprint === fingerprint && ctx.binCache.result) {
    return Promise.resolve(ctx.binCache.result);
  }

  if (ctx.debounceTimer !== null) {
    clearTimeout(ctx.debounceTimer);
    ctx.debounceTimer = null;
  }

  ctx.cancelCurrentRequest();
  ctx.onProgress = onProgress ?? null;

  return new Promise<GenerationResult>((resolve, reject) => {
    ctx.pendingResolve = resolve;
    ctx.pendingReject = reject;

    const send = (): void => {
      const requestId = ctx.nextRequestId();
      ctx.currentRequestId = requestId;
      ctx.binCache.pendingFingerprint = fingerprint;
      startGenerationTimeout(ctx, requestId, computeGenerationTimeoutMs(params));
      ctx.postMessage({ type: 'GENERATE', payload: { params, requestId } });
    };

    if (debounce) {
      ctx.debounceTimer = setTimeout(() => {
        ctx.debounceTimer = null;
        send();
      }, ctx.adaptiveDebounce.getDelay());
    } else {
      send();
    }
  });
}

export function generateBaseplate(
  ctx: BridgeGenerationContext,
  params: BaseplateParams,
  onProgress: ProgressCallback | undefined,
  debounce: boolean
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  const fingerprint = paramsFingerprint(params);
  if (ctx.baseplateCache.fingerprint === fingerprint && ctx.baseplateCache.result) {
    return Promise.resolve(ctx.baseplateCache.result);
  }

  if (ctx.debounceTimer !== null) {
    clearTimeout(ctx.debounceTimer);
    ctx.debounceTimer = null;
  }

  ctx.cancelCurrentRequest();
  ctx.onProgress = onProgress ?? null;

  return new Promise<GenerationResult>((resolve, reject) => {
    ctx.pendingResolve = resolve;
    ctx.pendingReject = reject;

    const send = (): void => {
      const requestId = ctx.nextRequestId();
      ctx.currentRequestId = requestId;
      ctx.baseplateCache.pendingFingerprint = fingerprint;
      startGenerationTimeout(ctx, requestId, computeBaseplateTimeoutMs(params));
      ctx.postMessage({ type: 'GENERATE_BASEPLATE', payload: { params, requestId } });
    };

    if (debounce) {
      ctx.debounceTimer = setTimeout(() => {
        ctx.debounceTimer = null;
        send();
      }, ctx.adaptiveDebounce.getDelay());
    } else {
      send();
    }
  });
}

/** Footprint-scaled timeout for generic item generation. */
function computeItemTimeoutMs(item: GridfinityItem): number {
  const cells = Math.max(1, item.envelope.width * item.envelope.depth);
  return Math.min(120_000, 20_000 + cells * 1500);
}

/**
 * Generic item generation — mirrors `generateBaseplate` with its own dedup
 * cache so bin and item fingerprints can't collide.
 */
export function generateItem(
  ctx: BridgeGenerationContext,
  item: GridfinityItem,
  onProgress: ProgressCallback | undefined,
  debounce: boolean
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  const fingerprint = paramsFingerprint(item);
  if (ctx.itemCache.fingerprint === fingerprint && ctx.itemCache.result) {
    return Promise.resolve(ctx.itemCache.result);
  }

  if (ctx.debounceTimer !== null) {
    clearTimeout(ctx.debounceTimer);
    ctx.debounceTimer = null;
  }

  ctx.cancelCurrentRequest();
  ctx.onProgress = onProgress ?? null;

  return new Promise<GenerationResult>((resolve, reject) => {
    ctx.pendingResolve = resolve;
    ctx.pendingReject = reject;

    const send = (): void => {
      const requestId = ctx.nextRequestId();
      ctx.currentRequestId = requestId;
      ctx.itemCache.pendingFingerprint = fingerprint;
      startGenerationTimeout(ctx, requestId, computeItemTimeoutMs(item));
      ctx.postMessage({ type: 'GENERATE_ITEM', payload: { item, requestId } });
    };

    if (debounce) {
      ctx.debounceTimer = setTimeout(() => {
        ctx.debounceTimer = null;
        send();
      }, ctx.adaptiveDebounce.getDelay());
    } else {
      send();
    }
  });
}

/**
 * Start a timeout to recover from unresponsive workers (WASM OOM, infinite loops).
 * Cleared in clearPending() when the worker responds (success, error, or cancel).
 */
function startGenerationTimeout(
  ctx: BridgeGenerationContext,
  requestId: string,
  timeoutMs: number
): void {
  if (ctx.generationTimer !== null) {
    clearTimeout(ctx.generationTimer);
    ctx.generationTimer = null;
  }
  ctx.generationTimer = setTimeout(() => {
    if (ctx.currentRequestId === requestId && ctx.pendingReject) {
      const reject = ctx.pendingReject;
      ctx.clearPending();
      ctx.postMessage({ type: 'CANCEL', requestId });
      reject(
        new Error(
          'Generation timed out — this design may be too complex. Try reducing grid size or disabling features like magnets, compartments, or wall patterns.'
        )
      );
    }
  }, timeoutMs);
}
