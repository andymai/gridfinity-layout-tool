/**
 * Reference-counted singleton manager for the GenerationBridge.
 *
 * Keeps the bridge (worker + WASM instance) alive between route navigations
 * instead of destroying and recreating it each time. When all consumers release,
 * the bridge is kept alive for 30 seconds to cover quick navigation round-trips
 * (e.g., designer → baseplate → designer).
 *
 * The WorkerPool is managed separately by WorkerPoolManager — it needs
 * independent WASM instances for parallelism and has its own ref-counted lifecycle.
 */

import { GenerationBridge } from './GenerationBridge';
import type { KernelName } from './types';
import { useLabsStore } from '@/core/store/labs';

/** How long to keep the bridge alive after the last consumer releases (ms) */
const IDLE_TIMEOUT_MS = 30_000;

export class BridgeManager {
  private bridge: GenerationBridge | null = null;
  private refCount = 0;
  private initPromise: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Acquire a reference to the shared bridge. Increments ref count.
   * Initializes the bridge if not already running.
   * Caller MUST call `release()` when done (typically on unmount).
   */
  async acquire(): Promise<GenerationBridge> {
    this.refCount++;
    this.clearIdleTimer();

    if (!this.bridge || this.bridge.isDestroyed) {
      const kernel: KernelName = useLabsStore.getState().isFeatureEnabled('brepkit_kernel')
        ? 'brepkit'
        : 'opencascade';
      this.bridge = new GenerationBridge(kernel);
      this.initPromise = this.bridge.init();
    }

    try {
      await this.initPromise;
    } catch (error: unknown) {
      this.refCount--;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- bridge may be nulled by concurrent release() during await
      if (this.bridge) this.bridge.destroy();
      this.bridge = null;
      this.initPromise = null;
      throw error;
    }

    return this.bridge;
  }

  /**
   * Release a reference to the shared bridge.
   * When ref count drops to zero, starts a 30s idle timer before destroying.
   */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);

    if (this.refCount === 0) {
      this.clearIdleTimer();
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        this.bridge?.destroy();
        this.bridge = null;
        this.initPromise = null;
      }, IDLE_TIMEOUT_MS);
    }
  }

  /**
   * Returns the active bridge without acquiring a reference, or null if none is active.
   * Used by consumers that need to check the current bridge without affecting its lifecycle.
   */
  get(): GenerationBridge | null {
    if (this.bridge?.isDestroyed) {
      this.bridge = null;
      this.initPromise = null;
      return null;
    }
    return this.bridge;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export const bridgeManager = new BridgeManager();
