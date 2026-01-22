import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCrossTabSync } from '@/shared/hooks';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useHistoryStore } from '@/core/store/history';
import { useUIStore } from '@/core/store/ui';
import { useLabsStore, LABS_STORAGE_KEY } from '@/core/store/labs';
import { resetAllStores } from '@/test/testUtils';
import * as storage from '@/core/storage';
import * as validation from '@/shared/utils/validation';

vi.mock('../../core/storage', () => ({
  loadLayoutAsync: vi.fn(),
  loadLibrary: vi.fn(),
}));

vi.mock('../../shared/utils/validation', () => ({
  validateLayoutIntegrity: vi.fn(),
}));

describe('useCrossTabSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all stores for isolation
    resetAllStores();

    // Set up test-specific state
    useLayoutStore.setState({ activeLayoutId: 'test-layout-id' });
    useUIStore.setState({ activeLayerId: 'layer-1' });
  });

  afterEach(() => {
    cleanup(); // Unmount all renderHook instances
    vi.restoreAllMocks();
  });

  it('syncs library when library storage key changes', () => {
    const mockLibrary = {
      version: '1.0',
      activeLayoutId: 'new-layout',
      settings: {},
      entries: [
        {
          id: 'new-layout',
          name: 'New',
          createdAt: 1,
          modifiedAt: 1,
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
    vi.mocked(storage.loadLibrary).mockReturnValue(mockLibrary);

    const setLibrarySpy = vi.spyOn(useLibraryStore.getState(), 'setLibrary');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-library-v1',
          newValue: JSON.stringify(mockLibrary),
          oldValue: null,
        })
      );
    });

    expect(storage.loadLibrary).toHaveBeenCalled();
    expect(setLibrarySpy).toHaveBeenCalledWith(mockLibrary);
  });

  it('syncs active layout when its storage key changes', async () => {
    const mockLayout = {
      name: 'Updated Layout',
      drawer: { width: 12, depth: 10, height: 14 },
      bins: [],
      layers: [{ id: 'layer-1', name: 'Base', height: 1 }],
      categories: [{ id: 'cat-1', name: 'Default', color: '#3B82F6' }],
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    const importLayoutSpy = vi.spyOn(useLayoutStore.getState(), 'importLayout');
    const clearHistorySpy = vi.spyOn(useHistoryStore.getState(), 'clear');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-test-layout-id',
          newValue: JSON.stringify(mockLayout),
          oldValue: null,
        })
      );
    });

    // loadLayoutAsync is called with .then(), so wait for async to complete
    await vi.waitFor(() => {
      expect(storage.loadLayoutAsync).toHaveBeenCalledWith('test-layout-id');
      expect(validation.validateLayoutIntegrity).toHaveBeenCalledWith(mockLayout);
      expect(importLayoutSpy).toHaveBeenCalledWith(mockLayout, 'test-layout-id', 'remote');
      expect(clearHistorySpy).toHaveBeenCalled();
    });
  });

  it('does not sync when non-active layout changes', () => {
    const mockLayout = { name: 'Other Layout' };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);

    const importLayoutSpy = vi.spyOn(useLayoutStore.getState(), 'importLayout');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-other-layout-id',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    expect(storage.loadLayoutAsync).not.toHaveBeenCalled();
    expect(importLayoutSpy).not.toHaveBeenCalled();
  });

  it('does not sync invalid layout data', () => {
    const mockLayout = { name: 'Invalid' };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({
      valid: false,
      error: 'Invalid',
    });

    const importLayoutSpy = vi.spyOn(useLayoutStore.getState(), 'importLayout');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-test-layout-id',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    expect(importLayoutSpy).not.toHaveBeenCalled();
  });

  it('ignores storage events for unrelated keys', () => {
    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'some-other-app-key',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    expect(storage.loadLibrary).not.toHaveBeenCalled();
    expect(storage.loadLayoutAsync).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCrossTabSync());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('clears selection when syncing layout', async () => {
    const mockLayout = {
      name: 'Updated',
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
      layers: [{ id: 'layer-1', name: 'Base', height: 1 }],
      categories: [{ id: 'cat-1', name: 'Default', color: '#3B82F6' }],
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    useUIStore.setState({ selectedBinIds: ['bin-1', 'bin-2'] });
    const clearSelectionSpy = vi.spyOn(useUIStore.getState(), 'clearSelection');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-test-layout-id',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    await vi.waitFor(() => {
      expect(clearSelectionSpy).toHaveBeenCalled();
    });
  });

  it('updates active layer if it no longer exists', async () => {
    const mockLayout = {
      name: 'Updated',
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
      layers: [{ id: 'new-layer', name: 'New Layer', height: 1 }],
      categories: [{ id: 'cat-1', name: 'Default', color: '#3B82F6' }],
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    useUIStore.setState({ activeLayerId: 'old-layer' });
    const setActiveLayerSpy = vi.spyOn(useUIStore.getState(), 'setActiveLayer');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-test-layout-id',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    await vi.waitFor(() => {
      expect(setActiveLayerSpy).toHaveBeenCalledWith('new-layer');
    });
  });

  describe('Labs preferences sync', () => {
    it('syncs labs preferences when storage key changes', () => {
      const syncFromStorageSpy = vi.spyOn(useLabsStore.getState(), 'syncFromStorage');
      const newPrefs = {
        enabledFeatures: { collaborative_editing: true },
        dismissedFeatures: ['feature1'],
      };

      renderHook(() => useCrossTabSync());

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: LABS_STORAGE_KEY,
            newValue: JSON.stringify(newPrefs),
            oldValue: null,
          })
        );
      });

      expect(syncFromStorageSpy).toHaveBeenCalled();
    });

    it('uses default preferences when newValue is null', () => {
      const syncFromStorageSpy = vi.spyOn(useLabsStore.getState(), 'syncFromStorage');

      renderHook(() => useCrossTabSync());

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: LABS_STORAGE_KEY,
            newValue: null,
            oldValue: '{}',
          })
        );
      });

      expect(syncFromStorageSpy).toHaveBeenCalled();
    });

    it('ignores invalid JSON in labs preferences', () => {
      const syncFromStorageSpy = vi.spyOn(useLabsStore.getState(), 'syncFromStorage');

      renderHook(() => useCrossTabSync());

      // Should not throw
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: LABS_STORAGE_KEY,
            newValue: 'invalid json {{{',
            oldValue: null,
          })
        );
      });

      // syncFromStorage should NOT be called since JSON.parse throws
      expect(syncFromStorageSpy).not.toHaveBeenCalled();
    });
  });

  describe('Layout load error handling', () => {
    it('handles layout load errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.loadLayoutAsync).mockRejectedValue(new Error('Load failed'));

      renderHook(() => useCrossTabSync());

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'gridfinity-layout-test-layout-id',
            newValue: '{}',
            oldValue: null,
          })
        );
      });

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[CrossTabSync] Failed to load layout test-layout-id:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  it('updates active category if it no longer exists', async () => {
    const mockLayout = {
      name: 'Updated',
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
      layers: [{ id: 'layer-1', name: 'Base', height: 1 }],
      categories: [{ id: 'new-cat', name: 'New Category', color: '#3B82F6' }],
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    };
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(mockLayout);
    vi.mocked(validation.validateLayoutIntegrity).mockReturnValue({ valid: true });

    useUIStore.setState({ activeCategoryId: 'old-cat' });
    const setActiveCategorySpy = vi.spyOn(useUIStore.getState(), 'setActiveCategory');

    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gridfinity-layout-test-layout-id',
          newValue: '{}',
          oldValue: null,
        })
      );
    });

    await vi.waitFor(() => {
      expect(setActiveCategorySpy).toHaveBeenCalledWith('new-cat');
    });
  });
});
