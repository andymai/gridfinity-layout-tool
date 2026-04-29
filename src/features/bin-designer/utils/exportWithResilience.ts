/**
 * Resilience wrapper for bin designer export operations.
 *
 * The bin export pipeline runs through a Web Worker that occasionally wedges
 * itself (#1339) — symptoms range from a one-shot brepjs boolean failure on a
 * borderline geometry to a long-lived stuck WASM heap that only `refresh()`
 * can recover. This wrapper layers a small retry policy on top of any export
 * call so users don't have to refresh the page to recover.
 *
 * Policy:
 *   1. Run the operation.
 *   2. On retryable error: wait 200ms, retry. (attempt 2)
 *   3. Still failing: wait 800ms, retry. (attempt 3)
 *   4. Still failing: `bridgeManager.refresh()`, then one more attempt with a
 *      fresh worker. (attempt 4)
 *   5. Still failing: surface the last error.
 *
 * Non-retryable errors (`INVALID_PARAMS`, `EMPTY_GEOMETRY`) are surfaced
 * immediately — they're caused by user input the worker can't process, and
 * retrying just delays the inevitable error toast.
 */

import { bridgeManager } from '@/shared/generation/bridge';
import type { ExportErrorCode } from '@/shared/generation/bridge';

/** Result wrapper that surfaces how many recovery attempts were needed. */
export interface ResilientExportResult<T> {
  readonly result: T;
  readonly retryCount: number;
  readonly restartCount: number;
}

/** Backoff schedule for retries before the worker restart. */
const RETRY_DELAYS_MS: readonly number[] = [200, 800];

/**
 * Default retryability classifier. Looks at message text for known
 * non-retryable error codes; everything else (including `UNKNOWN`) is
 * retryable on the assumption that transient WASM/BREP wobble is the
 * likeliest cause.
 */
function defaultIsRetryable(err: Error): boolean {
  const code = extractErrorCode(err);
  if (code === 'INVALID_PARAMS' || code === 'EMPTY_GEOMETRY') return false;
  return true;
}

/**
 * Pull an {@link ExportErrorCode} off an error, in case the worker stamped one
 * on. Workers send the code as a structured `errorCode` field on the response,
 * which the bridge currently bakes into the error message — fall back to text
 * inspection so this works regardless of how the code arrives.
 */
function extractErrorCode(err: Error): ExportErrorCode | undefined {
  const maybe = (err as unknown as { code?: unknown }).code;
  if (typeof maybe === 'string') return maybe as ExportErrorCode;
  // Fallback: parse from message — the worker prepends "<phase> failed: <msg>"
  // and our classifier tags would surface as part of the original message.
  if (/invalid (param|argument)/i.test(err.message)) return 'INVALID_PARAMS';
  if (/empty (geometry|solid|shape)/i.test(err.message)) return 'EMPTY_GEOMETRY';
  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ResilienceOptions {
  /** Override the default retryability test (e.g. to widen non-retryable cases). */
  isRetryable?: (err: Error) => boolean;
}

/**
 * Run `operation` with retry + worker-restart resilience. Resolves with the
 * operation's result plus diagnostics, or rejects with the most recent error
 * after all attempts (and the worker restart) are exhausted.
 *
 * The same `operation` function is invoked for each attempt, so callers must
 * construct it to read fresh state on each call (e.g. re-acquire the bridge).
 */
export async function exportWithResilience<T>(
  operation: () => Promise<T>,
  options: ResilienceOptions = {}
): Promise<ResilientExportResult<T>> {
  const isRetryable = options.isRetryable ?? defaultIsRetryable;

  let retryCount = 0;
  let restartCount = 0;

  // Phase 1: initial attempt + one extra attempt per scheduled delay.
  // `attempt` indexes into RETRY_DELAYS_MS for the *next* attempt's wait;
  // when it equals the array length we fall through to phase 2.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await operation();
      return { result, retryCount, restartCount };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!isRetryable(error)) throw error;
      if (attempt === RETRY_DELAYS_MS.length) break; // out of in-process retries
      retryCount++;
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  // Phase 2: refresh the worker, re-acquire so the new bridge is initialized,
  // then retry once. Without the acquire(), `operation()` would call
  // `getActiveBridge()` immediately after refresh — which returns null —
  // and throw "Bridge not available" before any new worker boots.
  bridgeManager.refresh();
  restartCount++;
  await bridgeManager.acquire();
  try {
    const result = await operation();
    return { result, retryCount, restartCount };
  } finally {
    bridgeManager.release();
  }
}
