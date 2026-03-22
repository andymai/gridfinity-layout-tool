// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { expectOk, expectErr } from '@/test/testUtils';
import { ok } from '@/core/result';

// Mock all dependencies before importing the module under test
vi.mock('@/core/storage/backend', () => ({
  isIndexedDBAvailable: vi.fn(),
  getIndexedDBLayoutIds: vi.fn(),
}));

vi.mock('@/core/storage/backends/localStorage', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getAllLayoutIds: vi.fn(),
    loadLayout: vi.fn(),
  };
});

vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLayout: vi.fn(),
}));

// Import mocked modules
import * as backend from '@/core/storage/backend';
import * as localStorageBackend from '@/core/storage/backends/localStorage';
import * as indexedDBBackend from '@/core/storage/backends/indexedDB';

// Import the module under test
import {
  isMigrationNeeded,
  migrateLayoutToIndexedDB,
  migrateAllLayoutsToIndexedDB,
  getMigrationStatus,
  clearMigrationFlag,
  migrateLayoutToIndexedDBResult,
  migrateAllLayoutsToIndexedDBResult,
  getMigrationStatusResult,
} from '@/core/storage/migration';

import type { Layout } from '@/core/types';

// Test fixtures
function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: 1,
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
    bins: [],
    categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    ...overrides,
  };
}

describe('migration.ts', () => {
  const MIGRATION_FLAG_KEY = 'gridfinity-indexeddb-migrated';

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear migration flag
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  });

  describe('isMigrationNeeded', () => {
    it('returns false if migration flag is already set', async () => {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

      const result = await isMigrationNeeded();

      expect(result).toBe(false);
      expect(backend.isIndexedDBAvailable).not.toHaveBeenCalled();
    });

    it('returns false if IndexedDB is not available', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(false);

      const result = await isMigrationNeeded();

      expect(result).toBe(false);
    });

    it('returns false if no layouts exist in localStorage', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);

      const result = await isMigrationNeeded();

      expect(result).toBe(false);
    });

    it('returns true if IndexedDB available and layouts exist in localStorage', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);

      const result = await isMigrationNeeded();

      expect(result).toBe(true);
    });
  });

  describe('migrateLayoutToIndexedDB', () => {
    it('returns error if layout not found in localStorage', async () => {
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(null));

      const result = await migrateLayoutToIndexedDB('missing-layout');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in localStorage');
    });

    it('successfully migrates layout to IndexedDB', async () => {
      const testLayout = createTestLayout();
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(testLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateLayoutToIndexedDB('layout-123');

      expect(result.success).toBe(true);
      expect(indexedDBBackend.saveLayout).toHaveBeenCalledWith('layout-123', testLayout);
    });

    it('returns error if IndexedDB save fails', async () => {
      const testLayout = createTestLayout();
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(testLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockRejectedValue(new Error('IndexedDB write failed'));

      const result = await migrateLayoutToIndexedDB('layout-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to migrate');
      expect(result.error).toContain('IndexedDB write failed');
    });
  });

  describe('migrateAllLayoutsToIndexedDB', () => {
    it('returns error if IndexedDB is not available', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(false);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('IndexedDB is not available');
    });

    it('sets migration flag and returns success for empty localStorage', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('true');
    });

    it('skips layouts that already exist in IndexedDB', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['layout-1']);
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(createTestLayout()));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.skippedCount).toBe(1);
      expect(result.migratedCount).toBe(1);
    });

    it('migrates all layouts and sets flag', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([
        'layout-1',
        'layout-2',
        'layout-3',
      ]);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(createTestLayout()));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(3);
      expect(result.skippedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('true');
    });

    it('collects errors but continues migration', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);
      vi.mocked(localStorageBackend.loadLayout)
        .mockReturnValueOnce(ok(null)) // layout-1 fails (not found)
        .mockReturnValueOnce(ok(createTestLayout())); // layout-2 succeeds
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.migratedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('layout-1');
    });

    it('sets success to false when any layout fails to migrate', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);
      vi.mocked(localStorageBackend.loadLayout)
        .mockReturnValueOnce(ok(null)) // layout-1 fails (not found)
        .mockReturnValueOnce(ok(createTestLayout())); // layout-2 succeeds
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('getMigrationStatus', () => {
    it('returns counts from both storage backends', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['ls-1', 'ls-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['idb-1', 'idb-2', 'idb-3']);

      const status = await getMigrationStatus();

      expect(status.localStorageCount).toBe(2);
      expect(status.indexedDBCount).toBe(3);
      expect(status.migrationComplete).toBe(false);
    });

    it('returns migrationComplete true when flag is set', async () => {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);

      const status = await getMigrationStatus();

      expect(status.migrationComplete).toBe(true);
    });

    it('handles IndexedDB errors gracefully', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['ls-1']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockRejectedValue(
        new Error('IndexedDB unavailable')
      );

      const status = await getMigrationStatus();

      expect(status.localStorageCount).toBe(1);
      expect(status.indexedDBCount).toBe(0);
    });
  });

  describe('clearMigrationFlag', () => {
    it('removes the migration flag from localStorage', () => {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

      clearMigrationFlag();

      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBeNull();
    });
  });

  // Result-based API tests
  describe('migrateLayoutToIndexedDBResult', () => {
    it('returns Ok on successful migration', async () => {
      const testLayout = createTestLayout();
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(testLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateLayoutToIndexedDBResult('layout-123');

      expectOk(result);
    });

    it('returns Err with NOT_FOUND when layout missing', async () => {
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(null));

      const result = await migrateLayoutToIndexedDBResult('missing');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NOT_FOUND');
    });

    it('returns Err with NETWORK_ERROR on IndexedDB failure', async () => {
      const testLayout = createTestLayout();
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(testLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockRejectedValue(new Error('Write failed'));

      const result = await migrateLayoutToIndexedDBResult('layout-123');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NETWORK_ERROR');
    });
  });

  describe('migrateAllLayoutsToIndexedDBResult', () => {
    it('returns Err when IndexedDB unavailable', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(false);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_UNAVAILABLE');
    });

    it('returns Ok with stats on successful migration', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['layout-1']);
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(createTestLayout()));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(1);
      expect(value.skippedCount).toBe(1);
    });

    it('returns Ok with zero counts for empty localStorage', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(0);
      expect(value.skippedCount).toBe(0);
    });

    it('silently skips failed individual migrations', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['layout-1', 'layout-2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);
      vi.mocked(localStorageBackend.loadLayout)
        .mockReturnValueOnce(ok(null)) // layout-1 fails (not found)
        .mockReturnValueOnce(ok(createTestLayout())); // layout-2 succeeds
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(1);
      // Note: failed migrations don't increment skippedCount
    });
  });

  describe('getMigrationStatusResult', () => {
    it('returns Ok with status', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['ls-1']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['idb-1', 'idb-2']);
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

      const result = await getMigrationStatusResult();

      const value = expectOk(result);
      expect(value.localStorageCount).toBe(1);
      expect(value.indexedDBCount).toBe(2);
      expect(value.migrationComplete).toBe(true);
    });

    it('returns Ok with zero indexedDBCount when IndexedDB fails', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['ls-1']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockRejectedValue(new Error('Unavailable'));

      const result = await getMigrationStatusResult();

      const value = expectOk(result);
      expect(value.localStorageCount).toBe(1);
      expect(value.indexedDBCount).toBe(0);
    });
  });
});
