import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

// Mock the storage module before importing the hook
vi.mock('@/core/storage', () => ({
  isMigrationNeeded: vi.fn(),
  migrateAllLayoutsToIndexedDB: vi.fn(),
  runLocalStorageMigrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/analytics/purposeInference', () => ({
  initLabelSizesCache: vi.fn().mockResolvedValue(undefined),
}));

// We need to import and re-create the hook each test since it has module-level state
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let storage: typeof import('@/core/storage');

// Reset module state between tests
async function resetModule() {
  vi.resetModules();
  storage = await import('@/core/storage');
}

describe('useStorageMigration', () => {
  let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await resetModule();

    // Clear all mocks
    vi.clearAllMocks();

    // Spy on console methods
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Store original requestIdleCallback
    originalRequestIdleCallback = window.requestIdleCallback;

    // Use fake timers for controlling async flow
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Restore requestIdleCallback
    if (originalRequestIdleCallback !== undefined) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
  });

  describe('initialization', () => {
    it('checks if migration is needed on mount', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(false);

      // Mock requestIdleCallback to execute immediately
      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      // Run all timers and pending promises
      await vi.runAllTimersAsync();

      expect(storage.isMigrationNeeded).toHaveBeenCalledTimes(1);
    });

    it('does not run migration when not needed', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(false);

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(storage.isMigrationNeeded).toHaveBeenCalled();
      expect(storage.migrateAllLayoutsToIndexedDB).not.toHaveBeenCalled();
    });

    it('runs migration when needed', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 5,
        skippedCount: 2,
        errors: [],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(storage.migrateAllLayoutsToIndexedDB).toHaveBeenCalledTimes(1);
    });
  });

  describe('runs only once per session', () => {
    it('only runs migration once even with multiple hook instances', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 3,
        skippedCount: 0,
        errors: [],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');

      // Mount first instance
      renderHook(() => useStorageMigration());
      await vi.runAllTimersAsync();

      // Mount second instance
      renderHook(() => useStorageMigration());
      await vi.runAllTimersAsync();

      // Third instance
      renderHook(() => useStorageMigration());
      await vi.runAllTimersAsync();

      // Should only have migrated once
      expect(storage.migrateAllLayoutsToIndexedDB).toHaveBeenCalledTimes(1);
    });

    it('does not re-run migration after remount', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 2,
        skippedCount: 0,
        errors: [],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');

      // Mount, unmount, remount
      const { unmount } = renderHook(() => useStorageMigration());
      await vi.runAllTimersAsync();
      unmount();

      renderHook(() => useStorageMigration());
      await vi.runAllTimersAsync();

      expect(storage.migrateAllLayoutsToIndexedDB).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestIdleCallback', () => {
    it('uses requestIdleCallback when available', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(false);

      const mockRequestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });
      window.requestIdleCallback = mockRequestIdleCallback;

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(mockRequestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 5000,
      });
    });

    it('falls back to setTimeout when requestIdleCallback is not available', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 1,
        skippedCount: 0,
        errors: [],
      });

      // Remove requestIdleCallback
      // @ts-expect-error - intentionally removing for test
      delete window.requestIdleCallback;

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      // Migration should not have been called yet (waiting for setTimeout)
      expect(storage.migrateAllLayoutsToIndexedDB).not.toHaveBeenCalled();

      // Advance past the 100ms setTimeout fallback
      await vi.advanceTimersByTimeAsync(100);

      expect(storage.isMigrationNeeded).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('logs success message when migration completes', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 5,
        skippedCount: 2,
        errors: [],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith('[Storage] Starting migration to IndexedDB...');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Storage] Migration complete: 5 layouts migrated, 2 skipped'
      );
    });

    it('logs errors when migration fails', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: false,
        migratedCount: 0,
        skippedCount: 0,
        errors: ['Layout abc123 corrupted', 'Layout def456 not found'],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Storage] Migration failed:', [
        'Layout abc123 corrupted',
        'Layout def456 not found',
      ]);
    });
  });

  describe('error handling', () => {
    it('does not throw when isMigrationNeeded fails', async () => {
      vi.mocked(storage.isMigrationNeeded).mockRejectedValue(new Error('IndexedDB unavailable'));

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');

      // Should not throw
      expect(() => renderHook(() => useStorageMigration())).not.toThrow();

      await vi.runAllTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Storage] Migration error:', expect.any(Error));
    });

    it('does not throw when migration itself fails with exception', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockRejectedValue(
        new Error('Unexpected migration error')
      );

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');

      expect(() => renderHook(() => useStorageMigration())).not.toThrow();

      await vi.runAllTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Storage] Migration error:', expect.any(Error));
    });

    it('app continues to work after migration error', async () => {
      vi.mocked(storage.isMigrationNeeded).mockRejectedValue(new Error('Storage error'));

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');

      const { result } = renderHook(() => {
        useStorageMigration();
        return 'hook completed';
      });

      await vi.runAllTimersAsync();

      // Hook should complete normally (returns void)
      expect(result.current).toBe('hook completed');
    });
  });

  describe('migration statistics', () => {
    it('handles migration with all layouts already migrated', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: true,
        migratedCount: 0,
        skippedCount: 10,
        errors: [],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Storage] Migration complete: 0 layouts migrated, 10 skipped'
      );
    });

    it('handles partial migration success', async () => {
      vi.mocked(storage.isMigrationNeeded).mockResolvedValue(true);
      vi.mocked(storage.migrateAllLayoutsToIndexedDB).mockResolvedValue({
        success: false,
        migratedCount: 3,
        skippedCount: 1,
        errors: ['Layout xyz789 failed'],
      });

      window.requestIdleCallback = vi.fn((cb) => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      });

      const { useStorageMigration } = await import('@/hooks/useStorageMigration');
      renderHook(() => useStorageMigration());

      await vi.runAllTimersAsync();

      // Even with partial failure, it logs the error
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Storage] Migration failed:', [
        'Layout xyz789 failed',
      ]);
    });
  });
});
