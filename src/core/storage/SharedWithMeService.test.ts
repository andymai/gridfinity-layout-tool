import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSharedWithMe,
  loadSharedWithMe,
  clearSharedWithMe,
} from '@/core/storage/SharedWithMeService';
import type { SharedWithMeEntry } from '@/core/types';
import { isOk, isErr } from '@/core/result';

describe('SharedWithMeService', () => {
  const STORAGE_KEY = 'gridfinity-shared-with-me-v1';

  // Create test entries
  const createTestEntry = (id: string): SharedWithMeEntry => ({
    id,
    sourceShareId: `share${id}1234`,
    name: `Test Layout ${id}`,
    permission: 'view',
    addedAt: Date.now() - 10000,
    lastAccessedAt: Date.now(),
    status: 'available',
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveSharedWithMe', () => {
    it('saves entries to localStorage', () => {
      const entries = [createTestEntry('1'), createTestEntry('2')];

      const result = saveSharedWithMe(entries);
      expect(isOk(result)).toBe(true);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe('1.0');
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0].id).toBe('1');
      expect(parsed.entries[1].id).toBe('2');
    });

    it('saves empty array', () => {
      const result = saveSharedWithMe([]);
      expect(isOk(result)).toBe(true);

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.entries).toHaveLength(0);
    });

    it('overwrites existing entries', () => {
      saveSharedWithMe([createTestEntry('1')]);
      saveSharedWithMe([createTestEntry('2'), createTestEntry('3')]);

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0].id).toBe('2');
    });

    it('returns Err on localStorage failure', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = saveSharedWithMe([createTestEntry('1')]);
      expect(isErr(result)).toBe(true);

      setItemSpy.mockRestore();
    });
  });

  describe('loadSharedWithMe', () => {
    it('loads entries from localStorage', () => {
      const entries = [createTestEntry('1'), createTestEntry('2')];
      saveSharedWithMe(entries);

      const result = loadSharedWithMe();
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe('1');
      expect(result.value[1].id).toBe('2');
    });

    it('returns Ok with empty array when no data exists', () => {
      const result = loadSharedWithMe();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('returns Err for invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const result = loadSharedWithMe();
      expect(isErr(result)).toBe(true);
    });

    it('returns Err for missing entries field', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '1.0' }));

      const result = loadSharedWithMe();
      expect(isErr(result)).toBe(true);
    });

    it('returns Err when entries is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '1.0', entries: 'not array' }));

      const result = loadSharedWithMe();
      expect(isErr(result)).toBe(true);
    });

    it('preserves all entry properties', () => {
      const entry: SharedWithMeEntry = {
        id: 'test-id',
        sourceShareId: 'abc123def456',
        name: 'My Shared Layout',
        authorName: 'John Doe',
        permission: 'edit',
        addedAt: 1000,
        lastAccessedAt: 2000,
        status: 'available',
      };
      saveSharedWithMe([entry]);

      const result = loadSharedWithMe();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value[0]).toEqual(entry);
      }
    });
  });

  describe('clearSharedWithMe', () => {
    it('removes entries from localStorage', () => {
      saveSharedWithMe([createTestEntry('1')]);
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      const result = clearSharedWithMe();
      expect(isOk(result)).toBe(true);

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('handles non-existent key gracefully', () => {
      const result = clearSharedWithMe();
      expect(isOk(result)).toBe(true);
    });

    it('returns Err on localStorage failure', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = clearSharedWithMe();
      expect(isErr(result)).toBe(true);

      removeItemSpy.mockRestore();
    });
  });
});
