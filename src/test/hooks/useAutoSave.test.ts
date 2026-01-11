import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useToastStore } from '../../store/toast';
import { createDefaultLayout } from '../../constants';
import * as storage from '../../utils/storage';
import type { LayoutLibrary } from '../../types';

// Mock the storage module
vi.mock('../../utils/storage', () => ({
  saveLayoutById: vi.fn(),
  saveLibrary: vi.fn(),
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

const SAVE_DEBOUNCE_MS = 1000;
const TEST_LAYOUT_ID = 'test-layout-id';

function createTestLibrary(): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: TEST_LAYOUT_ID,
    settings: {},
    entries: [{
      id: TEST_LAYOUT_ID,
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
    }],
  };
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset stores
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout, activeLayoutId: TEST_LAYOUT_ID });
    useLibraryStore.setState({
      library: createTestLibrary(),
      isLoaded: true,
      showLayoutManager: false,
    });
    useToastStore.setState({ toasts: [] });

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounced save', () => {
    it('saves layout after debounce delay', () => {
      renderHook(() => useAutoSave());

      // Immediately after mount, save should not have been called
      expect(storage.saveLayoutById).not.toHaveBeenCalled();

      // Advance time past debounce
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Now save should have been called
      expect(storage.saveLayoutById).toHaveBeenCalledTimes(1);
      expect(storage.saveLayoutById).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        useLayoutStore.getState().layout
      );
    });

    it('does not save before debounce delay completes', () => {
      renderHook(() => useAutoSave());

      // Advance time to just before debounce
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 100);
      });

      expect(storage.saveLayoutById).not.toHaveBeenCalled();
    });

    it('resets debounce timer on layout change', () => {
      renderHook(() => useAutoSave());

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Change layout
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      // Advance another 500ms (would be 1000ms total from original)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Save should NOT have been called (timer was reset)
      expect(storage.saveLayoutById).not.toHaveBeenCalled();

      // Advance to complete the new debounce
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Now save should be called
      expect(storage.saveLayoutById).toHaveBeenCalledTimes(1);
    });

    it('saves with latest layout data after multiple rapid changes', () => {
      renderHook(() => useAutoSave());

      // Make multiple rapid changes
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });
      act(() => {
        vi.advanceTimersByTime(200);
        useLayoutStore.getState().updateDrawer({ width: 14, depth: 12 });
      });
      act(() => {
        vi.advanceTimersByTime(200);
        useLayoutStore.getState().updateDrawer({ width: 16, depth: 14 });
      });

      // Advance past debounce from last change
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Should only save once with final values
      expect(storage.saveLayoutById).toHaveBeenCalledTimes(1);
      const savedLayout = (storage.saveLayoutById as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedLayout.drawer.width).toBe(16);
      expect(savedLayout.drawer.depth).toBe(14);
    });
  });

  describe('save cancels on unmount', () => {
    it('cancels pending save when unmounted', () => {
      const { unmount } = renderHook(() => useAutoSave());

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Unmount before save
      unmount();

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Save should not have been called
      expect(storage.saveLayoutById).not.toHaveBeenCalled();
    });

    it('does not throw when unmounted after save completed', () => {
      const { unmount } = renderHook(() => useAutoSave());

      // Let save complete
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      expect(storage.saveLayoutById).toHaveBeenCalledTimes(1);

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('localStorage integration', () => {
    it('calls saveLayoutById with current layout', () => {
      const layout = useLayoutStore.getState().layout;
      renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      expect(storage.saveLayoutById).toHaveBeenCalledWith(TEST_LAYOUT_ID, layout);
    });

    it('saves updated layout after modification', () => {
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

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      const savedLayout = (storage.saveLayoutById as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedLayout.bins.length).toBeGreaterThan(0);
      expect(savedLayout.bins[0].label).toBe('Test');
    });

    it('does not save when activeLayoutId is null', () => {
      // Set activeLayoutId to null
      useLayoutStore.setState({ activeLayoutId: null });

      renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Should not have called save
      expect(storage.saveLayoutById).not.toHaveBeenCalled();
    });

    it('does not save when activeLayoutId is __shared_preview__', () => {
      // Set activeLayoutId to shared preview (temporary layout)
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Should not have called save for temporary shared preview
      expect(storage.saveLayoutById).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error toast when save fails', () => {
      vi.mocked(storage.saveLayoutById).mockImplementation(() => {
        throw new Error('Storage full. Export your layout to save it.');
      });

      renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].message).toBe('Storage full. Export your layout to save it.');
    });

    it('shows generic error message for non-Error exceptions', () => {
      vi.mocked(storage.saveLayoutById).mockImplementation(() => {
        throw 'string error';
      });

      renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Failed to save layout');
    });

    it('only shows error toast once per failure session', () => {
      vi.mocked(storage.saveLayoutById).mockImplementation(() => {
        throw new Error('Storage full');
      });

      renderHook(() => useAutoSave());

      // First save attempt
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Trigger another save by changing layout
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Should still only have one toast (not spamming)
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('resets error flag after successful save', () => {
      const saveLayoutByIdMock = vi.mocked(storage.saveLayoutById);

      // First call fails
      saveLayoutByIdMock.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });

      renderHook(() => useAutoSave());

      // First save fails
      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Clear toasts for clean test
      useToastStore.setState({ toasts: [] });

      // Next save succeeds (default mock)
      saveLayoutByIdMock.mockImplementation(() => {});

      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // No new error toast
      expect(useToastStore.getState().toasts).toHaveLength(0);

      // Make it fail again
      saveLayoutByIdMock.mockImplementation(() => {
        throw new Error('Storage full again');
      });

      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 14, depth: 12 });
      });

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Should show error toast again (flag was reset)
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].message).toBe('Storage full again');
    });
  });

  describe('multiple hook instances', () => {
    it('each instance manages its own debounce', () => {
      const { unmount: unmount1 } = renderHook(() => useAutoSave());
      const { unmount: unmount2 } = renderHook(() => useAutoSave());

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Both instances should trigger save
      expect(storage.saveLayoutById).toHaveBeenCalledTimes(2);

      unmount1();
      unmount2();
    });
  });

  describe('library entry updates', () => {
    it('updates library entry modifiedAt on save', () => {
      // Get initial modifiedAt
      const initialEntry = useLibraryStore.getState().library.entries[0];
      const initialModifiedAt = initialEntry.modifiedAt;

      renderHook(() => useAutoSave());

      // Trigger a layout change
      act(() => {
        useLayoutStore.getState().updateDrawer({ width: 12, depth: 10 });
      });

      act(() => {
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      });

      // Check that modifiedAt was updated
      const updatedEntry = useLibraryStore.getState().library.entries[0];
      expect(updatedEntry.modifiedAt).toBeGreaterThanOrEqual(initialModifiedAt);
    });
  });
});
