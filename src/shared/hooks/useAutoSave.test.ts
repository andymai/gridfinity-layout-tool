import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '@/shared/hooks';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores, setupFakeTimers } from '@/test/testUtils';
import * as storage from '@/core/storage';
import { err, storageQuotaExceeded, storageUnavailable } from '@/core/result';
import { SHARED_PREVIEW_ID } from '@/core/constants';

// Mock the storage module with atomic API functions
// Note: vi.mock is hoisted, so we must define the factory inline
vi.mock('../../core/storage', () => {
  const mockPreview = {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
    binMap: [],
  };

  return {
    // Storage functions
    saveLayoutSync: vi.fn(),
    saveLayoutAsync: vi.fn().mockResolvedValue(undefined),
    loadLayoutSync: vi.fn(),
    loadLayoutAsync: vi.fn(),
    deleteLayoutSync: vi.fn(),
    deleteLayoutAsync: vi.fn().mockResolvedValue(undefined),
    saveLibrary: vi.fn(),
    computeLayoutPreview: vi.fn(() => mockPreview),
    getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
    saveLayoutResult: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveLibraryResult: vi.fn(() => ({ ok: true, value: undefined })),
    saveLayout: vi.fn(),
    loadLayout: vi.fn(),
    clearStorage: vi.fn(),
    exportLayout: vi.fn(),
    importLayout: vi.fn(),
    downloadLayoutAsFile: vi.fn(),

    // Atomic functions used by useAutoSave
    saveLayoutWithMetadata: vi
      .fn()
      .mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          if (!entry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          return Promise.resolve({
            ok: true,
            value: {
              layoutId,
              entry: { ...entry, modifiedAt: Date.now(), preview: mockPreview },
              library,
            },
          });
        }
      ),
    createLayoutEntry: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    deleteLayoutWithEntry: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    duplicateLayoutEntry: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    switchActiveLayout: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    renameLayoutEntry: vi.fn(() => ({ ok: true, value: {} })),
    updateCloudShare: vi.fn(() => ({ ok: true, value: {} })),
    computePreview: vi.fn(() => mockPreview),
  };
});

// Mock the idle utility to execute callbacks immediately (synchronously)
// This simplifies testing since we only need to test debounce behavior
vi.mock('../../shared/utils/idle', () => ({
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
    timerUtils.cleanup(); // Restore real timers
    vi.restoreAllMocks();
  });

  describe('debounced save', () => {
    it('saves layout after debounce delay', async () => {
      renderHook(() => useAutoSave());

      // Immediately after mount, save should not have been called
      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();

      // Advance time past debounce
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Now save should have been called
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledTimes(1);
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        useLayoutStore.getState().layout,
        useLibraryStore.getState().library
      );
    });

    it('does not save before debounce delay completes', () => {
      renderHook(() => useAutoSave());

      // Advance time to just before debounce
      act(() => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS - 100);
      });

      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();
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
      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();

      // Advance to complete the new debounce
      await act(async () => {
        timerUtils.advanceTime(500);
        await Promise.resolve();
      });

      // Now save should be called
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledTimes(1);
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
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledTimes(1);
      const savedLayout = (storage.saveLayoutWithMetadata as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
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
      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();
    });

    it('does not throw when unmounted after save completed', async () => {
      const { unmount } = renderHook(() => useAutoSave());

      // Let save complete
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledTimes(1);

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('localStorage integration', () => {
    it('calls saveLayoutWithMetadata with current layout and library', async () => {
      const layout = useLayoutStore.getState().layout;
      const library = useLibraryStore.getState().library;
      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledWith(TEST_LAYOUT_ID, layout, library);
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

      const savedLayout = (storage.saveLayoutWithMetadata as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
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
      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();
    });

    it('does not save when activeLayoutId is __shared_preview__', async () => {
      // Set activeLayoutId to shared preview (temporary layout)
      useLayoutStore.setState({ activeLayoutId: SHARED_PREVIEW_ID });

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // Should not have called save for temporary shared preview
      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error toast when save fails with quota exceeded', async () => {
      // Return an Err result with quota exceeded error
      vi.mocked(storage.saveLayoutWithMetadata).mockResolvedValue(err(storageQuotaExceeded()));

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
      vi.mocked(storage.saveLayoutWithMetadata).mockResolvedValue(
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
      vi.mocked(storage.saveLayoutWithMetadata).mockResolvedValue(err(storageQuotaExceeded()));

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
      vi.mocked(storage.saveLayoutWithMetadata).mockResolvedValue(err(storageQuotaExceeded()));

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
      const saveLayoutWithMetadataMock = vi.mocked(storage.saveLayoutWithMetadata);
      const mockPreview = {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
        binMap: [],
      };

      // First call fails
      saveLayoutWithMetadataMock.mockResolvedValueOnce(err(storageQuotaExceeded()));

      renderHook(() => useAutoSave());

      // First save fails
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Clear toasts for clean test
      useToastStore.setState({ toasts: [] });

      // Next save succeeds - return proper structure
      saveLayoutWithMetadataMock.mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          return Promise.resolve({
            ok: true as const,
            value: {
              layoutId,
              entry: entry ? { ...entry, modifiedAt: Date.now(), preview: mockPreview } : null,
              library,
            },
          });
        }
      );

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
      saveLayoutWithMetadataMock.mockResolvedValue(err(storageQuotaExceeded()));

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
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledTimes(2);

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

  describe('race condition prevention', () => {
    it('discards save result if layout switched during save', async () => {
      const mockPreview = {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
        binMap: [],
      };

      // Make the mock change the activeLayoutId DURING the save
      // to simulate a layout switch that happens while save is in progress
      vi.mocked(storage.saveLayoutWithMetadata).mockImplementation(
        async (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          // Simulate layout switch happening during the save operation
          useLayoutStore.setState({ activeLayoutId: 'different-layout-id' });

          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          return {
            ok: true as const,
            value: {
              layoutId,
              entry: entry ? { ...entry, modifiedAt: Date.now(), preview: mockPreview } : undefined,
              library,
            },
          };
        }
      );

      // Track setLibrary calls AFTER mock setup
      const setLibrarySpy = vi.spyOn(useLibraryStore.getState(), 'setLibrary');

      renderHook(() => useAutoSave());

      // Trigger the save
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // setLibrary should NOT have been called because layout switched during save
      // The save completed, but the result was discarded
      expect(setLibrarySpy).not.toHaveBeenCalled();

      setLibrarySpy.mockRestore();
    });

    it('updates library if layout has not changed during save', async () => {
      const mockPreview = {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
        binMap: [],
      };

      // Reset mock to default implementation (no layout switch during save)
      vi.mocked(storage.saveLayoutWithMetadata).mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          return Promise.resolve({
            ok: true as const,
            value: {
              layoutId,
              entry: entry ? { ...entry, modifiedAt: Date.now(), preview: mockPreview } : undefined,
              library,
            },
          });
        }
      );

      // Track setLibrary calls AFTER mock setup
      const setLibrarySpy = vi.spyOn(useLibraryStore.getState(), 'setLibrary');

      renderHook(() => useAutoSave());

      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // setLibrary SHOULD be called because layout didn't change
      expect(setLibrarySpy).toHaveBeenCalled();

      setLibrarySpy.mockRestore();
    });

    it('uses fresh library state when saving (not stale closure)', async () => {
      const mockPreview = {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
        binMap: [],
      };

      // Reset mock to default implementation
      vi.mocked(storage.saveLayoutWithMetadata).mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          return Promise.resolve({
            ok: true as const,
            value: {
              layoutId,
              entry: entry ? { ...entry, modifiedAt: Date.now(), preview: mockPreview } : undefined,
              library,
            },
          });
        }
      );

      renderHook(() => useAutoSave());

      // Advance halfway through debounce
      act(() => {
        timerUtils.advanceTime(500);
      });

      // Modify library state after hook was rendered but before save
      const currentLibrary = useLibraryStore.getState().library;
      const modifiedLibrary = {
        ...currentLibrary,
        settings: { authorName: 'Modified Author' },
      };
      act(() => {
        useLibraryStore.setState({ library: modifiedLibrary });
      });

      // Trigger a layout change to reset the debounce and use fresh state
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 15, depth: 10 });
      });

      // Complete the debounce
      await act(async () => {
        timerUtils.advanceTime(SAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      // saveLayoutWithMetadata should be called with the FRESH library
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object),
        expect.objectContaining({
          settings: { authorName: 'Modified Author' },
        })
      );
    });
  });
});
