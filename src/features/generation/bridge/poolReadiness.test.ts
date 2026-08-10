import { describe, it, expect } from 'vitest';
import type { WorkerPool } from './WorkerPool';
import { awaitPoolWithin, poolIsUsable, shouldWaitForPool, POOL_WAIT_MS } from './poolReadiness';

const fakePool = (overrides: Partial<WorkerPool> = {}): WorkerPool =>
  ({ isDestroyed: false, size: 4, ...overrides }) as WorkerPool;

const later = <T>(value: T, ms: number): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('poolIsUsable', () => {
  it('accepts a live pool with more than one worker', () => {
    expect(poolIsUsable(fakePool())).toBe(true);
  });

  it('rejects null, destroyed, and single-worker pools', () => {
    expect(poolIsUsable(null)).toBe(false);
    expect(poolIsUsable(fakePool({ isDestroyed: true }))).toBe(false);
    // A one-worker pool runs pieces sequentially anyway, so it is not "usable"
    // in the sense that matters: it buys no parallelism over the single bridge.
    expect(poolIsUsable(fakePool({ size: 1 }))).toBe(false);
  });
});

describe('shouldWaitForPool', () => {
  /**
   * The defect this exists for: on the first generation of a session the pool
   * acquisition is still in flight, so the split path read a null pool and ran
   * every piece sequentially on the single bridge.
   */
  it('waits when the pool is not ready and there is parallel work', () => {
    expect(shouldWaitForPool(null, 6)).toBe(true);
  });

  it('does not wait for a single unique piece — one worker either way', () => {
    expect(shouldWaitForPool(null, 1)).toBe(false);
  });

  it('does not wait when a usable pool is already in hand', () => {
    expect(shouldWaitForPool(fakePool(), 6)).toBe(false);
  });

  it('waits when the pool in hand cannot parallelize', () => {
    expect(shouldWaitForPool(fakePool({ size: 1 }), 6)).toBe(true);
    expect(shouldWaitForPool(fakePool({ isDestroyed: true }), 6)).toBe(true);
  });
});

describe('awaitPoolWithin', () => {
  it('returns the pool when the acquisition lands in time', async () => {
    const pool = fakePool();
    await expect(awaitPoolWithin(Promise.resolve(pool), 50)).resolves.toBe(pool);
  });

  it('returns null when there is no acquisition in flight', async () => {
    await expect(awaitPoolWithin(null, 50)).resolves.toBeNull();
  });

  /** A stalled pool must degrade to sequential, not hold the exact build open. */
  it('gives up at the timeout and returns null', async () => {
    const start = Date.now();
    await expect(awaitPoolWithin(later(fakePool(), 400), 60)).resolves.toBeNull();
    expect(Date.now() - start).toBeLessThan(350);
  });

  /**
   * Acquisition failure is already non-fatal upstream, so surfacing a rejection
   * here would turn a degraded-but-working generation into a failed one.
   */
  it('swallows a rejected acquisition', async () => {
    await expect(awaitPoolWithin(Promise.reject(new Error('boom')), 50)).resolves.toBeNull();
  });

  it('rejects a pool that arrives unusable', async () => {
    await expect(awaitPoolWithin(Promise.resolve(fakePool({ size: 1 })), 50)).resolves.toBeNull();
    await expect(
      awaitPoolWithin(Promise.resolve(fakePool({ isDestroyed: true })), 50)
    ).resolves.toBeNull();
  });

  /**
   * The wait has to stay well under what it saves: a median 6-piece split costs
   * ~7.5s sequentially versus ~2.5s pooled, so a wait at or above ~5s could cost
   * more than the parallelism it is waiting for.
   */
  it('keeps the default wait inside the window the parallelism buys back', () => {
    expect(POOL_WAIT_MS).toBeLessThan(5000);
  });
});
