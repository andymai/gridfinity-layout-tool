import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSharedWithMe,
  loadSharedWithMe,
  clearSharedWithMe,
  saveSharedWithMeResult,
  loadSharedWithMeResult,
  clearSharedWithMeResult,
} from '@/core/storage/SharedWithMeService';
import { isOk, isErr } from '@/core/result';
import type { SharedWithMeEntry } from '@/core/types';
import { createIsolatedLocalStorageMock } from '@/test/testUtils';

const STORAGE_KEY = 'gridfinity-shared-with-me-v1';

describe('SharedWithMeService', () => {
  let localStorageMock: ReturnType<typeof createIsolatedLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createIsolatedLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock.mock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorageMock.cleanup();
    vi.restoreAllMocks();
  });

  const mockEntries: SharedWithMeEntry[] = [
    {
      id: 'local-1',
      sourceShareId: 'share-1',
      name: 'Shared Layout 1',
      permission: 'view',
      addedAt: 1700000000000,
      lastAccessedAt: 1700000100000,
      status: 'available',
    },
    {
      id: 'local-2',
      sourceShareId: 'share-2',
      name: 'Shared Layout 2',
      permission: 'edit',
      addedAt: 1700000200000,
      lastAccessedAt: 1700000300000,
      status: 'available',
    },
  ];

  describe('saveSharedWithMe', () => {
    it('saves entries to localStorage', () => {
      saveSharedWithMe(mockEntries);

      const stored = JSON.parse(localStorageMock.mock._store[STORAGE_KEY]);
      expect(stored.version).toBe('1.0');
      expect(stored.entries).toEqual(mockEntries);
    });

    it('handles empty array', () => {
      saveSharedWithMe([]);

      const stored = JSON.parse(localStorageMock.mock._store[STORAGE_KEY]);
      expect(stored.entries).toEqual([]);
    });

    it('handles localStorage errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.mock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveSharedWithMe(mockEntries)).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to save shared-with-me entries:',
        expect.any(Error)
      );
    });
  });

  describe('loadSharedWithMe', () => {
    it('returns entries from localStorage', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: mockEntries,
      });

      const result = loadSharedWithMe();
      expect(result).toEqual(mockEntries);
    });

    it('returns empty array when key does not exist', () => {
      const result = loadSharedWithMe();
      expect(result).toEqual([]);
    });

    it('returns empty array for invalid data structure', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        // missing entries field
      });

      const result = loadSharedWithMe();
      expect(result).toEqual([]);
    });

    it('returns empty array when entries is not an array', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: 'not-an-array',
      });

      const result = loadSharedWithMe();
      expect(result).toEqual([]);
    });

    it('handles JSON parse errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.mock._store[STORAGE_KEY] = 'invalid json {{{';

      const result = loadSharedWithMe();
      expect(result).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load shared-with-me entries:',
        expect.any(Error)
      );
    });
  });

  describe('clearSharedWithMe', () => {
    it('removes key from localStorage', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: mockEntries,
      });

      clearSharedWithMe();
      expect(localStorageMock.mock._store[STORAGE_KEY]).toBeUndefined();
    });

    it('handles localStorage errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.mock.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      expect(() => clearSharedWithMe()).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to clear shared-with-me entries:',
        expect.any(Error)
      );
    });
  });

  describe('saveSharedWithMeResult', () => {
    it('returns Ok on success', () => {
      const result = saveSharedWithMeResult(mockEntries);
      expect(isOk(result)).toBe(true);

      const stored = JSON.parse(localStorageMock.mock._store[STORAGE_KEY]);
      expect(stored.entries).toEqual(mockEntries);
    });

    it('returns Err with StorageError on failure', () => {
      localStorageMock.mock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const result = saveSharedWithMeResult(mockEntries);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('StorageError');
      }
    });
  });

  describe('loadSharedWithMeResult', () => {
    it('returns Ok with entries on success', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: mockEntries,
      });

      const result = loadSharedWithMeResult();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockEntries);
      }
    });

    it('returns Ok with empty array when key missing', () => {
      const result = loadSharedWithMeResult();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('returns Err for invalid structure', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: 'not-an-array',
      });

      const result = loadSharedWithMeResult();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('StorageError');
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
      }
    });

    it('returns Err for malformed JSON', () => {
      localStorageMock.mock._store[STORAGE_KEY] = 'not json';

      const result = loadSharedWithMeResult();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('StorageError');
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
      }
    });
  });

  describe('clearSharedWithMeResult', () => {
    it('returns Ok on success', () => {
      localStorageMock.mock._store[STORAGE_KEY] = 'data';
      const result = clearSharedWithMeResult();
      expect(isOk(result)).toBe(true);
      expect(localStorageMock.mock._store[STORAGE_KEY]).toBeUndefined();
    });

    it('returns Err on localStorage failure', () => {
      localStorageMock.mock.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const result = clearSharedWithMeResult();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('StorageError');
      }
    });
  });
});
