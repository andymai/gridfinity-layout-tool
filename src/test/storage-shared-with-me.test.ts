import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSharedWithMe,
  loadSharedWithMe,
  clearSharedWithMe,
} from '@/core/storage/SharedWithMeService';
import type { SharedWithMeEntry } from '@/core/types';

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

      saveSharedWithMe(entries);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe('1.0');
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0].id).toBe('1');
      expect(parsed.entries[1].id).toBe('2');
    });

    it('saves empty array', () => {
      saveSharedWithMe([]);

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

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => saveSharedWithMe([createTestEntry('1')])).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save shared-with-me entries:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('loadSharedWithMe', () => {
    it('loads entries from localStorage', () => {
      const entries = [createTestEntry('1'), createTestEntry('2')];
      saveSharedWithMe(entries);

      const loaded = loadSharedWithMe();

      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('1');
      expect(loaded[1].id).toBe('2');
    });

    it('returns empty array when no data exists', () => {
      const loaded = loadSharedWithMe();
      expect(loaded).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, 'not valid json');

      const loaded = loadSharedWithMe();

      expect(loaded).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns empty array for missing entries field', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '1.0' }));

      const loaded = loadSharedWithMe();
      expect(loaded).toEqual([]);
    });

    it('returns empty array when entries is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '1.0', entries: 'not array' }));

      const loaded = loadSharedWithMe();
      expect(loaded).toEqual([]);
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

      const loaded = loadSharedWithMe();

      expect(loaded[0]).toEqual(entry);
    });
  });

  describe('clearSharedWithMe', () => {
    it('removes entries from localStorage', () => {
      saveSharedWithMe([createTestEntry('1')]);
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      clearSharedWithMe();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('handles non-existent key gracefully', () => {
      // Should not throw when key doesn't exist
      expect(() => clearSharedWithMe()).not.toThrow();
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => clearSharedWithMe()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear shared-with-me entries:',
        expect.any(Error)
      );

      removeItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
