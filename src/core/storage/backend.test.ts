/**
 * Tests for the storage backend layer.
 * Tests the IndexedDB-primary strategy and backend abstraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as backend from '@/core/storage/backend';
import * as localStorage from '@/core/storage/backends/localStorage';
import * as indexedDB from '@/core/storage/backends/indexedDB';
import { createTestLayout } from '@/test/testUtils';
import { isOk, isErr } from '@/core/result';

// Mock IndexedDB module
vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLayout: vi.fn(),
  loadLayout: vi.fn(),
  deleteLayout: vi.fn(),
  isIndexedDBAvailable: vi.fn(() => Promise.resolve(true)),
}));

// Create localStorage mock
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    get _store() {
      return store;
    },
    set _store(value: Record<string, string>) {
      store = value;
    },
  };
};

let localStorageMock: ReturnType<typeof createLocalStorageMock>;

describe('storage backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
    backend.resetStorageBackendCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveSync', () => {
    it('saves layout to localStorage', () => {
      const layout = createTestLayout();
      backend.saveSync('test-key', layout);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(layout));
    });

    it('returns Err on storage full error', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const layout = createTestLayout();
      const result = backend.saveSync('test-key', layout);
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
        })
      );
    });
  });

  describe('loadSync', () => {
    it('loads layout from localStorage', () => {
      const layout = createTestLayout();
      localStorageMock._store['test-key'] = JSON.stringify(layout);

      const result = backend.loadSync('test-key');
      expect(result).toEqual(layout);
    });

    it('returns null for non-existent key', () => {
      const result = backend.loadSync('non-existent');
      expect(result).toBeNull();
    });

    it('returns null on invalid JSON', () => {
      localStorageMock._store['test-key'] = 'not valid json{{{';

      const result = backend.loadSync('test-key');
      expect(result).toBeNull();
    });
  });

  describe('deleteSync', () => {
    it('removes key from localStorage', () => {
      localStorageMock._store['test-key'] = '{}';
      backend.deleteSync('test-key');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('saveAsync', () => {
    it('saves only to IndexedDB when available (no localStorage backup)', async () => {
      const layout = createTestLayout();
      vi.mocked(indexedDB.saveLayout).mockResolvedValueOnce(undefined);

      await backend.saveAsync('test-key', layout);

      expect(indexedDB.saveLayout).toHaveBeenCalledWith('test-key', layout);
      // Should NOT write to localStorage (no dual-write)
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('loadAsync', () => {
    it('loads from IndexedDB when available', async () => {
      const layout = createTestLayout();
      vi.mocked(indexedDB.loadLayout).mockResolvedValueOnce(layout);

      const result = await backend.loadAsync('test-key');

      expect(result).toEqual(layout);
      expect(indexedDB.loadLayout).toHaveBeenCalledWith('test-key');
    });

    it('falls back to localStorage when IndexedDB returns null', async () => {
      const layout = createTestLayout();
      vi.mocked(indexedDB.loadLayout).mockResolvedValueOnce(null);
      localStorageMock._store['test-key'] = JSON.stringify(layout);

      const result = await backend.loadAsync('test-key');

      expect(result).toEqual(layout);
    });

    it('returns null when both sources are empty', async () => {
      vi.mocked(indexedDB.loadLayout).mockResolvedValueOnce(null);

      const result = await backend.loadAsync('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteAsync', () => {
    it('deletes from both IndexedDB and localStorage', async () => {
      vi.mocked(indexedDB.deleteLayout).mockResolvedValueOnce(undefined);

      await backend.deleteAsync('test-key');

      expect(indexedDB.deleteLayout).toHaveBeenCalledWith('test-key');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('getStorageUsagePercent', () => {
    it('calculates storage usage', () => {
      // Add some data to localStorage
      localStorageMock._store['key1'] = 'value1';
      localStorageMock._store['key2'] = 'value2';

      const usage = backend.getStorageUsagePercent();

      expect(typeof usage).toBe('number');
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThanOrEqual(100);
    });
  });

  describe('getStorageBackend', () => {
    it('returns indexeddb when available', async () => {
      vi.mocked(indexedDB.isIndexedDBAvailable).mockResolvedValueOnce(true);

      const result = await backend.getStorageBackend();

      expect(result).toBe('indexeddb');
    });

    it('returns localstorage when IndexedDB unavailable', async () => {
      backend.resetStorageBackendCache();
      vi.mocked(indexedDB.isIndexedDBAvailable).mockResolvedValueOnce(false);

      const result = await backend.getStorageBackend();

      expect(result).toBe('localstorage');
    });

    it('caches the result', async () => {
      vi.mocked(indexedDB.isIndexedDBAvailable).mockResolvedValue(true);

      await backend.getStorageBackend();
      await backend.getStorageBackend();

      // Should only be called once due to caching
      expect(indexedDB.isIndexedDBAvailable).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage-only fallback paths', () => {
    beforeEach(() => {
      backend.resetStorageBackendCache();
      vi.mocked(indexedDB.isIndexedDBAvailable).mockResolvedValue(false);
    });

    it('saveAsync uses localStorage when IndexedDB unavailable', async () => {
      const layout = createTestLayout();

      await backend.saveAsync('test-key', layout);

      expect(indexedDB.saveLayout).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(layout));
    });

    it('loadAsync uses localStorage when IndexedDB unavailable', async () => {
      const layout = createTestLayout();
      localStorageMock._store['test-key'] = JSON.stringify(layout);

      const result = await backend.loadAsync('test-key');

      expect(indexedDB.loadLayout).not.toHaveBeenCalled();
      expect(result).toEqual(layout);
    });

    it('deleteAsync skips IndexedDB when unavailable', async () => {
      await backend.deleteAsync('test-key');

      expect(indexedDB.deleteLayout).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });
  });
});

describe('localStorage backend', () => {
  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveToLocalStorage', () => {
    it('saves JSON data', () => {
      localStorage.saveToLocalStorage('key', { foo: 'bar' });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('key', JSON.stringify({ foo: 'bar' }));
    });

    it('returns Err on storage full', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const result = localStorage.saveToLocalStorage('key', {});
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
        })
      );
    });
  });

  describe('loadFromLocalStorage', () => {
    it('returns parsed JSON', () => {
      localStorageMock._store['key'] = JSON.stringify({ foo: 'bar' });

      const result = localStorage.loadFromLocalStorage('key');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ foo: 'bar' });
      }
    });

    it('returns null for missing key', () => {
      const result = localStorage.loadFromLocalStorage('missing');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it('returns Err on invalid JSON', () => {
      localStorageMock._store['key'] = 'not json';

      const result = localStorage.loadFromLocalStorage('key');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('deleteFromLocalStorage', () => {
    it('removes the key', () => {
      localStorage.deleteFromLocalStorage('key');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('key');
    });
  });

  describe('existsInLocalStorage', () => {
    it('returns true for existing key', () => {
      localStorageMock._store['key'] = 'value';

      expect(localStorage.existsInLocalStorage('key')).toBe(true);
    });

    it('returns false for missing key', () => {
      expect(localStorage.existsInLocalStorage('missing')).toBe(false);
    });
  });

  describe('getAllKeysWithPrefix', () => {
    it('returns keys matching prefix', () => {
      localStorageMock._store['gridfinity-layout-1'] = '{}';
      localStorageMock._store['gridfinity-layout-2'] = '{}';
      localStorageMock._store['other-key'] = '{}';

      const keys = localStorage.getAllKeysWithPrefix('gridfinity-layout-');

      expect(keys).toHaveLength(2);
      expect(keys).toContain('gridfinity-layout-1');
      expect(keys).toContain('gridfinity-layout-2');
    });
  });

  describe('getAllLayoutIds', () => {
    it('extracts IDs from keys', () => {
      localStorageMock._store['prefix-id1'] = '{}';
      localStorageMock._store['prefix-id2'] = '{}';

      const ids = localStorage.getAllLayoutIds('prefix-');

      expect(ids).toHaveLength(2);
      expect(ids).toContain('id1');
      expect(ids).toContain('id2');
    });
  });

  describe('getStorageUsagePercent', () => {
    it('returns a percentage', () => {
      localStorageMock._store['key'] = 'a'.repeat(1000);

      const usage = localStorage.getStorageUsagePercent();

      expect(typeof usage).toBe('number');
      expect(usage).toBeGreaterThanOrEqual(0);
    });

    it('handles errors gracefully', () => {
      // Override length to throw
      Object.defineProperty(localStorageMock, 'length', {
        get: () => {
          throw new Error('Access denied');
        },
      });

      const usage = localStorage.getStorageUsagePercent();

      expect(usage).toBe(0);
    });
  });
});
