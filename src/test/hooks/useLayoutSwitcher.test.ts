import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { useToastStore } from '../../store/toast';
import { createDefaultLayout } from '../../constants';
import * as storage from '../../utils/storage';
import type { LayoutLibrary, LayoutEntry, Layout } from '../../types';

// Mock the storage module
vi.mock('../../utils/storage', () => ({
  saveLayoutById: vi.fn(),
  loadLayoutById: vi.fn(),
  deleteLayoutById: vi.fn(),
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
    it('switches to target layout successfully', () => {
      const targetLayout = createTestLayout('Second Layout');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: ReturnType<typeof result.current.switchLayout>;
      act(() => {
        switchResult = result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(switchResult!.success).toBe(true);
      expect(useLayoutStore.getState().activeLayoutId).toBe(SECOND_LAYOUT_ID);
    });

    it('returns error for non-existent layout', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: ReturnType<typeof result.current.switchLayout>;
      act(() => {
        switchResult = result.current.switchLayout('non-existent-id');
      });

      expect(switchResult!.success).toBe(false);
      if (!switchResult!.success) {
        expect(switchResult!.error).toBe('Layout not found');
      }
    });

    it('returns error when layout fails to load', () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(null);

      const { result } = renderHook(() => useLayoutSwitcher());

      let switchResult: ReturnType<typeof result.current.switchLayout>;
      act(() => {
        switchResult = result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(switchResult!.success).toBe(false);
      if (!switchResult!.success) {
        expect(switchResult!.error).toBe('Failed to load layout data');
      }
    });

    it('saves current layout before switching', () => {
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(storage.saveLayoutById).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('clears selection on switch', () => {
      useUIStore.setState({ selectedBinIds: ['bin-1', 'bin-2'] });
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().selectedBinIds).toEqual([]);
    });

    it('clears undo history on switch', () => {
      useHistoryStore.setState({
        past: [createDefaultLayout()],
        future: [createDefaultLayout()],
      });
      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useHistoryStore.getState().past).toEqual([]);
      expect(useHistoryStore.getState().future).toEqual([]);
    });

    it('sets active layer and category from new layout', () => {
      const targetLayout = createTestLayout('Second');
      targetLayout.layers = [{ id: 'new-layer', name: 'New Layer', height: 5 }];
      targetLayout.categories = [{ id: 'new-cat', name: 'New Cat', color: '#fff' }];
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().activeLayerId).toBe('new-layer');
      expect(useUIStore.getState().activeCategoryId).toBe('new-cat');
    });

    it('clears sharedLayoutPreview state when switching', () => {
      // Set up shared layout preview state
      const mockLayout = createTestLayout('Shared');
      useUIStore.setState({
        sharedLayoutPreview: mockLayout,
        sharedLayoutOriginalName: 'Shared Layout',
      });

      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      expect(useUIStore.getState().sharedLayoutPreview).toBeNull();
      expect(useUIStore.getState().sharedLayoutOriginalName).toBeNull();
    });

    it('skips saving when current layout is __shared_preview__', () => {
      // Set current layout ID to shared preview
      useLayoutStore.setState({ activeLayoutId: '__shared_preview__' });

      const targetLayout = createTestLayout('Second');
      vi.mocked(storage.loadLayoutById).mockReturnValue(targetLayout);

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.switchLayout(SECOND_LAYOUT_ID);
      });

      // Should NOT have saved the __shared_preview__ layout
      expect(storage.saveLayoutById).not.toHaveBeenCalledWith(
        '__shared_preview__',
        expect.any(Object)
      );
    });
  });

  describe('createNewLayout', () => {
    it('creates new layout and switches to it', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let createResult: ReturnType<typeof result.current.createNewLayout>;
      act(() => {
        createResult = result.current.createNewLayout('My New Layout');
      });

      expect(createResult!.success).toBe(true);
      if (createResult!.success) {
        expect(createResult!.data).toBeDefined();
      }
      expect(useLayoutStore.getState().layout.name).toBe('My New Layout');
    });

    it('saves current layout before creating new', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.createNewLayout('New');
      });

      // Should have saved current layout first
      expect(storage.saveLayoutById).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('adds entry to library', () => {
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.createNewLayout('New Layout');
      });

      expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
    });

    it('shows success toast', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.createNewLayout('New');
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('created'))).toBe(true);
    });

    it('uses default name if none provided', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.createNewLayout();
      });

      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');
    });
  });

  describe('deleteLayout', () => {
    it('deletes layout successfully', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let deleteResult: ReturnType<typeof result.current.deleteLayout>;
      act(() => {
        deleteResult = result.current.deleteLayout(SECOND_LAYOUT_ID);
      });

      expect(deleteResult!.success).toBe(true);
      expect(storage.deleteLayoutById).toHaveBeenCalledWith(SECOND_LAYOUT_ID);
    });

    it('cannot delete the only layout', () => {
      useLibraryStore.setState({
        library: createTestLibrary([createTestEntry(TEST_LAYOUT_ID, 'Only Layout')]),
        isLoaded: true,
        showLayoutManager: false,
      });

      const { result } = renderHook(() => useLayoutSwitcher());

      let deleteResult: ReturnType<typeof result.current.deleteLayout>;
      act(() => {
        deleteResult = result.current.deleteLayout(TEST_LAYOUT_ID);
      });

      expect(deleteResult!.success).toBe(false);
      if (!deleteResult!.success) {
        expect(deleteResult!.error).toBe('Cannot delete the only layout');
      }
    });

    it('switches to another layout when deleting active', () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createTestLayout('Second'));

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.deleteLayout(TEST_LAYOUT_ID);
      });

      // Should have switched to second layout
      expect(useLayoutStore.getState().activeLayoutId).toBe(SECOND_LAYOUT_ID);
    });

    it('shows success toast', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.deleteLayout(SECOND_LAYOUT_ID);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('deleted'))).toBe(true);
    });
  });

  describe('duplicateLayout', () => {
    it('duplicates layout successfully', () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createTestLayout('Original'));

      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: ReturnType<typeof result.current.duplicateLayout>;
      act(() => {
        dupResult = result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      expect(dupResult!.success).toBe(true);
      if (dupResult!.success) {
        expect(dupResult!.data).toBeDefined();
      }
    });

    it('returns error for non-existent layout', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: ReturnType<typeof result.current.duplicateLayout>;
      act(() => {
        dupResult = result.current.duplicateLayout('non-existent');
      });

      expect(dupResult!.success).toBe(false);
      if (!dupResult!.success) {
        expect(dupResult!.error).toBe('Layout not found');
      }
    });

    it('returns error when source layout fails to load', () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(null);

      const { result } = renderHook(() => useLayoutSwitcher());

      let dupResult: ReturnType<typeof result.current.duplicateLayout>;
      act(() => {
        dupResult = result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      expect(dupResult!.success).toBe(false);
      if (!dupResult!.success) {
        expect(dupResult!.error).toBe('Failed to load layout data');
      }
    });

    it('saves duplicated layout with (copy) suffix', () => {
      vi.mocked(storage.loadLayoutById).mockReturnValue(createTestLayout('Original'));

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.duplicateLayout(TEST_LAYOUT_ID);
      });

      // Check that saveLayoutById was called with a layout with (copy) suffix
      const saveCall = vi.mocked(storage.saveLayoutById).mock.calls.find(
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
    it('saves layout to storage', () => {
      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.saveCurrentLayout();
      });

      expect(storage.saveLayoutById).toHaveBeenCalledWith(
        TEST_LAYOUT_ID,
        expect.any(Object)
      );
    });

    it('updates library entry', () => {
      const { result } = renderHook(() => useLayoutSwitcher());
      const beforeModifiedAt = useLibraryStore.getState().getEntry(TEST_LAYOUT_ID)?.modifiedAt;

      act(() => {
        result.current.saveCurrentLayout();
      });

      const afterModifiedAt = useLibraryStore.getState().getEntry(TEST_LAYOUT_ID)?.modifiedAt;
      expect(afterModifiedAt).toBeGreaterThanOrEqual(beforeModifiedAt!);
    });

    it('does nothing if no activeLayoutId', () => {
      useLayoutStore.setState({ activeLayoutId: null });

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.saveCurrentLayout();
      });

      expect(storage.saveLayoutById).not.toHaveBeenCalled();
    });
  });

  describe('importLayoutFromJSON', () => {
    it('imports layout and adds to library', () => {
      const importedLayout = createTestLayout('Imported Layout');
      const entriesBefore = useLibraryStore.getState().library.entries.length;

      const { result } = renderHook(() => useLayoutSwitcher());

      let importResult: ReturnType<typeof result.current.importLayoutFromJSON>;
      act(() => {
        importResult = result.current.importLayoutFromJSON(importedLayout);
      });

      expect(importResult!.success).toBe(true);
      expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore + 1);
    });

    it('saves imported layout to storage', () => {
      const importedLayout = createTestLayout('Imported');

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.importLayoutFromJSON(importedLayout);
      });

      expect(storage.saveLayoutById).toHaveBeenCalledWith(
        expect.any(String),
        importedLayout
      );
    });

    it('adds forkedFrom metadata if provided', () => {
      const importedLayout = createTestLayout('Forked');

      const { result } = renderHook(() => useLayoutSwitcher());

      let importResult: ReturnType<typeof result.current.importLayoutFromJSON>;
      act(() => {
        importResult = result.current.importLayoutFromJSON(importedLayout, {
          name: 'Original Layout',
          author: 'Original Author',
        });
      });

      expect(importResult!.success).toBe(true);
      if (importResult!.success && importResult!.data) {
        const entry = useLibraryStore.getState().getEntry(importResult!.data);
        expect(entry?.forkedFrom).toEqual({
          name: 'Original Layout',
          author: 'Original Author',
        });
      }
    });

    it('shows success toast', () => {
      const importedLayout = createTestLayout('Imported');

      const { result } = renderHook(() => useLayoutSwitcher());

      act(() => {
        result.current.importLayoutFromJSON(importedLayout);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some(t => t.message.includes('Imported'))).toBe(true);
    });
  });
});
