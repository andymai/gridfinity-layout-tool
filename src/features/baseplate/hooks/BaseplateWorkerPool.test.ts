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
});
