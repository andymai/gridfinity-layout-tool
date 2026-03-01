import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getCachedModule, cacheModule } from './wasmModuleCache';

// Minimal valid WASM module (empty module: magic + version + no sections)
const MINIMAL_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

async function createTestModule(): Promise<WebAssembly.Module> {
  return WebAssembly.compile(MINIMAL_WASM);
}

beforeEach(async () => {
  // Clear all IDB databases between tests by deleting the cache DB
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('gridfinity-wasm-cache');
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () =>
      reject(new Error(request.error?.message ?? 'Failed to delete IndexedDB'));
  });
});

describe('wasmModuleCache', () => {
  describe('getCachedModule', () => {
    it('returns null on cache miss', async () => {
      const result = await getCachedModule('/wasm/test.wasm');
      expect(result).toBeNull();
    });

    it('returns cached module after cacheModule', async () => {
      const module = await createTestModule();
      await cacheModule('/wasm/test.wasm', module);

      const result = await getCachedModule('/wasm/test.wasm');
      expect(result).toBeInstanceOf(WebAssembly.Module);
    });

    it('returns null for different URL', async () => {
      const module = await createTestModule();
      await cacheModule('/wasm/v1.wasm', module);

      const result = await getCachedModule('/wasm/v2.wasm');
      expect(result).toBeNull();
    });
  });

  describe('cacheModule', () => {
    it('overwrites existing entry for same URL', async () => {
      const module1 = await createTestModule();
      const module2 = await createTestModule();

      await cacheModule('/wasm/test.wasm', module1);
      await cacheModule('/wasm/test.wasm', module2);

      const result = await getCachedModule('/wasm/test.wasm');
      expect(result).toBeInstanceOf(WebAssembly.Module);
    });

    it('deletes stale entries with different URLs', async () => {
      const moduleOld = await createTestModule();
      const moduleNew = await createTestModule();

      await cacheModule('/wasm/old-hash.wasm', moduleOld);
      await cacheModule('/wasm/new-hash.wasm', moduleNew);

      // Old entry should be gone
      const oldResult = await getCachedModule('/wasm/old-hash.wasm');
      expect(oldResult).toBeNull();

      // New entry should exist
      const newResult = await getCachedModule('/wasm/new-hash.wasm');
      expect(newResult).toBeInstanceOf(WebAssembly.Module);
    });
  });
});
