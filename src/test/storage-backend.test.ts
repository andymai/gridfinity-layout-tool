/**
 * Tests for the storage backend layer.
 * Tests the dual-write strategy and backend abstraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as backend from '@/core/storage/backend';
import * as localStorage from '@/core/storage/backends/localStorage';
import * as indexedDB from '@/core/storage/backends/indexedDB';
import type { Layout } from '@/core/types';

// Mock IndexedDB module
vi.mock('../core/storage/backends/indexedDB', () => ({
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
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() { return Object.keys(store).length; },
    get _store() { return store; },
    set _store(value: Record<string, string>) { store = value; },
  };
};

let localStorageMock: ReturnType<typeof createLocalStorageMock>;

function createTestLayout(overrides?: Partial<Layout>): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'cat1', name: 'Default', color: '#3b82f6' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [],
    ...overrides,
  };
}

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

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(layout)
      );
    });

    it('throws on storage full error', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const layout = createTestLayout();
      expect(() => backend.saveSync('test-key', layout)).toThrow('Storage full');
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

    it('throws on invalid JSON', () => {
      localStorageMock._store['test-key'] = 'not valid json{{{';

      expect(() => backend.loadSync('test-key')).toThrow();
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
    it('saves to both IndexedDB and localStorage', async () => {
      const layout = createTestLayout();
      vi.mocked(indexedDB.saveLayout).mockResolvedValueOnce(undefined);

      await backend.saveAsync('test-key', layout);

      expect(indexedDB.saveLayout).toHaveBeenCalledWith('test-key', layout);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(layout)
      );
    });

    it('continues if localStorage backup fails', async () => {
      const layout = createTestLayout();
      vi.mocked(indexedDB.saveLayout).mockResolvedValueOnce(undefined);
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      await expect(backend.saveAsync('test-key', layout)).resolves.toBeUndefined();
      expect(indexedDB.saveLayout).toHaveBeenCalled();
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
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(layout)
      );
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

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ foo: 'bar' })
      );
    });

    it('throws on storage full', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => localStorage.saveToLocalStorage('key', {})).toThrow(
        'Storage full'
      );
    });
  });

  describe('loadFromLocalStorage', () => {
    it('returns parsed JSON', () => {
      localStorageMock._store['key'] = JSON.stringify({ foo: 'bar' });

      const result = localStorage.loadFromLocalStorage('key');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns null for missing key', () => {
      const result = localStorage.loadFromLocalStorage('missing');

      expect(result).toBeNull();
    });

    it('throws on invalid JSON', () => {
      localStorageMock._store['key'] = 'not json';

      expect(() => localStorage.loadFromLocalStorage('key')).toThrow();
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
        get: () => { throw new Error('Access denied'); },
      });

      const usage = localStorage.getStorageUsagePercent();

      expect(usage).toBe(0);
    });
  });
});
