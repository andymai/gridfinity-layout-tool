import { describe, it, expect } from 'vitest';
import { WorkerPool } from './WorkerPool';

describe('WorkerPool', () => {
  it('is defined', () => {
    expect(WorkerPool).toBeDefined();
  });

  it('starts with size 0', () => {
    const pool = new WorkerPool();
    expect(pool.size).toBe(0);
    expect(pool.isDestroyed).toBe(false);
    pool.destroy();
  });

  it('destroy sets isDestroyed', () => {
    const pool = new WorkerPool();
    pool.destroy();
    expect(pool.isDestroyed).toBe(true);
  });

  it('destroy is idempotent', () => {
    const pool = new WorkerPool();
    pool.destroy();
    pool.destroy(); // should not throw
    expect(pool.isDestroyed).toBe(true);
  });

  it('rejects ensureWorkers after destroy', async () => {
    const pool = new WorkerPool();
    pool.destroy();
    await expect(pool.ensureWorkers()).rejects.toThrow('Pool has been destroyed');
  });

  it('rejects generateBaseplates when not initialized', async () => {
    const pool = new WorkerPool();
    // ensureWorkers will fail in test env (no WASM), but generateBaseplates
    // should still fail with a meaningful error
    await expect(pool.generateBaseplates([])).rejects.toThrow();
    pool.destroy();
  });

  it('rejects generateSplitPreview when not initialized', async () => {
    const pool = new WorkerPool();
    await expect(
      pool.generateSplitPreview({} as Parameters<WorkerPool['generateSplitPreview']>[0], [], [], 4)
    ).rejects.toThrow();
    pool.destroy();
  });

  it('accepts custom pool size', () => {
    const pool = new WorkerPool(2);
    expect(pool.size).toBe(0); // not yet initialized
    pool.destroy();
  });

  it('size is 0 before ensureWorkers is called', () => {
    const pool = new WorkerPool(4);
    expect(pool.size).toBe(0);
    pool.destroy();
  });
});
