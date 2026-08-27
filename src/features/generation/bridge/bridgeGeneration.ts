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

import type { BinParams, ResolvedBaseplateParams, MarginPiece } from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { WorkerMessage } from './types';
import type { AdaptiveDebounce } from './adaptiveDebounce';
import { computeBaseplateTimeoutMs, computeGenerationTimeoutMs } from './generationTimeout';
import { paramsFingerprint } from './bridgeHelpers';
import type { GenerationResultCache } from './resultCache';
import type { ProgressCallback, GenerationResult } from './bridgeTypes';

export interface BridgeGenerationContext {
  readonly isDestroyed: boolean;
  readonly binCache: GenerationResultCache;
  readonly baseplateCache: GenerationResultCache;
  readonly itemCache: GenerationResultCache;
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
  /** Ensure a worker is initialized; resolves once it is ready for requests. */
  init: () => Promise<void>;
  /** Terminate the current worker and bring up a fresh one. */
  hardResetWorker: () => void;
}

/**
 * Dispatch a generation request once the worker is ready, then arm its timeout.
 *
 * `postMessage()` is a no-op when the worker is null, so a request sent while
 * the worker is being (re)created — e.g. immediately after a timeout hard-reset
 * terminated a wedged worker — would otherwise be silently dropped and hang.
 * Awaiting `init()` makes the request wait for a live worker; on the happy path
 * `init()` is an already-resolved cached promise, so this only defers the post
 * by a microtask.
 *
 * The timeout is armed only once `init()` resolves and the message is actually
 * posted, so it measures generation time alone. `init()`'s own settlement is
 * already bounded by `INIT_TIMEOUT_MS` with one retry (see `tryInit`), so a
 * worker that never reports ready is caught there, not here. Arming this timer
 * before `init()` settles double-charges a cold WASM boot against the
 * generation budget: a legitimately slow-but-successful init (occt-wasm on a
 * slow connection or cold cache, within `tryInit`'s own 60s allowance) can by
 * itself exceed a trivial design's 30s `BASE_TIMEOUT_MS`, hard-resetting a
 * worker that was about to come up healthy and rejecting a request that had
 * not started generating anything yet.
 */
function sendWhenReady(
  ctx: BridgeGenerationContext,
  requestId: string,
  timeoutMs: number,
  message: WorkerMessage
): void {
  void ctx.init().then(
    () => {
      // A newer request superseded this one while the worker was initializing.
      if (ctx.currentRequestId !== requestId) return;
      startGenerationTimeout(ctx, requestId, timeoutMs);
      ctx.postMessage(message);
    },
    (err: unknown) => {
      if (ctx.currentRequestId !== requestId) return;
      const reject = ctx.pendingReject;
      ctx.clearPending();
      reject?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export function generateBin(
  ctx: BridgeGenerationContext,
  params: BinParams,
  onProgress: ProgressCallback | undefined,
  debounce: boolean,
  withLabelPlates = false
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  // The flag is part of the identity, not just the request: the same params
  // requested without plates (layout planner, thumbnail regeneration) produce a
  // result that does NOT satisfy a later designer request. Sharing one entry
  // would make plates appear or vanish purely on call order.
  const fingerprint = withLabelPlates
    ? `${paramsFingerprint(params)}|plates`
    : paramsFingerprint(params);
  const cached = ctx.binCache.get(fingerprint);
  if (cached) return Promise.resolve(cached);

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
      ctx.binCache.setPending(fingerprint);
      sendWhenReady(ctx, requestId, computeGenerationTimeoutMs(params), {
        type: 'GENERATE',
        payload: { params, requestId, withLabelPlates },
      });
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
  params: ResolvedBaseplateParams,
  onProgress: ProgressCallback | undefined,
  debounce: boolean
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  const fingerprint = paramsFingerprint(params);
  const cached = ctx.baseplateCache.get(fingerprint);
  if (cached) return Promise.resolve(cached);

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
      ctx.baseplateCache.setPending(fingerprint);
      sendWhenReady(ctx, requestId, computeBaseplateTimeoutMs(params), {
        type: 'GENERATE_BASEPLATE',
        payload: { params, requestId },
      });
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
 * Generate one detached margin rail. Shares the single-pending-request channel
 * with `generateBaseplate`, so callers await each rail in turn (as the
 * sequential split path already does). No dedup cache — rails are cheap and the
 * orchestrating hook drives them per tiling.
 */
export function generateMargin(
  ctx: BridgeGenerationContext,
  params: ResolvedBaseplateParams,
  margin: MarginPiece
): Promise<GenerationResult> {
  if (ctx.isDestroyed) {
    return Promise.reject(new Error('Bridge has been destroyed'));
  }

  if (ctx.debounceTimer !== null) {
    clearTimeout(ctx.debounceTimer);
    ctx.debounceTimer = null;
  }

  ctx.cancelCurrentRequest();
  ctx.onProgress = null;

  return new Promise<GenerationResult>((resolve, reject) => {
    ctx.pendingResolve = resolve;
    ctx.pendingReject = reject;
    const requestId = ctx.nextRequestId();
    ctx.currentRequestId = requestId;
    sendWhenReady(ctx, requestId, computeBaseplateTimeoutMs(params), {
      type: 'GENERATE_BASEPLATE_MARGIN',
      payload: { params, margin, requestId },
    });
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
  const cached = ctx.itemCache.get(fingerprint);
  if (cached) return Promise.resolve(cached);

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
      ctx.itemCache.setPending(fingerprint);
      sendWhenReady(ctx, requestId, computeItemTimeoutMs(item), {
        type: 'GENERATE_ITEM',
        payload: { item, requestId },
      });
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
      // A single-threaded WASM worker blocked inside an uninterruptible
      // synchronous op (e.g. a long boolean union) can't process a CANCEL
      // message, so terminate it outright. Without this, the wedged worker
      // keeps running the doomed generation and every subsequent request
      // queues behind it and times out in turn.
      ctx.hardResetWorker();
      reject(
        new Error(
          'Generation timed out — this design may be too complex. Try reducing grid size or disabling features like magnets, compartments, or wall patterns.'
        )
      );
    }
  }, timeoutMs);
}
