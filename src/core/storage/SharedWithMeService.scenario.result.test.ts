import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSharedWithMe,
  loadSharedWithMe,
  clearSharedWithMe,
} from '@/core/storage/SharedWithMeService';
import type { SharedWithMeEntry } from '@/core/types';
import { createIsolatedLocalStorageMock, expectOk, expectErr } from '@/test/testUtils';

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
    it('returns Ok and saves entries to localStorage', () => {
      const result = saveSharedWithMe(mockEntries);
      expectOk(result);

      const stored = JSON.parse(localStorageMock.mock._store[STORAGE_KEY]);
      expect(stored.version).toBe('1.0');
      expect(stored.entries).toEqual(mockEntries);
    });

    it('handles empty array', () => {
      const result = saveSharedWithMe([]);
      expectOk(result);

      const stored = JSON.parse(localStorageMock.mock._store[STORAGE_KEY]);
      expect(stored.entries).toEqual([]);
    });

    it('returns Err with StorageError on localStorage failure', () => {
      localStorageMock.mock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const result = saveSharedWithMe(mockEntries);
      const error = expectErr(result);
      expect(error.kind).toBe('StorageError');
    });
  });

  describe('loadSharedWithMe', () => {
    it('returns Ok with entries from localStorage', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: mockEntries,
      });

      const result = loadSharedWithMe();
      const value = expectOk(result);
      expect(value).toEqual(mockEntries);
    });

    it('returns Ok with empty array when key does not exist', () => {
      const result = loadSharedWithMe();
      const value = expectOk(result);
      expect(value).toEqual([]);
    });

    it('returns Err for invalid data structure', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        // missing entries field
      });

      const result = loadSharedWithMe();
      const error = expectErr(result);
      expect(error.kind).toBe('StorageError');
      expect(error.code).toBe('STORAGE_CORRUPTED');
    });

    it('returns Err when entries is not an array', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: 'not-an-array',
      });

      const result = loadSharedWithMe();
      const error = expectErr(result);
      expect(error.kind).toBe('StorageError');
      expect(error.code).toBe('STORAGE_CORRUPTED');
    });

    it('returns Err for malformed JSON', () => {
      localStorageMock.mock._store[STORAGE_KEY] = 'invalid json {{{';

      const result = loadSharedWithMe();
      const error = expectErr(result);
      expect(error.kind).toBe('StorageError');
      expect(error.code).toBe('STORAGE_CORRUPTED');
    });
  });

  describe('clearSharedWithMe', () => {
    it('returns Ok and removes key from localStorage', () => {
      localStorageMock.mock._store[STORAGE_KEY] = JSON.stringify({
        version: '1.0',
        entries: mockEntries,
      });

      const result = clearSharedWithMe();
      expectOk(result);
      expect(localStorageMock.mock._store[STORAGE_KEY]).toBeUndefined();
    });

    it('returns Err on localStorage failure', () => {
      localStorageMock.mock.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const result = clearSharedWithMe();
      const error = expectErr(result);
      expect(error.kind).toBe('StorageError');
    });
  });
});
