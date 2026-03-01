/**
 * Tests for Result-based storage functions.
 *
 * These tests verify the new Result<T, StorageError> returning functions
 * in the storage layer, ensuring they properly map errors to domain types.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutAsync,
  loadLayoutResult,
  deleteLayoutResult,
  migrateFromLegacyStorageResult,
  migrateLayoutToIndexedDBResult,
  migrateAllLayoutsToIndexedDBResult,
  getMigrationStatusResult,
  getLayoutStorageKey,
} from '@/core/storage';
import { createDefaultLayout } from '@/core/constants';
import { expectOk, expectErr } from '@/test/testUtils';
import { ok, err, getUserMessage, isRetryable, storageQuotaExceeded } from '@/core/result';
import type { Layout } from '@/core/types';

// Mock the backend module
vi.mock('@/core/storage/backend', () => ({
  saveAsync: vi.fn(),
  loadAsync: vi.fn(),
  deleteAsync: vi.fn(),
  saveSync: vi.fn(),
  loadSync: vi.fn(),
  deleteSync: vi.fn(),
  saveSyncGeneric: vi.fn(),
  loadSyncGeneric: vi.fn(),
  isIndexedDBAvailable: vi.fn(),
  getIndexedDBLayoutIds: vi.fn(),
  getStorageUsagePercent: vi.fn(),
}));

// Mock the localStorage backend for migration
vi.mock('@/core/storage/backends/localStorage', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getAllLayoutIds: vi.fn(),
    loadLayout: vi.fn(),
  };
});

// Mock the indexedDB backend for migration and library
vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLayout: vi.fn(),
  saveLibraryIndex: vi.fn().mockResolvedValue(undefined),
  loadLibraryIndex: vi.fn().mockResolvedValue(null),
}));

// Mock librarySync (used by saveLibrary fire-and-forget)
vi.mock('@/core/storage/librarySync', () => ({
  notifyLibraryChanged: vi.fn(),
}));

// Import the mocked modules
import * as backend from '@/core/storage/backend';
import * as localStorageBackend from '@/core/storage/backends/localStorage';
import * as indexedDBBackend from '@/core/storage/backends/indexedDB';

describe('Result-based storage functions', () => {
  let defaultLayout: Layout;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultLayout = createDefaultLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveLayoutAsync', () => {
    it('returns Ok on successful save', async () => {
      vi.mocked(backend.saveAsync).mockResolvedValue(ok(undefined));

      const result = await saveLayoutAsync('test-id', defaultLayout);

      expectOk(result);
      expect(backend.saveAsync).toHaveBeenCalledWith(getLayoutStorageKey('test-id'), defaultLayout);
    });

    it('returns Err with quota exceeded error', async () => {
      vi.mocked(backend.saveAsync).mockResolvedValue(err(storageQuotaExceeded()));

      const result = await saveLayoutAsync('test-id', defaultLayout);

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.kind).toBe('StorageError');
      // Verify it has user message
      expect(getUserMessage(error)).toBeTruthy();
    });

    it('propagates StorageError from backend', async () => {
      const storageErr = storageQuotaExceeded(undefined, undefined, new Error('Disk full'));
      vi.mocked(backend.saveAsync).mockResolvedValue(err(storageErr));

      const result = await saveLayoutAsync('test-id', defaultLayout);

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.cause).toBeInstanceOf(Error);
    });
  });

  describe('loadLayoutResult', () => {
    it('returns Ok with layout on successful load', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(defaultLayout);

      const result = await loadLayoutResult('test-id');

      const value = expectOk(result);
      expect(value.name).toBe(defaultLayout.name);
    });

    it('returns Err with not found error when layout does not exist', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('missing-id');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NOT_FOUND');
      expect(error.kind).toBe('StorageError');
      // Verify the key is preserved in the error
      if ('key' in error) {
        expect(error.key).toBe(getLayoutStorageKey('missing-id'));
      }
    });

    it('returns Err with corrupted error for invalid layout data', async () => {
      // Return data that will fail validation
      vi.mocked(backend.loadAsync).mockResolvedValue({
        invalid: 'structure',
        missing: 'required fields',
      } as unknown as Layout);

      const result = await loadLayoutResult('corrupted-id');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_CORRUPTED');
      // Verify validation errors are included
      if ('validationErrors' in error) {
        expect(error.validationErrors).toBeDefined();
      }
    });

    it('returns Err with unavailable error on backend failure', async () => {
      vi.mocked(backend.loadAsync).mockRejectedValue(
        new Error('SecurityError: Storage access denied')
      );

      const result = await loadLayoutResult('test-id');

      expect(expectErr(result).code).toBe('STORAGE_UNAVAILABLE');
    });

    it('migrates old layout format and returns Ok', async () => {
      // Layout without new fields that need migration
      const oldLayout = {
        ...defaultLayout,
        maxPrintSize: 6, // Old format used grid units
      };
      // Remove new fields to simulate old format
      delete (oldLayout as Record<string, unknown>).printBedSize;
      delete (oldLayout as Record<string, unknown>).gridUnitMm;
      delete (oldLayout as Record<string, unknown>).heightUnitMm;

      vi.mocked(backend.loadAsync).mockResolvedValue(oldLayout as Layout);

      const result = await loadLayoutResult('old-layout');

      const value = expectOk(result);
      // Migration should have added default values
      expect(value.gridUnitMm).toBe(42);
      expect(value.heightUnitMm).toBe(7);
      // And converted maxPrintSize to printBedSize
      expect(value.printBedSize).toBe(252); // 6 * 42
    });
  });

  describe('deleteLayoutResult', () => {
    it('returns Ok on successful delete', async () => {
      vi.mocked(backend.deleteAsync).mockResolvedValue(undefined);

      const result = await deleteLayoutResult('test-id');

      expectOk(result);
      expect(backend.deleteAsync).toHaveBeenCalledWith(getLayoutStorageKey('test-id'));
    });

    it('returns Ok even when layout does not exist', async () => {
      // Delete should succeed even if key doesn't exist
      vi.mocked(backend.deleteAsync).mockResolvedValue(undefined);

      const result = await deleteLayoutResult('non-existent');

      expectOk(result);
    });

    it('returns Err with unavailable error on backend failure', async () => {
      vi.mocked(backend.deleteAsync).mockRejectedValue(new Error('Storage error'));

      const result = await deleteLayoutResult('test-id');

      expect(expectErr(result).code).toBe('STORAGE_UNAVAILABLE');
    });
  });

  describe('error properties', () => {
    it('storage errors have timestamp', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('test-id');

      const error = expectErr(result);
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
      // Should be recent (within last minute)
      expect(Date.now() - error.timestamp).toBeLessThan(60000);
    });

    it('retryable errors are marked correctly', async () => {
      // Unavailable errors should be retryable
      vi.mocked(backend.loadAsync).mockRejectedValue(new Error('Temporary failure'));

      const result = await loadLayoutResult('test-id');

      const error = expectErr(result);
      expect(isRetryable(error.code)).toBe(true);
    });

    it('not found errors are not retryable', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('missing-id');

      const error = expectErr(result);
      expect(isRetryable(error.code)).toBe(false);
    });
  });

  describe('migrateFromLegacyStorageResult', () => {
    it('returns Ok with null when no legacy layout exists', () => {
      vi.mocked(backend.loadSync).mockReturnValue(null);

      const result = migrateFromLegacyStorageResult();

      const value = expectOk(result);
      expect(value).toBeNull();
    });

    it('returns Ok with migrated library on successful migration', () => {
      vi.mocked(backend.loadSync).mockReturnValue(defaultLayout);
      vi.mocked(backend.saveSync).mockReturnValue(ok(undefined));
      vi.mocked(backend.saveSyncGeneric).mockReturnValue(ok(undefined));
      vi.mocked(backend.deleteSync).mockImplementation(() => {});

      const result = migrateFromLegacyStorageResult();

      const value = expectOk(result);
      if (value) {
        expect(value.version).toBe('1.0');
        expect(value.entries.length).toBe(1);
      }
    });

    it('returns Err with corrupted error for invalid legacy layout', () => {
      vi.mocked(backend.loadSync).mockReturnValue({
        invalid: 'data',
      } as Layout);

      const result = migrateFromLegacyStorageResult();

      expect(expectErr(result).code).toBe('STORAGE_CORRUPTED');
    });

    it('returns Err with quota exceeded on storage full', () => {
      vi.mocked(backend.loadSync).mockReturnValue(defaultLayout);
      vi.mocked(backend.saveSync).mockReturnValue(err(storageQuotaExceeded()));

      const result = migrateFromLegacyStorageResult();

      expect(expectErr(result).code).toBe('STORAGE_QUOTA_EXCEEDED');
    });
  });
});

// =============================================================================
// Migration Result Functions Tests
// =============================================================================

describe('Migration Result functions', () => {
  let defaultLayout: Layout;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultLayout = createDefaultLayout();
    // Clear migration flag
    window.localStorage.removeItem('gridfinity-indexeddb-migrated');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('migrateLayoutToIndexedDBResult', () => {
    it('returns Ok on successful migration', async () => {
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(defaultLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateLayoutToIndexedDBResult('test-id');

      expectOk(result);
      expect(indexedDBBackend.saveLayout).toHaveBeenCalledWith('test-id', defaultLayout);
    });

    it('returns Err with not found when layout missing from localStorage', async () => {
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(null));

      const result = await migrateLayoutToIndexedDBResult('missing-id');

      expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
    });

    it('returns Err when IndexedDB save fails', async () => {
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(defaultLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockRejectedValue(new Error('IndexedDB error'));

      const result = await migrateLayoutToIndexedDBResult('test-id');

      expectErr(result);
    });
  });

  describe('migrateAllLayoutsToIndexedDBResult', () => {
    it('returns Ok with stats when IndexedDB available and layouts migrated', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['id1', 'id2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue([]);
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(defaultLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(2);
      expect(value.skippedCount).toBe(0);
    });

    it('returns Ok with zero counts when no layouts to migrate', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue([]);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(0);
      expect(value.skippedCount).toBe(0);
    });

    it('skips layouts already in IndexedDB', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(true);
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['id1', 'id2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['id1']); // id1 already exists
      vi.mocked(localStorageBackend.loadLayout).mockReturnValue(ok(defaultLayout));
      vi.mocked(indexedDBBackend.saveLayout).mockResolvedValue(undefined);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const value = expectOk(result);
      expect(value.migratedCount).toBe(1);
      expect(value.skippedCount).toBe(1);
    });

    it('returns Err when IndexedDB unavailable', async () => {
      vi.mocked(backend.isIndexedDBAvailable).mockResolvedValue(false);

      const result = await migrateAllLayoutsToIndexedDBResult();

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_UNAVAILABLE');
      if ('backend' in error) {
        expect(error.backend).toBe('indexedDB');
      }
    });
  });

  describe('getMigrationStatusResult', () => {
    it('returns Ok with migration status', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['id1', 'id2']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockResolvedValue(['id1', 'id2', 'id3']);
      window.localStorage.setItem('gridfinity-indexeddb-migrated', 'true');

      const result = await getMigrationStatusResult();

      const value = expectOk(result);
      expect(value.localStorageCount).toBe(2);
      expect(value.indexedDBCount).toBe(3);
      expect(value.migrationComplete).toBe(true);
    });

    it('returns Ok with zero indexedDB count when IndexedDB fails', async () => {
      vi.mocked(localStorageBackend.getAllLayoutIds).mockReturnValue(['id1']);
      vi.mocked(backend.getIndexedDBLayoutIds).mockRejectedValue(new Error('IndexedDB error'));

      const result = await getMigrationStatusResult();

      const value = expectOk(result);
      expect(value.localStorageCount).toBe(1);
      expect(value.indexedDBCount).toBe(0);
    });
  });
});
