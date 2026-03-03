import { describe, it, expect, vi, afterEach } from 'vitest';
import { WorkerPoolManager } from './WorkerPoolManager';

describe('WorkerPoolManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it('acquire rejects in test env (no WASM) and cleans up', async () => {
    const manager = new WorkerPoolManager();
    // In test env, Worker constructor will fail
    await expect(manager.acquire()).rejects.toThrow();
    // After failed acquire, pool should be null
    expect(manager.get()).toBeNull();
  });
});
