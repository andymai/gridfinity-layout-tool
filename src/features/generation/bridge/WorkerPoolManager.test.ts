import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { WorkerPoolManager } from './WorkerPoolManager';
import type { WorkerPool } from './WorkerPool';

// Track WorkerPool constructor calls
const mockEnsureWorkers = vi.fn().mockResolvedValue(undefined);
const mockPoolInstances: Array<{
  kernel: string;
  ensureWorkers: ReturnType<typeof vi.fn>;
  isDestroyed: boolean;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('./WorkerPool', () => ({
  WorkerPool: vi.fn().mockImplementation(function MockWorkerPool(_size: unknown, kernel: string) {
    const instance = {
      kernel,
      ensureWorkers: mockEnsureWorkers,
      isDestroyed: false,
      destroy: vi.fn(),
    };
    mockPoolInstances.push(instance);
    return instance;
  }),
}));

// Mock the labs store so WorkerPoolManager can read the kernel flag.
// Use a mutable ref so individual tests can override isFeatureEnabled.
let mockIsFeatureEnabled: (flag: string) => boolean = () => false;

vi.mock('@/core/store/labs', () => ({
  useLabsStore: {
    getState: () => ({
      isFeatureEnabled: (flag: string) => mockIsFeatureEnabled(flag),
    }),
  },
}));

describe('WorkerPoolManager', () => {
  beforeEach(() => {
    mockPoolInstances.length = 0;
    mockEnsureWorkers.mockClear();
    mockEnsureWorkers.mockResolvedValue(undefined);
    mockIsFeatureEnabled = () => false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is defined', () => {
    expect(WorkerPoolManager).toBeDefined();
  });

  it('get() returns null when no pool is active', () => {
    const manager = new WorkerPoolManager();
    expect(manager.get()).toBeNull();
  });

  it('release() does not throw when called without acquire', () => {
    const manager = new WorkerPoolManager();
    expect(() => manager.release()).not.toThrow();
  });

  it('multiple releases do not go negative', () => {
    const manager = new WorkerPoolManager();
    manager.release();
    manager.release();
    manager.release();
    // Should not throw
    expect(manager.get()).toBeNull();
  });

  it('passes opencascade kernel by default', async () => {
    const manager = new WorkerPoolManager();
    await manager.acquire();

    const { WorkerPool: MockCtor } = await import('./WorkerPool');
    expect(vi.mocked(MockCtor)).toHaveBeenCalledWith(undefined, 'opencascade');
  });

  it('passes brepkit kernel when brepkit_kernel feature is enabled', async () => {
    mockIsFeatureEnabled = (flag: string) => flag === 'brepkit_kernel';

    const manager = new WorkerPoolManager();
    await manager.acquire();

    const { WorkerPool: MockCtor } = await import('./WorkerPool');
    expect(vi.mocked(MockCtor)).toHaveBeenCalledWith(undefined, 'brepkit');

    mockIsFeatureEnabled = () => false;
  });

  it('acquire initializes pool and returns it', async () => {
    const manager = new WorkerPoolManager();
    const pool = await manager.acquire();

    expect(mockEnsureWorkers).toHaveBeenCalledTimes(1);
    expect(pool).toBe(mockPoolInstances[0] as unknown as WorkerPool);
  });

  it('acquire rejects and cleans up when ensureWorkers fails', async () => {
    mockEnsureWorkers.mockRejectedValueOnce(new Error('WASM load failed'));
    const manager = new WorkerPoolManager();
    await expect(manager.acquire()).rejects.toThrow('WASM load failed');
    expect(manager.get()).toBeNull();
  });
});
