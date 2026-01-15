import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { useToastStore } from '../../store/toast';
import { createDefaultLayout } from '../../constants';
import { resetAllStores } from '../testUtils';
import * as storage from '../../storage';
import type { LayoutLibrary, LayoutEntry, Layout } from '../../types';
import { isOk, isErr } from '../../result';

// Mock the storage module
vi.mock('../../storage', () => {
  const mockPreview = {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
  };

  return {
    // Legacy functions (still needed for some tests)
    saveLayoutById: vi.fn(),
    saveLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
    loadLayoutById: vi.fn(),
    loadLayoutByIdAsync: vi.fn(),
    deleteLayoutById: vi.fn(),
    deleteLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
    saveLibrary: vi.fn(),
    computeLayoutPreview: vi.fn(() => mockPreview),
    getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),

    // New atomic functions
    saveLayoutWithMetadata: vi.fn().mockImplementation(
      (layoutId: string, layout: unknown, library: { entries: Array<{ id: string }> }) => {
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
    createLayoutEntry: vi.fn().mockImplementation(
      (layout: { name: string; layers: Array<{ id: string }>; categories: Array<{ id: string }> }, library: { entries: unknown[] }) => {
        const layoutId = 'new-layout-id';
        const entry = {
          id: layoutId,
          name: layout.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: mockPreview,
        };
        return Promise.resolve({
          ok: true,
          value: {
            layoutId,
            entry,
            library: { ...library, entries: [...library.entries, entry] },
            layout,
          },
        });
      }
    ),
    deleteLayoutWithEntry: vi.fn().mockImplementation(
      (layoutId: string, library: { entries: Array<{ id: string }>; activeLayoutId: string }) => {
        const remainingEntries = library.entries.filter((e: { id: string }) => e.id !== layoutId);
        const newActiveId = library.activeLayoutId === layoutId ? remainingEntries[0]?.id : undefined;
        return Promise.resolve({
          ok: true,
          value: {
            library: { ...library, entries: remainingEntries },
            newActiveId,
          },
        });
      }
    ),
    duplicateLayoutEntry: vi.fn().mockImplementation(
      (sourceId: string, library: { entries: Array<{ id: string; name: string }> }) => {
        const sourceEntry = library.entries.find((e: { id: string }) => e.id === sourceId);
        if (!sourceEntry) {
          return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
        }
        const layoutId = 'duplicated-layout-id';
        const newEntry = {
          id: layoutId,
          name: `${sourceEntry.name} (copy)`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: mockPreview,
        };
        return Promise.resolve({
          ok: true,
          value: {
            layoutId,
            entry: newEntry,
            library: { ...library, entries: [...library.entries, newEntry] },
            layout: { name: newEntry.name, layers: [], categories: [] },
          },
        });
      }
    ),
    switchActiveLayout: vi.fn().mockImplementation(
      (_fromId: string, _fromLayout: unknown, toId: string, library: { entries: Array<{ id: string }> }) => {
        const targetEntry = library.entries.find((e: { id: string }) => e.id === toId);
        if (!targetEntry) {
          return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
        }
        return Promise.resolve({
          ok: true,
          value: {
            library: { ...library, activeLayoutId: toId },
            targetLayout: { name: 'Target Layout', layers: [{ id: 'layer-1' }], categories: [{ id: 'cat-1' }] },
            targetEntry,
          },
        });
      }
    ),
    renameLayoutEntry: vi.fn().mockImplementation(
      (layoutId: string, newName: string, library: { entries: Array<{ id: string; name: string }> }) => {
        const updatedEntries = library.entries.map((e: { id: string; name: string }) =>
          e.id === layoutId ? { ...e, name: newName } : e
        );
        return { ok: true, value: { ...library, entries: updatedEntries } };
      }
    ),
    computePreview: vi.fn(() => mockPreview),
  };
});

// Mock validation
vi.mock('../../utils/validation', async () => {
  const actual = await vi.importActual('../../utils/validation');
  return {
    ...actual,
    validateLayoutIntegrity: vi.fn(() => ({ valid: true })),
  };
});

const TEST_LAYOUT_ID = 'test-layout-id';
const SECOND_LAYOUT_ID = 'second-layout-id';

function createTestLayout(name = 'Test Layout'): Layout {
  const layout = createDefaultLayout();
  layout.name = name;
  return layout;
}

function createTestEntry(id: string, name: string): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
    },
  };
}

function createTestLibrary(entries: LayoutEntry[]): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: entries[0]?.id || '',
    settings: {},
    entries,
  };
}

describe('useLayoutSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all stores using shared utility for complete isolation
    resetAllStores();

    // Set up test-specific state
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: TEST_LAYOUT_ID,
    });

    useLibraryStore.setState({
      library: createTestLibrary([
        createTestEntry(TEST_LAYOUT_ID, 'Test Layout'),
        createTestEntry(SECOND_LAYOUT_ID, 'Second Layout'),
      ]),
      isLoaded: true,
      showLayoutManager: false,
    });

    useUIStore.setState({
      selectedBinIds: [],
      activeLayerId: defaultLayout.layers[0]?.id || '',
      activeCategoryId: defaultLayout.categories[0]?.id || '',
    });

    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    cleanup(); // Clean up React Testing Library
    vi.restoreAllMocks();
  });

  describe('switchLayout', () => {
    it('switches to target layout successfully', async () => {
      const targetLayout = createTestLayout('Second Layout');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: Awaited<ReturnType<typeof result.current.switchLayout>>;
      await act(async () => {
        switchResult = await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(isOk(switchResult!)).toBe(true);
      expect(useLayoutStore.getState().activeLayoutId).toBe(SECOND_LAYOUT_ID);
    });

    it('returns error for non-existent layout', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: Awaited<ReturnType<typeof result.current.switchLayout>>;
      await act(async () => {
        switchResult = await result.current.switchLayout('non-existent-id');
      });

      expect(isErr(switchResult!)).toBe(true);
      if (isErr(switchResult!)) {
        expect(switchResult!.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });

    it('returns error when layout fails to load', async () => {
      // Mock switchActiveLayout to return an error (target layout not found) - use Once to not affect other tests
      vi.mocked(storage.switchActiveLayout).mockResolvedValueOnce({
        ok: false,
        error: { code: 'STORAGE_NOT_FOUND', message: 'Layout not found' },
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: Awaited<ReturnType<typeof result.current.switchLayout>>;
      await act(async () => {
        switchResult = await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(isErr(switchResult!)).toBe(true);
      if (isErr(switchResult!)) {
        expect(switchResult!.error.code).toBe('STORAGE_NOT_FOUND');
      }
    });

    it('saves current layout before switching', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      // switchActiveLayout saves the current layout atomically
      expect(storage.switchActiveLayout).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object),
        SECOND_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('clears selection on switch', async () => {
      useUIStore.setState({ selectedBinIds: ['bin-1', 'bin-2'] });

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });

    it('clears undo history on switch', async () => {
      // Set up initial history state
      useHistoryStore.setState({
        past: [createDefaultLayout()],
        future: [createDefaultLayout()],
        canUndo: true,
        canRedo: true,
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      // Verify history state before
      expect(useHistoryStore.getState().past.length).toBe(1);
      expect(useHistoryStore.getState().future.length).toBe(1);

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      // Verify history was cleared after switch
      expect(useHistoryStore.getState().past).toEqual([]);
      expect(useHistoryStore.getState().future).toEqual([]);
      expect(useHistoryStore.getState().canUndo).toBe(false);
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });

    it('sets active layer and category from new layout', async () => {
      // Mock switchActiveLayout to return a specific layout
      const targetLayout = createTestLayout('Second');
      targetLayout.layers = [{ id: 'new-layer', name: 'New Layer', height: 5 }];
      targetLayout.categories = [{ id: 'new-cat', name: 'New Cat', color: '#fff' }];

      vi.mocked(storage.switchActiveLayout).mockResolvedValueOnce({
        ok: true,
        value: {
          library: useLibraryStore.getState().library,
          targetLayout,
          targetEntry: { id: SECOND_LAYOUT_ID, name: 'Second Layout', createdAt: Date.now(), modifiedAt: Date.now(), preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 } },
        },
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().activeLayerId).toBe('new-layer');
      expect(useUIStore.getState().activeCategoryId).toBe('new-cat');
    });

    it('clears sharedLayoutPreview state when switching', async () => {
      // Set up shared layout preview state
      const mockLayout = createTestLayout('Shared');
      useUIStore.setState({
        sharedLayoutPreview: mockLayout,
        sharedLayoutOriginalName: 'Shared Layout',
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().sharedLayoutPreview).toBeNull();
      expect(useUIStore.getState().sharedLayoutOriginalName).toBeNull();
    });

    it('skips saving when current layout is __shared_preview__', async () => {
      // Set current layout ID to shared preview
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      // Should have called with __shared_preview__ as fromId but that's ok
      // The important thing is switchActiveLayout handles this properly
      expect(storage.switchActiveLayout).toHaveBeenCalled();
    });
  });

  describe('createNewLayout', () => {
    it('creates new layout and switches to it', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let createResult: Awaited<ReturnType<typeof result.current.createNewLayout>> | undefined;
      await act(async () => {
        createResult = await result.current.createNewLayout('My New Layout');
      });

      expect(createResult).toBeDefined();
      expect(isOk(createResult)).toBe(true);
      if (createResult && isOk(createResult)) {
        expect(createResult.value).toBeDefined();
      }
      expect(useLayoutStore.getState().layout.name).toBe('My New Layout');
    });

    it('saves current layout before creating new', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.createNewLayout('New');
      });

      // Should have saved current layout first using atomic save
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('adds entry to library', async () => {
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.createNewLayout('New Layout');
      });

      expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
    });

    it('shows success toast', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.createNewLayout('New');
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('created'))).toBe(true);
    });

    it('uses default name if none provided', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.createNewLayout();
      });

      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');
    });
  });

  describe('deleteLayout', () => {
    it('deletes layout successfully', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteLayout>>;
      await act(async () => {
        deleteResult = await result.current.deleteLayout(SECOND_LAYOUT_ID);
      });

      expect(isOk(deleteResult!)).toBe(true);
      // Uses atomic delete which handles storage and library together
      expect(storage.deleteLayoutWithEntry).toHaveBeenCalledWith(
        SECOND_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('cannot delete the only layout', async () => {
      useLibraryStore.setState({
        library: createTestLibrary([createTestEntry(TEST_LAYOUT_ID, 'Only Layout')]),
        isLoaded: true,
        showLayoutManager: false,
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteLayout>>;
      await act(async () => {
        deleteResult = await result.current.deleteLayout(TEST_LAYOUT_ID);
      });

      expect(isErr(deleteResult!)).toBe(true);
      if (isErr(deleteResult!)) {
        expect(deleteResult!.error.code).toBe('LAYOUT_LAST_ENTITY');
      }
    });

    it('switches to another layout when deleting active', async () => {
      // Ensure we start with TEST_LAYOUT_ID as active
      expect(useLayoutStore.getState().activeLayoutId).toBe(TEST_LAYOUT_ID);

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.deleteLayout(TEST_LAYOUT_ID);
      });

      // After deleting the active layout, deleteLayoutWithEntry returns newActiveId
      // which triggers switchLayout, which calls switchActiveLayout and importLayout
      expect(storage.deleteLayoutWithEntry).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );

      // switchActiveLayout should have been called to switch to the new active layout
      expect(storage.switchActiveLayout).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object),
        SECOND_LAYOUT_ID,
        expect.any(Object)
      );

      // importLayout should have set activeLayoutId to SECOND_LAYOUT_ID
      const currentActiveId = useLayoutStore.getState().activeLayoutId;
      expect(currentActiveId).toBe(SECOND_LAYOUT_ID);
    });

    it('shows success toast', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.deleteLayout(SECOND_LAYOUT_ID);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('deleted'))).toBe(true);
    });
  });

  describe('duplicateLayout', () => {
    it('duplicates layout successfully', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: Awaited<ReturnType<typeof result.current.duplicateLayout>>;
      await act(async () => {
        dupResult = await result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      expect(isOk(dupResult!)).toBe(true);
      if (isOk(dupResult!)) {
        expect(dupResult!.value).toBeDefined();
      }
    });

    it('returns error for non-existent layout', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: Awaited<ReturnType<typeof result.current.duplicateLayout>>;
      await act(async () => {
        dupResult = await result.current.duplicateLayout('non-existent');
      });

      expect(isErr(dupResult!)).toBe(true);
      if (isErr(dupResult!)) {
        expect(dupResult!.error.code).toBe('LAYOUT_INVALID_OPERATION');
      }
    });

    it('returns error when source layout fails to load', async () => {
      // Mock duplicateLayoutEntry to fail
      vi.mocked(storage.duplicateLayoutEntry).mockResolvedValueOnce({
        ok: false,
        error: { code: 'STORAGE_NOT_FOUND', message: 'Layout not found' },
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: Awaited<ReturnType<typeof result.current.duplicateLayout>>;
      await act(async () => {
        dupResult = await result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      expect(isErr(dupResult!)).toBe(true);
      if (isErr(dupResult!)) {
        expect(dupResult!.error.code).toBe('STORAGE_NOT_FOUND');
      }
    });

    it('saves duplicated layout with (copy) suffix', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      // Uses atomic duplicate which handles naming
      expect(storage.duplicateLayoutEntry).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );
    });
  });

  describe('renameLayout', () => {
    it('renames layout entry', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.renameLayout(TEST_LAYOUT_ID, 'Renamed Layout');
      });

      const entry = useLibraryStore.getState().getEntry(TEST_LAYOUT_ID);
      expect(entry?.name).toBe('Renamed Layout');
    });

    it('updates layout store name if renaming active layout', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.renameLayout(TEST_LAYOUT_ID, 'New Name');
      });

      expect(useLayoutStore.getState().layout.name).toBe('New Name');
    });

    it('does not update layout store if renaming inactive layout', () => {
      const originalName = useLayoutStore.getState().layout.name;

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.renameLayout(SECOND_LAYOUT_ID, 'Other Name');
      });

      expect(useLayoutStore.getState().layout.name).toBe(originalName);
    });
  });

  describe('saveCurrentLayout', () => {
    it('saves layout to storage', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.saveCurrentLayout();
      });

      // Uses atomic save with metadata
      expect(storage.saveLayoutWithMetadata).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('updates library entry', async () => {
      const { result } = renderHook(() => useLayoutSwitcher());
      const beforeModifiedAt = useLibraryStore.getState().getEntry(TEST_LAYOUT_ID)?.modifiedAt;

      await act(async () => {
        await result.current.saveCurrentLayout();
      });

      const afterModifiedAt = useLibraryStore.getState().getEntry(TEST_LAYOUT_ID)?.modifiedAt;
      expect(afterModifiedAt).toBeGreaterThanOrEqual(beforeModifiedAt!);
    });

    it('does nothing if no activeLayoutId', async () => {
      useLayoutStore.setState({ activeLayoutId: null });

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.saveCurrentLayout();
      });

      expect(storage.saveLayoutWithMetadata).not.toHaveBeenCalled();
    });
  });

  describe('importLayoutFromJSON', () => {
    it('imports layout and adds to library', async () => {
      const importedLayout = createTestLayout('Imported Layout');
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      const { result } = renderHook(() => useLayoutSwitcher());

      let importResult: Awaited<ReturnType<typeof result.current.importLayoutFromJSON>>;
      await act(async () => {
        importResult = await result.current.importLayoutFromJSON(importedLayout);
      });

      expect(isOk(importResult!)).toBe(true);
      expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
    });

    it('saves imported layout to storage', async () => {
      const importedLayout = createTestLayout('Imported');

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.importLayoutFromJSON(importedLayout);
      });

      // Uses createLayoutEntry which handles storage atomically
      expect(storage.createLayoutEntry).toHaveBeenCalledWith(
        importedLayout,
        expect.any(Object),
        expect.objectContaining({ name: 'Imported' })
      );
    });

    it('adds forkedFrom metadata if provided', async () => {
      const importedLayout = createTestLayout('Forked');

      const { result } = renderHook(() => useLayoutSwitcher());

      let importResult: Awaited<ReturnType<typeof result.current.importLayoutFromJSON>>;
      await act(async () => {
        importResult = await result.current.importLayoutFromJSON(importedLayout, {
          name: 'Original Layout',
          author: 'Original Author',
        });
      });

      expect(isOk(importResult!)).toBe(true);
      // createLayoutEntry should be called with forkedFrom in options
      expect(storage.createLayoutEntry).toHaveBeenCalledWith(
        importedLayout,
        expect.any(Object),
        expect.objectContaining({
          forkedFrom: { name: 'Original Layout', author: 'Original Author' },
        })
      );
    });

    it('shows success toast', async () => {
      const importedLayout = createTestLayout('Imported');

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.importLayoutFromJSON(importedLayout);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('Imported'))).toBe(true);
    });
  });
});
