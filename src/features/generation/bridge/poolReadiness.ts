/**
 * Bounded wait for an in-flight WorkerPool acquisition.
 *
 * Split generation falls back to running every piece sequentially on the single
 * bridge when no pool is available. That fallback is for a pool that FAILED, but
 * it was also absorbing a pool that simply had not finished initializing: the
 * acquisition is kicked off after the bridge resolves and is deliberately not
 * awaited, so the first generation of a session always reads a null pool and
 * takes the sequential path.
 *
 * Measured on 90 days of `baseplate_preview_timing`: an unsplit plate (one piece,
 * so the pool is irrelevant) costs 3.4x cold-vs-warm, which is the honest
 * cold-cache penalty. A split plate costs 10.1x — and the median split is 6
 * pieces, so the extra ~3x is the lost parallelism, on the generation every user
 * sees first.
 *
 * Waiting is only worth it when there is real parallel work to wait FOR, and it
 * has to be bounded: a pool that never resolves must degrade to the sequential
 * path rather than hang the preview behind it.
 */

import type { WorkerPool } from './WorkerPool';

/**
 * How long a split generation will wait for a pool that is still initializing.
 *
 * Sized against what the wait buys: at the median 6-piece split, sequential
 * costs ~7.5s where the pool costs ~2.5s, so any wait under ~5s still wins. This
 * is deliberately well inside that, because the saving shrinks with piece count
 * and a stalled pool should not hold the exact build for long — the draft is on
 * screen throughout, but the BREP upgrade still owes the user a bounded wait.
 */
export const POOL_WAIT_MS = 3000;

/** A pool is only worth waiting for when it can actually run pieces in parallel. */
export function poolIsUsable(pool: WorkerPool | null): pool is WorkerPool {
  return pool !== null && !pool.isDestroyed && pool.size > 1;
}

/**
 * Resolve the in-flight pool acquisition, or null if it does not land within
 * `timeoutMs`, rejects, or yields a pool that cannot parallelize.
 *
 * Never rejects — the caller's contract is "pool or sequential", and an
 * acquisition failure is already non-fatal. A late-arriving pool is simply
 * abandoned here; `WorkerPoolManager` still owns its lifecycle and the ref that
 * the acquisition sets will pick it up for the NEXT generation.
 */
export async function awaitPoolWithin(
  pending: Promise<WorkerPool | null> | null,
  timeoutMs: number = POOL_WAIT_MS
): Promise<WorkerPool | null> {
  if (!pending) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const pool = await Promise.race([pending.catch(() => null), expiry]);
    return poolIsUsable(pool) ? pool : null;
  } finally {
    // Always clear, or a pending timer keeps the event loop (and Vitest's fake
    // timers) alive past the generation that opened it.
    clearTimeout(timer);
  }
}

/**
 * Whether a split generation should pay the wait: only when the pool is not
 * already usable AND there is more than one distinct piece to spread across it.
 * A single unique piece runs on one worker either way.
 */
export function shouldWaitForPool(pool: WorkerPool | null, uniquePieceCount: number): boolean {
  return !poolIsUsable(pool) && uniquePieceCount > 1;
}
