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
  getLayoutStorageKey,
} from '../storage';
import { createDefaultLayout } from '../constants';
import {
  isOk,
  isErr,
  getUserMessage,
  isRetryable,
} from '../result';
import type { Layout, LayoutLibrary } from '../types';

// Mock the backend module
vi.mock('../storage/backend', () => ({
  saveAsync: vi.fn(),
  loadAsync: vi.fn(),
  deleteAsync: vi.fn(),
  saveSyncGeneric: vi.fn(),
  loadSyncGeneric: vi.fn(),
}));

// Import the mocked backend
import * as backend from '../storage/backend';

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

      expect(isOk(result)).toBe(true);
      expect(backend.saveAsync).toHaveBeenCalledWith(
        getLayoutStorageKey('test-id'),
        defaultLayout
      );
    });

    it('returns Err with quota exceeded error', async () => {
      vi.mocked(backend.saveAsync).mockRejectedValue(
        new Error('QuotaExceededError: Storage full')
      );

      const result = await saveLayoutResult('test-id', defaultLayout);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
        expect(result.error.kind).toBe('StorageError');
        // Verify it has user message
        expect(getUserMessage(result.error)).toBeTruthy();
      }
    });

    it('returns Err with unavailable error for generic failures', async () => {
      vi.mocked(backend.saveAsync).mockRejectedValue(
        new Error('Unknown storage error')
      );

      const result = await saveLayoutResult('test-id', defaultLayout);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
      }
    });

    it('preserves original error as cause', async () => {
      const originalError = new Error('Original error');
      vi.mocked(backend.saveAsync).mockRejectedValue(originalError);

      const result = await saveLayoutResult('test-id', defaultLayout);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.cause).toBe(originalError);
      }
    });
  });

  describe('loadLayoutResult', () => {
    it('returns Ok with layout on successful load', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(defaultLayout);

      const result = await loadLayoutResult('test-id');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe(defaultLayout.name);
      }
    });

    it('returns Err with not found error when layout does not exist', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('missing-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_NOT_FOUND');
        expect(result.error.kind).toBe('StorageError');
        // Verify the key is preserved in the error
        if ('key' in result.error) {
          expect(result.error.key).toBe(getLayoutStorageKey('missing-id'));
        }
      }
    });

    it('returns Err with corrupted error for invalid layout data', async () => {
      // Return data that will fail validation
      vi.mocked(backend.loadAsync).mockResolvedValue({
        invalid: 'structure',
        missing: 'required fields',
      } as unknown as Layout);

      const result = await loadLayoutResult('corrupted-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
        // Verify validation errors are included
        if ('validationErrors' in result.error) {
          expect(result.error.validationErrors).toBeDefined();
        }
      }
    });

    it('returns Err with unavailable error on backend failure', async () => {
      vi.mocked(backend.loadAsync).mockRejectedValue(
        new Error('SecurityError: Storage access denied')
      );

      const result = await loadLayoutResult('test-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
      }
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

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Migration should have added default values
        expect(result.value.gridUnitMm).toBe(42);
        expect(result.value.heightUnitMm).toBe(7);
        // And converted maxPrintSize to printBedSize
        expect(result.value.printBedSize).toBe(252); // 6 * 42
      }
    });
  });

  describe('deleteLayoutResult', () => {
    it('returns Ok on successful delete', async () => {
      vi.mocked(backend.deleteAsync).mockResolvedValue(undefined);

      const result = await deleteLayoutResult('test-id');

      expect(isOk(result)).toBe(true);
      expect(backend.deleteAsync).toHaveBeenCalledWith(
        getLayoutStorageKey('test-id')
      );
    });

    it('returns Ok even when layout does not exist', async () => {
      // Delete should succeed even if key doesn't exist
      vi.mocked(backend.deleteAsync).mockResolvedValue(undefined);

      const result = await deleteLayoutResult('non-existent');

      expect(isOk(result)).toBe(true);
    });

    it('returns Err with unavailable error on backend failure', async () => {
      vi.mocked(backend.deleteAsync).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await deleteLayoutResult('test-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
      }
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
      vi.mocked(backend.saveSyncGeneric).mockImplementation(() => {
        // Success - no throw
      });

      const result = saveLibraryResult(testLibrary);

      expect(isOk(result)).toBe(true);
    });

    it('returns Err with quota exceeded error', () => {
      vi.mocked(backend.saveSyncGeneric).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = saveLibraryResult(testLibrary);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      }
    });

    it('returns Err with unavailable error for generic failures', () => {
      vi.mocked(backend.saveSyncGeneric).mockImplementation(() => {
        throw new Error('Unknown error');
      });

      const result = saveLibraryResult(testLibrary);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
        // For localStorage errors, backend should be localStorage
        if ('backend' in result.error) {
          expect(result.error.backend).toBe('localStorage');
        }
      }
    });
  });

  describe('error properties', () => {
    it('storage errors have timestamp', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('test-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.timestamp).toBeDefined();
        expect(typeof result.error.timestamp).toBe('number');
        // Should be recent (within last minute)
        expect(Date.now() - result.error.timestamp).toBeLessThan(60000);
      }
    });

    it('retryable errors are marked correctly', async () => {
      // Unavailable errors should be retryable
      vi.mocked(backend.loadAsync).mockRejectedValue(new Error('Temporary failure'));

      const result = await loadLayoutResult('test-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(isRetryable(result.error.code)).toBe(true);
      }
    });

    it('not found errors are not retryable', async () => {
      vi.mocked(backend.loadAsync).mockResolvedValue(null);

      const result = await loadLayoutResult('missing-id');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(isRetryable(result.error.code)).toBe(false);
      }
    });
  });
});
