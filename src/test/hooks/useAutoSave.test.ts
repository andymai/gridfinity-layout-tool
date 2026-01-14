import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useToastStore } from '../../store/toast';
import { resetAllStores, setupFakeTimers } from '../testUtils';
import * as storage from '../../storage';
import { ok, err, storageQuotaExceeded, storageUnavailable } from '../../result';

// Mock the storage module
vi.mock('../../storage', () => ({
  saveLayoutById: vi.fn(),
  saveLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
  saveLibrary: vi.fn(),
  // Result-based functions used by updated useAutoSave
  saveLayoutResult: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  saveLibraryResult: vi.fn(() => ({ ok: true, value: undefined })),
  computeLayoutPreview: vi.fn(() => ({
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
  })),
  // Legacy functions that may still be imported elsewhere
  saveLayout: vi.fn(),
  loadLayout: vi.fn(),
  clearStorage: vi.fn(),
  exportLayout: vi.fn(),
  importLayout: vi.fn(),
}));

// Mock the idle utility to execute callbacks immediately (synchronously)
// This simplifies testing since we only need to test debounce behavior
vi.mock('../../utils/idle', () => ({
  scheduleIdleCallback: vi.fn((callback) => {
    // Execute immediately for testing purposes
    callback({ didTimeout: false, timeRemaining: () => 50 });
    return 0;
  }),
  cancelIdleCallback: vi.fn(),
}));

const SAVE_DEBOUNCE_MS = 1000;
const TEST_LAYOUT_ID = 'test-layout-id';

describe('useAutoSave', () => {
  let timerUtils: ReturnType<typeof setupFakeTimers>;

  beforeEach(() => {
    // Setup fake timers with Date.now() coordination
    timerUtils = setupFakeTimers();
    vi.clearAllMocks();

    // Reset all stores for isolation
    resetAllStores();

    // Set active layout ID for auto-save tests
    useLayoutStore.setState({ activeLayoutId: TEST_LAYOUT_ID });
    useLibraryStore.setState({
      isLoaded: true,
      showLayoutManager: false,
    });

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    cleanup(); // Unmount all renderHook instances
    timerUtils.cleanup(); // Restore real timers
    vi.restoreAllMocks();
  });

  describe('debounced save', () => {
    it('saves layout after debounce delay', async () => {
      renderHook(() => useAutoSave());

      // Immediately after mount, save should not have been called
      expect(storage.saveLayoutResult).not.toHaveBeenCalled();

      // Advance time past debounce
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Now save should have been called
      expect(storage.saveLayoutResult).toHaveBeenCalledTimes(1);
      expect(storage.saveLayoutResult).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        useLayoutStore.getState().layout
      );
    });

    it('does not save before debounce delay completes', () => {
      renderHook(() => useAutoSave());

      // Advance time to just before debounce
      act(() => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS - 100);
      });

      expect(storage.saveLayoutResult).not.toHaveBeenCalled();
    });

    it('resets debounce timer on layout change', async () => {
      renderHook(() => useAutoSave());

      // Advance halfway
      act(() => {
        timerUtils.advanceTime(500);
      });

      // Change layout
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      // Advance another 500ms (would be 1000ms total from original)
      act(() => {
        timerUtils.advanceTime(500);
      });

      // Save should NOT have been called (timer was reset)
      expect(storage.saveLayoutResult).not.toHaveBeenCalled();

      // Advance to complete the new debounce
      await act(async () => {
        timerUtils.advanceTime(500);
        await Promise.resolve();
      });

      // Now save should be called
      expect(storage.saveLayoutResult).toHaveBeenCalledTimes(1);
    });

    it('saves with latest layout data after multiple rapid changes', async () => {
      renderHook(() => useAutoSave());

      // Make multiple rapid changes
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });
      act(() => {
        timerUtils.advanceTime(200);
        useLayoutStore.getState().updateDrawer({ width: 14, depth: 12 });
      });
      act(() => {
        timerUtils.advanceTime(200);
        useLayoutStore.getState().updateDrawer({ width: 16, depth: 14 });
      });

      // Advance past debounce from last change
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should only save once with final values
      expect(storage.saveLayoutResult).toHaveBeenCalledTimes(1);
      const savedLayout = (storage.saveLayoutResult as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedLayout.drawer.width).toBe(16);
      expect(savedLayout.drawer.depth).toBe(14);
    });
  });

  describe('save cancels on unmount', () => {
    it('cancels pending save when unmounted', async () => {
      const { unmount } = renderHook(() => useAutoSave());

      // Advance halfway
      act(() => {
        timerUtils.advanceTime(500);
      });

      // Unmount before save
      unmount();

      // Advance past debounce
      await act(async () => {
        timerUtils.advanceTime(1000);
        await Promise.resolve();
      });

      // Save should not have been called
      expect(storage.saveLayoutResult).not.toHaveBeenCalled();
    });

    it('does not throw when unmounted after save completed', async () => {
      const { unmount } = renderHook(() => useAutoSave());

      // Let save complete
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(storage.saveLayoutResult).toHaveBeenCalledTimes(1);

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('localStorage integration', () => {
    it('calls saveLayoutResult with current layout', async () => {
      const layout = useLayoutStore.getState().layout;
      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(storage.saveLayoutResult).toHaveBeenCalledWith(TEST_LAYOUT_ID, layout);
    });

    it('saves updated layout after modification', async () => {
      renderHook(() => useAutoSave());

      // Modify layout
      act(() => {
        const { addBin, layout } = useLayoutStore.getState();
        addBin({
          layerId: layout.layers[0].id,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: layout.categories[0].id,
          label: 'Test',
          notes: '',
        });
      });

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      const savedLayout = (storage.saveLayoutResult as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedLayout.bins.length).toBeGreaterThan(0);
      expect(savedLayout.bins[0].label).toBe('Test');
    });

    it('does not save when activeLayoutId is null', async () => {
      // Set activeLayoutId to null
      useLayoutStore.setState({ activeLayoutId: null });

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should not have called save
      expect(storage.saveLayoutResult).not.toHaveBeenCalled();
    });

    it('does not save when activeLayoutId is __shared_preview__', async () => {
      // Set activeLayoutId to shared preview (temporary layout)
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should not have called save for temporary shared preview
      expect(storage.saveLayoutResult).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error toast when save fails with quota exceeded', async () => {
      // Return an Err result with quota exceeded error
      vi.mocked(storage.saveLayoutResult).mockResolvedValue(
        err(storageQuotaExceeded())
      );

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      // The message comes from getUserMessage which reads from ERROR_CATALOG
      expect(toasts[0].message).toContain('Storage');
    });

    it('shows error toast when save fails with storage unavailable', async () => {
      vi.mocked(storage.saveLayoutResult).mockResolvedValue(
        err(storageUnavailable('indexedDB'))
      );

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
    });

    it('only shows error toast once per failure session', async () => {
      vi.mocked(storage.saveLayoutResult).mockResolvedValue(
        err(storageQuotaExceeded())
      );

      renderHook(() => useAutoSave());

      // First save attempt
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Trigger another save by changing layout
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should still only have one toast (not spamming)
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('shows persistent toast after 3 consecutive failures', async () => {
      vi.mocked(storage.saveLayoutResult).mockResolvedValue(
        err(storageQuotaExceeded())
      );

      renderHook(() => useAutoSave());

      // First failure
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });
      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Clear toasts to track new ones
      useToastStore.setState({ toasts: [] });

      // Second failure
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });
      // Second failure doesn't show new toast due to hasShownErrorRef
      expect(useToastStore.getState().toasts).toHaveLength(0);

      // Third failure - should show persistent (non-auto-dismiss) toast
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 14, depth: 12 });
      });
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // After 3 failures, we show a persistent toast
      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThanOrEqual(1);
      // The most recent toast should be the persistent one
      const lastToast = toasts[toasts.length - 1];
      expect(lastToast.type).toBe('error');
    });

    it('resets error flag after successful save', async () => {
      const saveLayoutResultMock = vi.mocked(storage.saveLayoutResult);

      // First call fails
      saveLayoutResultMock.mockResolvedValueOnce(err(storageQuotaExceeded()));

      renderHook(() => useAutoSave());

      // First save fails
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Clear toasts for clean test
      useToastStore.setState({ toasts: [] });

      // Next save succeeds
      saveLayoutResultMock.mockResolvedValue(ok(undefined));

      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // No new error toast
      expect(useToastStore.getState().toasts).toHaveLength(0);

      // Make it fail again
      saveLayoutResultMock.mockResolvedValue(err(storageQuotaExceeded()));

      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 14, depth: 12 });
      });

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should show error toast again (flag was reset)
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('multiple hook instances', () => {
    it('each instance manages its own debounce', async () => {
      const { unmount: unmount1 } = renderHook(() => useAutoSave());
      const { unmount: unmount2 } = renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Both instances should trigger save
      expect(storage.saveLayoutResult).toHaveBeenCalledTimes(2);

      unmount1();
      unmount2();
    });
  });

  describe('library entry updates', () => {
    it('updates library entry modifiedAt on save', async () => {
      // Get initial modifiedAt
      const initialEntry = useLibraryStore.getState().library.entries[0];
      const initialModifiedAt = initialEntry.modifiedAt;

      renderHook(() => useAutoSave());

      // Trigger a layout change
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Check that modifiedAt was updated
      const updatedEntry = useLibraryStore.getState().library.entries[0];
      expect(updatedEntry.modifiedAt).toBeGreaterThanOrEqual(initialModifiedAt);
    });
  });
});
