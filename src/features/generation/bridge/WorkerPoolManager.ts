/**
 * Reference-counted singleton manager for the shared WorkerPool.
 *
 * Same lifecycle pattern as BridgeManager: keeps the pool alive between route
 * navigations and destroys after 30 seconds of zero references. This avoids
 * re-creating N workers + loading WASM N times on every page visit.
 *
 * Usage:
 *   const pool = await workerPoolManager.acquire();
 *   try { ... use pool ... }
 *   finally { workerPoolManager.release(); }
 */

import { WorkerPool } from './WorkerPool';

/** How long to keep the pool alive after the last consumer releases (ms) */
const IDLE_TIMEOUT_MS = 30_000;

export class WorkerPoolManager {
  private pool: WorkerPool | null = null;
  private refCount = 0;
  private initPromise: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Acquire a reference to the shared pool. Increments ref count.
   * Initializes the pool if not already running.
   * Caller MUST call `release()` when done (typically on unmount).
   */
  async acquire(): Promise<WorkerPool> {
    this.refCount++;
    this.clearIdleTimer();

    if (!this.pool || this.pool.isDestroyed) {
      this.pool = new WorkerPool();
      this.initPromise = this.pool.ensureWorkers();
    }

    try {
      await this.initPromise;
    } catch (error: unknown) {
      this.refCount--;
      this.pool?.destroy();
      this.pool = null;
      this.initPromise = null;
      throw error;
    }

    return this.pool;
  }

  /**
   * Release a reference to the shared pool.
   * When ref count drops to zero, starts a 30s idle timer before destroying.
   */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);

    if (this.refCount === 0) {
      this.clearIdleTimer();
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        this.pool?.destroy();
        this.pool = null;
        this.initPromise = null;
      }, IDLE_TIMEOUT_MS);
    }
  }

  /**
   * Returns the active pool without acquiring a reference, or null if none is active.
   * Used by consumers that need to check the current pool without affecting its lifecycle.
   */
  get(): WorkerPool | null {
    if (this.pool?.isDestroyed) {
      this.pool = null;
      this.initPromise = null;
      return null;
    }
    return this.pool;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export const workerPoolManager = new WorkerPoolManager();
