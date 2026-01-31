/**
 * Tests for Result-based storage functions.
 *
 * These tests verify the new Result<T, StorageError> returning functions
 * in the storage layer, ensuring they properly map errors to domain types.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutResult,
  loadLayoutResult,
  deleteLayoutResult,
  saveLibraryResult,
  loadLibraryResult,
  migrateFromLegacyStorageResult,
  migrateLayoutToIndexedDBResult,
  migrateAllLayoutsToIndexedDBResult,
  getMigrationStatusResult,
  getLayoutStorageKey,
} from '@/core/storage';
import { createDefaultLayout } from '@/core/constants';
import { expectOk, expectErr } from '@/test/testUtils';
import {
  ok,
  err,
  getUserMessage,
  isRetryable,
  storageQuotaExceeded,
  storageUnavailable,
} from '@/core/result';
import type { Layout, LayoutLibrary } from '@/core/types';

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
vi.mock('@/core/storage/backends/localStorage', () => ({
  getAllLayoutIds: vi.fn(),
  loadLayout: vi.fn(),
}));

// Mock the indexedDB backend for migration
vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLayout: vi.fn(),
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

  describe('saveLayoutResult', () => {
    it('returns Ok on successful save', async () => {
      vi.mocked(backend.saveAsync).mockResolvedValue(undefined);

      const result = await saveLayoutResult('test-id', defaultLayout);

      expectOk(result);
      expect(backend.saveAsync).toHaveBeenCalledWith(getLayoutStorageKey('test-id'), defaultLayout);
    });

    it('returns Err with quota exceeded error', async () => {
      vi.mocked(backend.saveAsync).mockRejectedValue(new Error('QuotaExceededError: Storage full'));

      const result = await saveLayoutResult('test-id', defaultLayout);

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.kind).toBe('StorageError');
      // Verify it has user message
      expect(getUserMessage(error)).toBeTruthy();
    });

    it('returns Err with unavailable error for generic failures', async () => {
      vi.mocked(backend.saveAsync).mockRejectedValue(new Error('Unknown storage error'));

      const result = await saveLayoutResult('test-id', defaultLayout);

      expect(expectErr(result).code).toBe('STORAGE_UNAVAILABLE');
    });

    it('preserves original error as cause', async () => {
      const originalError = new Error('Original error');
      vi.mocked(backend.saveAsync).mockRejectedValue(originalError);

      const result = await saveLayoutResult('test-id', defaultLayout);

      const error = expectErr(result);
      expect(error.cause).toBe(originalError);
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

  describe('saveLibraryResult', () => {
    const testLibrary: LayoutLibrary = {
      version: '1.0',
      activeLayoutId: 'test-id',
      settings: {},
      entries: [],
    };

    it('returns Ok on successful save', () => {
      vi.mocked(backend.saveSyncGeneric).mockReturnValue(ok(undefined));

      const result = saveLibraryResult(testLibrary);

      expectOk(result);
    });

    it('returns Err with quota exceeded error', () => {
      vi.mocked(backend.saveSyncGeneric).mockReturnValue(err(storageQuotaExceeded()));

      const result = saveLibraryResult(testLibrary);

      expect(expectErr(result).code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('returns Err with unavailable error for generic failures', () => {
      vi.mocked(backend.saveSyncGeneric).mockReturnValue(err(storageUnavailable('localStorage')));

      const result = saveLibraryResult(testLibrary);

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_UNAVAILABLE');
      // For localStorage errors, backend should be localStorage
      if ('backend' in error) {
        expect(error.backend).toBe('localStorage');
      }
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

  describe('loadLibraryResult', () => {
    it('returns Ok with library on successful load', () => {
      const testLibrary: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'test-id',
        settings: {},
        entries: [
          {
            id: 'test-id',
            name: 'Test Layout',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: {
              drawerWidth: 10,
              drawerDepth: 8,
              drawerHeight: 12,
              binCount: 0,
              layerCount: 1,
            },
          },
        ],
      };
      vi.mocked(backend.loadSyncGeneric).mockReturnValue(testLibrary);
      vi.mocked(backend.loadSync).mockReturnValue({}); // Layout exists

      const result = loadLibraryResult();

      const value = expectOk(result);
      expect(value.version).toBe('1.0');
      expect(value.activeLayoutId).toBe('test-id');
    });

    it('returns Err with not found error when library does not exist', () => {
      vi.mocked(backend.loadSyncGeneric).mockReturnValue(null);

      const result = loadLibraryResult();

      expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
    });

    it('returns Err with corrupted error for invalid library structure', () => {
      vi.mocked(backend.loadSyncGeneric).mockReturnValue({
        invalid: 'structure',
      });

      const result = loadLibraryResult();

      expect(expectErr(result).code).toBe('STORAGE_CORRUPTED');
    });

    it('returns Err with unavailable error on exception', () => {
      vi.mocked(backend.loadSyncGeneric).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = loadLibraryResult();

      expect(expectErr(result).code).toBe('STORAGE_UNAVAILABLE');
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
