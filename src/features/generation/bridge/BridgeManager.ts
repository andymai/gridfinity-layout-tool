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

/**
 * Listener invoked whenever the engine readiness state changes. Receives the
 * current readiness — `true` once init has resolved and the bridge is alive,
 * `false` when the bridge is destroyed, refreshed, or before first acquire.
 */
export type EngineReadyListener = (ready: boolean) => void;

export class BridgeManager {
  private bridge: GenerationBridge | null = null;
  private refCount = 0;
  private initPromise: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Tracks the last ready state we've broadcast so we only fire listeners on
   * transitions. Avoids the "every acquire re-fires ready=true" noise.
   */
  private engineReadyState = false;
  private readyListeners = new Set<EngineReadyListener>();

  // Manifold draft-preview bridge (separate worker), ref-counted on its own so
  // its lifecycle stays independent of the exact bridge.
  private previewBridge: GenerationBridge | null = null;
  private previewRefCount = 0;
  private previewInitPromise: Promise<void> | null = null;
  private previewIdleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Acquire a reference to the shared bridge. Increments ref count.
   * Initializes the bridge if not already running.
   * Caller MUST call `release()` when done (typically on unmount).
   */
  async acquire(): Promise<GenerationBridge> {
    this.refCount++;
    this.clearIdleTimer();

    if (!this.bridge || this.bridge.isDestroyed) {
      this.bridge = new GenerationBridge(resolveKernel());
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
      this.setEngineReady(false);
      throw error;
    }

    this.setEngineReady(true);
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
        this.setEngineReady(false);
      }, IDLE_TIMEOUT_MS);
    }
  }

  /**
   * Acquire the Manifold draft-preview bridge, or `null` when the kernel fails
   * to init — draft is a best-effort enhancement, never fatal. The
   * `manifold_preview` feature is graduated (always on), so the flag gate here
   * only returns null if the feature were ever un-graduated. Ref-counted +
   * idle-kept like the exact bridge. Caller MUST call `releasePreview()` when done.
   */
  async acquirePreview(): Promise<GenerationBridge | null> {
    if (!useLabsStore.getState().isFeatureEnabled('manifold_preview')) return null;

    this.previewRefCount++;
    if (this.previewIdleTimer !== null) {
      clearTimeout(this.previewIdleTimer);
      this.previewIdleTimer = null;
    }

    if (!this.previewBridge || this.previewBridge.isDestroyed) {
      this.previewBridge = new GenerationBridge('manifold');
      this.previewInitPromise = this.previewBridge.init();
    }

    try {
      await this.previewInitPromise;
    } catch {
      // Best-effort: a failed preview kernel is non-fatal. Clean up and return
      // null so callers silently fall back to exact-only (matches the contract).
      this.previewRefCount = Math.max(0, this.previewRefCount - 1);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- bridge may be nulled by a concurrent releasePreview() during await
      if (this.previewBridge) this.previewBridge.destroy();
      this.previewBridge = null;
      this.previewInitPromise = null;
      return null;
    }

    return this.previewBridge;
  }

  /** Release a reference to the preview bridge; idle-destroys at zero refs. */
  releasePreview(): void {
    this.previewRefCount = Math.max(0, this.previewRefCount - 1);
    if (this.previewRefCount > 0) return;

    if (this.previewIdleTimer !== null) clearTimeout(this.previewIdleTimer);
    this.previewIdleTimer = setTimeout(() => {
      this.previewIdleTimer = null;
      this.previewBridge?.destroy();
      this.previewBridge = null;
      this.previewInitPromise = null;
    }, IDLE_TIMEOUT_MS);
  }

  /**
   * Tear down the current bridge and reset readiness, without disturbing the
   * ref count. Used by the export resilience wrapper to recover from a wedged
   * worker — the next `acquire()` builds a fresh `GenerationBridge` and
   * re-runs `init()`.
   *
   * Safe to call even when no bridge is active. Existing consumers retain
   * their refs but receive a `ready=false` notification so they can disable
   * UI affordances until the new bridge is ready.
   */
  refresh(): void {
    this.clearIdleTimer();
    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
    }
    this.initPromise = null;
    this.setEngineReady(false);
  }

  /**
   * Subscribe to engine readiness transitions. The listener fires on each
   * transition (not on no-op repeats) and is **also** called synchronously
   * with the current state, so callers can wire up UI without having to
   * separately seed initial state.
   *
   * Returns an unsubscribe function — typically wired to `useEffect` cleanup.
   */
  subscribe(listener: EngineReadyListener): () => void {
    this.readyListeners.add(listener);
    listener(this.engineReadyState);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  /**
   * Whether a bridge is currently alive and initialized. Mirrors the most
   * recent readiness broadcast to subscribers — see {@link subscribe}.
   */
  get engineReady(): boolean {
    return this.engineReadyState;
  }

  /**
   * Returns the active bridge without acquiring a reference, or null if none is active.
   * Used by consumers that need to check the current bridge without affecting its lifecycle.
   */
  get(): GenerationBridge | null {
    if (this.bridge?.isDestroyed) {
      this.bridge = null;
      this.initPromise = null;
      this.setEngineReady(false);
      return null;
    }
    return this.bridge;
  }

  private setEngineReady(ready: boolean): void {
    if (this.engineReadyState === ready) return;
    this.engineReadyState = ready;
    for (const listener of this.readyListeners) {
      listener(ready);
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export const bridgeManager = new BridgeManager();

/**
 * Pick the geometry kernel from labs flags. occt-wasm is the default engine;
 * `brepkit_kernel` opts into the alternative Rust-native kernel.
 */
function resolveKernel(): KernelName {
  const labs = useLabsStore.getState();
  if (labs.isFeatureEnabled('brepkit_kernel')) return 'brepkit';
  return 'occt-wasm';
}
