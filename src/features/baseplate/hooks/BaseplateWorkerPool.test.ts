import { describe, it, expect } from 'vitest';
import { BaseplateWorkerPool } from './BaseplateWorkerPool';

describe('BaseplateWorkerPool', () => {
  it('is defined', () => {
    expect(BaseplateWorkerPool).toBeDefined();
  });

  it('starts with size 0', () => {
    const pool = new BaseplateWorkerPool();
    expect(pool.size).toBe(0);
    expect(pool.isDestroyed).toBe(false);
    pool.destroy();
  });

  it('destroy sets isDestroyed', () => {
    const pool = new BaseplateWorkerPool();
    pool.destroy();
    expect(pool.isDestroyed).toBe(true);
  });

  it('destroy is idempotent', () => {
    const pool = new BaseplateWorkerPool();
    pool.destroy();
    pool.destroy(); // should not throw
    expect(pool.isDestroyed).toBe(true);
  });

  it('rejects init after destroy', async () => {
    const pool = new BaseplateWorkerPool();
    pool.destroy();
    await expect(pool.init(2)).rejects.toThrow('Pool has been destroyed');
  });

  it('rejects generatePieces when not initialized', async () => {
    const pool = new BaseplateWorkerPool();
    await expect(pool.generatePieces([])).rejects.toThrow('Pool not initialized');
    pool.destroy();
  });

  it('rejects generatePieces after destroy', async () => {
    const pool = new BaseplateWorkerPool();
    pool.destroy();
    await expect(pool.generatePieces([])).rejects.toThrow('Pool has been destroyed');
  });

  it('size is 0 before init is called', async () => {
    // Regression: callers must await init() before using the pool — pool.size
    // is not a reliable readiness check (bridges are created synchronously
    // inside init before WASM loads).
    const pool = new BaseplateWorkerPool();
    expect(pool.size).toBe(0);
    // init() fails without WASM in test env — just ensure cleanup is awaited
    await pool.init(2).catch(() => {});
    pool.destroy();
  });

  it('init accepts optional sharedModule parameter', () => {
    // Verify the method signature accepts a second parameter without error.
    // Actual init with a module requires WASM env — we test the signature here.
    const pool = new BaseplateWorkerPool();
    const fakeModule = {} as WebAssembly.Module;
    // init will fail in test env (no Worker), but should not throw on the signature
    void pool.init(2, fakeModule).catch(() => {});
    pool.destroy();
  });
});
