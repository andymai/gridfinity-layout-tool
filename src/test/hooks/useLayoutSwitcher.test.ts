import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { useToastStore } from '../../store/toast';
import { createDefaultLayout } from '../../constants';
import * as storage from '../../storage';
import type { LayoutLibrary, LayoutEntry, Layout } from '../../types';
import { isOk, isErr } from '../../result';

// Mock the storage module
vi.mock('../../storage', () => ({
  saveLayoutById: vi.fn(),
  saveLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
  loadLayoutById: vi.fn(),
  loadLayoutByIdAsync: vi.fn(),
  deleteLayoutById: vi.fn(),
  deleteLayoutByIdAsync: vi.fn().mockResolvedValue(undefined),
  saveLibrary: vi.fn(),
  computeLayoutPreview: vi.fn(() => ({
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
  })),
  // Other functions that might be imported
  getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
}));

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

    // Reset all stores
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

    useHistoryStore.setState({
      past: [],
      future: [],
    });

    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
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
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(null);

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
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(storage.saveLayoutByIdAsync).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('clears selection on switch', async () => {
      useUIStore.setState({ selectedBinIds: ['bin-1', 'bin-2'] });
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });

    it('clears undo history on switch', async () => {
      useHistoryStore.setState({
        past: [createDefaultLayout()],
        future: [createDefaultLayout()],
      });
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useHistoryStore.getState().past).toEqual([]);
      expect(useHistoryStore.getState().future).toEqual([]);
    });

    it('sets active layer and category from new layout', async () => {
      const targetLayout = createTestLayout('Second');
      targetLayout.layers = [{ id: 'new-layer', name: 'New Layer', height: 5 }];
      targetLayout.categories = [{ id: 'new-cat', name: 'New Cat', color: '#fff' }];
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

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

      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

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

      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      // Should NOT have saved the __shared_preview__ layout
      expect(storage.saveLayoutByIdAsync).not.toHaveBeenCalledWith(
        '__shared_preview__',
        expect.any(Object)
      );
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

      // Should have saved current layout first
      expect(storage.saveLayoutByIdAsync).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
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
      expect(storage.deleteLayoutByIdAsync).toHaveBeenCalledWith(SECOND_LAYOUT_ID);
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
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(createTestLayout('Second'));

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.deleteLayout(TEST_LAYOUT_ID);
      });

      // Should have switched to second layout
      expect(useLayoutStore.getState().activeLayoutId).toBe(SECOND_LAYOUT_ID);
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
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(createTestLayout('Original'));

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
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(null);

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
      vi.mocked(storage.loadLayoutByIdAsync).mockResolvedValue(createTestLayout('Original'));

      const { result } = renderHook(() => useLayoutSwitcher());

      await act(async () => {
        await result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      // Check that saveLayoutByIdAsync was called with a layout with (copy) suffix
      const saveCall = vi.mocked(storage.saveLayoutByIdAsync).mock.calls.find(
        call => call[1].name.includes('(copy)')
      );
      expect(saveCall).toBeDefined();
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

      expect(storage.saveLayoutByIdAsync).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
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

      expect(storage.saveLayoutByIdAsync).not.toHaveBeenCalled();
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

      expect(storage.saveLayoutByIdAsync).toHaveBeenCalledWith(
        expect.any(String),
        importedLayout
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
      if (isOk(importResult!) && importResult!.value) {
        const entry = useLibraryStore.getState().getEntry(importResult!.value);
        expect(entry?.forkedFrom).toEqual({
          name: 'Original Layout',
          author: 'Original Author',
        });
      }
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
