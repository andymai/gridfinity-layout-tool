import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the cleanup function before importing the hook
const cleanupMock = vi.fn();
vi.mock('@/core/storage/localStorageCleanup', () => ({
  cleanupLocalStorageBackups: (...args: unknown[]) => cleanupMock(...args),
}));

// Mock idle callbacks to fire synchronously
vi.mock('@/shared/utils', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    scheduleIdleCallback: (
      cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
    ) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    },
    cancelIdleCallback: vi.fn(),
  };
});

describe('useLocalStorageCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanupMock.mockResolvedValue({ removedCount: 0, keptCount: 0, freedBytes: 0 });

    // Reset module-level `cleanupAttempted` flag by re-importing the module
    vi.resetModules();
  });

  async function renderCleanupHook() {
    const mod = await import('./useLocalStorageCleanup');
    return renderHook(() => mod.useLocalStorageCleanup());
  }

  it('calls cleanupLocalStorageBackups on mount', async () => {
    await renderCleanupHook();

    expect(cleanupMock).toHaveBeenCalledOnce();
  });

  it('logs when backups are removed', async () => {
    cleanupMock.mockResolvedValue({ removedCount: 3, keptCount: 0, freedBytes: 15360 });

    await renderCleanupHook();
    await vi.waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 3 localStorage backup(s)')
      );
    });
  });

  it('does not log when no backups removed', async () => {
    cleanupMock.mockResolvedValue({ removedCount: 0, keptCount: 0, freedBytes: 0 });

    await renderCleanupHook();
    await vi.waitFor(() => {
      expect(cleanupMock).toHaveBeenCalled();
    });

    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned'));
  });

  it('warns on cleanup failure', async () => {
    const error = new Error('IndexedDB not available');
    cleanupMock.mockRejectedValue(error);

    await renderCleanupHook();
    await vi.waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith('[Storage] localStorage cleanup failed:', error);
    });
  });

  it('runs only once per session (module-level guard)', async () => {
    const mod = await import('./useLocalStorageCleanup');
    const { unmount } = renderHook(() => mod.useLocalStorageCleanup());
    unmount();

    // Second render in same module scope should not re-trigger
    renderHook(() => mod.useLocalStorageCleanup());

    expect(cleanupMock).toHaveBeenCalledOnce();
  });
});
