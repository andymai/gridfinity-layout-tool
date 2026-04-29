import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BridgeManager } from './BridgeManager';
import type { GenerationBridge } from './GenerationBridge';

// Mock the labs store so BridgeManager can read the kernel flag.
// Use a mutable ref so individual tests can override isFeatureEnabled.
let mockIsFeatureEnabled: (flag: string) => boolean = () => false;

vi.mock('@/core/store/labs', () => ({
  useLabsStore: {
    getState: () => ({
      isFeatureEnabled: (flag: string) => mockIsFeatureEnabled(flag),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock GenerationBridge so no Worker or WASM is loaded
// ---------------------------------------------------------------------------

type MockBridgeInstance = {
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isDestroyed: boolean;
};

// Module-level array that the vi.mock factory pushes into — shared via closure
const mockInstances: MockBridgeInstance[] = [];

const makeFreshInstance = (): MockBridgeInstance => ({
  init: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
  isDestroyed: false,
});

// Use a named function (not an arrow) so `new GenerationBridge()` works
vi.mock('./GenerationBridge', () => ({
  GenerationBridge: vi.fn().mockImplementation(function MockGenerationBridge() {
    const instance = makeFreshInstance();
    mockInstances.push(instance);
    return instance;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asBridge(m: MockBridgeInstance): GenerationBridge {
  return m as unknown as GenerationBridge;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BridgeManager', () => {
  let manager: BridgeManager;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockInstances.length = 0;

    // Reset the mock constructor to the default successful implementation
    const { GenerationBridge: MockCtor } = await import('./GenerationBridge');
    vi.mocked(MockCtor).mockImplementation(function MockGenerationBridge() {
      const instance = makeFreshInstance();
      mockInstances.push(instance);
      return instance as unknown as GenerationBridge;
    });

    manager = new BridgeManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // kernel flag
  // -------------------------------------------------------------------------

  describe('kernel selection', () => {
    it('passes brepkit kernel when brepkit_kernel feature is enabled', async () => {
      mockIsFeatureEnabled = (flag: string) => flag === 'brepkit_kernel';

      const brepkitManager = new BridgeManager();
      await brepkitManager.acquire();

      const { GenerationBridge: MockCtor } = await import('./GenerationBridge');
      expect(vi.mocked(MockCtor)).toHaveBeenCalledWith('brepkit');

      mockIsFeatureEnabled = () => false;
    });
  });

  // -------------------------------------------------------------------------
  // acquire()
  // -------------------------------------------------------------------------

  describe('acquire()', () => {
    it('creates a bridge, calls init(), and returns it', async () => {
      const bridge = await manager.acquire();

      expect(mockInstances).toHaveLength(1);
      expect(mockInstances[0].init).toHaveBeenCalledTimes(1);
      expect(bridge).toBe(asBridge(mockInstances[0]));
    });

    it('does not create additional bridge instances on repeated calls', async () => {
      await manager.acquire();
      await manager.acquire();
      await manager.acquire();

      expect(mockInstances).toHaveLength(1);
    });

    it('returns the same bridge instance on repeated calls', async () => {
      const first = await manager.acquire();
      const second = await manager.acquire();
      const third = await manager.acquire();

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('does not call init() again for subsequent acquires on the same bridge', async () => {
      await manager.acquire();
      await manager.acquire();

      expect(mockInstances[0].init).toHaveBeenCalledTimes(1);
    });

    it('cancels an in-progress idle timer when re-acquired', async () => {
      await manager.acquire();
      manager.release(); // starts idle timer

      // Re-acquire before timer fires
      const bridge = await manager.acquire();

      // Advance past the full idle window — bridge must NOT be destroyed
      vi.advanceTimersByTime(30_000);

      expect(mockInstances[0].destroy).not.toHaveBeenCalled();
      expect(bridge).toBe(asBridge(mockInstances[0]));
    });
  });

  // -------------------------------------------------------------------------
  // release()
  // -------------------------------------------------------------------------

  describe('release()', () => {
    it('does not start idle timer while other consumers still hold references', async () => {
      await manager.acquire();
      await manager.acquire(); // refCount = 2

      manager.release(); // refCount = 1 — timer must NOT start yet
      vi.advanceTimersByTime(30_000);

      expect(mockInstances[0].destroy).not.toHaveBeenCalled();
    });

    it('starts a 30s idle timer when the last consumer releases', async () => {
      await manager.acquire();
      manager.release(); // refCount drops to 0

      // Bridge still alive before timer fires
      expect(mockInstances[0].destroy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(29_999);
      expect(mockInstances[0].destroy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
    });

    it('destroys the bridge and nulls it after the idle timeout', async () => {
      await manager.acquire();
      manager.release();

      vi.advanceTimersByTime(30_000);

      expect(manager.get()).toBeNull();
    });

    it('does not go below zero on extra release calls', async () => {
      await manager.acquire();
      manager.release();
      manager.release(); // extra — should be a no-op re: timer logic

      vi.advanceTimersByTime(30_000);

      // Only one destroy call (from the idle timer that fired after the first release)
      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Re-acquire during / after idle timer
  // -------------------------------------------------------------------------

  describe('re-acquire lifecycle', () => {
    it('cancels destruction and returns the same bridge when re-acquired during idle window', async () => {
      await manager.acquire();
      manager.release(); // refCount = 0, timer starts

      // Re-acquire before 30s elapses
      vi.advanceTimersByTime(15_000);
      const bridge = await manager.acquire();

      // Let the original timer deadline pass — bridge must NOT be destroyed
      vi.advanceTimersByTime(15_000);

      expect(mockInstances[0].destroy).not.toHaveBeenCalled();
      expect(bridge).toBe(asBridge(mockInstances[0]));
      expect(mockInstances).toHaveLength(1);
    });

    it('creates a fresh bridge when re-acquired after idle timeout fires', async () => {
      await manager.acquire();
      manager.release();

      // Let idle timer fire
      vi.advanceTimersByTime(30_000);
      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);

      // Next acquire must create a brand new bridge
      const freshBridge = await manager.acquire();

      expect(mockInstances).toHaveLength(2);
      expect(mockInstances[1].init).toHaveBeenCalledTimes(1);
      expect(freshBridge).toBe(asBridge(mockInstances[1]));
    });
  });

  // -------------------------------------------------------------------------
  // get()
  // -------------------------------------------------------------------------

  describe('get()', () => {
    it('returns null when no bridge has been acquired yet', () => {
      expect(manager.get()).toBeNull();
    });

    it('returns the active bridge after acquire()', async () => {
      const bridge = await manager.acquire();
      expect(manager.get()).toBe(bridge);
    });

    it('returns null and cleans up when bridge.isDestroyed is true', async () => {
      await manager.acquire();

      // Simulate external destruction
      mockInstances[0].isDestroyed = true;

      expect(manager.get()).toBeNull();

      // Subsequent get() still returns null (state is cleaned up)
      expect(manager.get()).toBeNull();
    });

    it('returns null after idle timer destroys the bridge', async () => {
      await manager.acquire();
      manager.release();
      vi.advanceTimersByTime(30_000);

      expect(manager.get()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // acquire() error recovery
  // -------------------------------------------------------------------------

  describe('acquire() error recovery', () => {
    it('re-throws init() error, decrements ref count, destroys bridge, and nulls it', async () => {
      const initError = new Error('WASM load failed');
      const { GenerationBridge: MockCtor } = await import('./GenerationBridge');

      vi.mocked(MockCtor).mockImplementationOnce(function MockFailBridge() {
        const instance = makeFreshInstance();
        instance.init.mockRejectedValue(initError);
        mockInstances.push(instance);
        return instance as unknown as GenerationBridge;
      });

      const failManager = new BridgeManager();

      await expect(failManager.acquire()).rejects.toThrow('WASM load failed');

      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
      expect(failManager.get()).toBeNull();
    });

    it('creates a fresh bridge on the next acquire() after a failed init', async () => {
      const initError = new Error('first init failed');
      const { GenerationBridge: MockCtor } = await import('./GenerationBridge');

      vi.mocked(MockCtor).mockImplementationOnce(function MockFailBridge() {
        const instance = makeFreshInstance();
        instance.init.mockRejectedValue(initError);
        mockInstances.push(instance);
        return instance as unknown as GenerationBridge;
      });

      const failManager = new BridgeManager();

      await expect(failManager.acquire()).rejects.toThrow('first init failed');

      // Second acquire must succeed with a new bridge
      const bridge = await failManager.acquire();

      expect(mockInstances).toHaveLength(2);
      expect(mockInstances[1].init).toHaveBeenCalledTimes(1);
      expect(bridge).toBe(asBridge(mockInstances[1]));
    });

    it('does not start an idle timer after a failed acquire (ref count remains 0)', async () => {
      const initError = new Error('init error');
      const { GenerationBridge: MockCtor } = await import('./GenerationBridge');

      vi.mocked(MockCtor).mockImplementationOnce(function MockFailBridge() {
        const instance = makeFreshInstance();
        instance.init.mockRejectedValue(initError);
        mockInstances.push(instance);
        return instance as unknown as GenerationBridge;
      });

      const failManager = new BridgeManager();

      await expect(failManager.acquire()).rejects.toThrow();

      // Advance well past idle timeout — destroy() should not fire a second time
      vi.advanceTimersByTime(60_000);

      // destroy() was called exactly once during error recovery, not again via timer
      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // refresh()
  // -------------------------------------------------------------------------

  describe('refresh()', () => {
    it('destroys the current bridge and clears state', async () => {
      await manager.acquire();
      manager.refresh();

      expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
      expect(manager.get()).toBeNull();
      expect(manager.engineReady).toBe(false);
    });

    it('lets the next acquire() build a fresh bridge', async () => {
      await manager.acquire();
      manager.refresh();

      const fresh = await manager.acquire();
      expect(mockInstances).toHaveLength(2);
      expect(fresh).toBe(asBridge(mockInstances[1]));
    });

    it('is a no-op when called before any acquire', () => {
      expect(() => manager.refresh()).not.toThrow();
      expect(manager.engineReady).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe()
  // -------------------------------------------------------------------------

  describe('subscribe()', () => {
    it('fires synchronously with the current state', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(false);
    });

    it('fires on transitions when the bridge becomes ready', async () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      listener.mockClear();

      await manager.acquire();
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('fires on transitions when the bridge is refreshed', async () => {
      await manager.acquire();
      const listener = vi.fn();
      manager.subscribe(listener);
      listener.mockClear();

      manager.refresh();
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('does not fire on no-op transitions (already-ready acquire)', async () => {
      await manager.acquire();
      const listener = vi.fn();
      manager.subscribe(listener);
      // Initial sync call counts as 1
      expect(listener).toHaveBeenCalledTimes(1);
      listener.mockClear();

      await manager.acquire(); // refCount++, but no readiness transition
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function that stops further notifications', async () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);
      listener.mockClear();

      unsubscribe();
      await manager.acquire();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Module-level singleton smoke test
  // -------------------------------------------------------------------------

  describe('bridgeManager singleton', () => {
    it('is exported from the module and has the expected interface', async () => {
      const { bridgeManager } = await import('./BridgeManager');
      expect(bridgeManager).toBeDefined();
      expect(typeof bridgeManager.acquire).toBe('function');
      expect(typeof bridgeManager.release).toBe('function');
      expect(typeof bridgeManager.get).toBe('function');
    });
  });
});
