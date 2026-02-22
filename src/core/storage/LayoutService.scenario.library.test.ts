import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutSync,
  loadLayoutSync,
  loadLayoutAsync,
  deleteLayoutSync,
  saveLibrary,
  loadLibrary,
  hasLegacyLayout,
  migrateFromLegacyStorage,
  initializeLayoutLibrary,
  getLayoutStorageKey,
} from '@/core/storage';
import { createDefaultLayout } from '@/core/constants';
import type { Layout, LayoutLibrary, LayoutEntry } from '@/core/types';
import { clearAllData as clearIndexedDB, closeDatabase } from '@/core/storage/backends/indexedDB';
import { resetStorageBackendCache } from '@/core/storage/backend';

const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
const LEGACY_STORAGE_KEY = 'gridfinity-layout-v1';

function createTestLayout(name = 'Test Layout'): Layout {
  const layout = createDefaultLayout();
  layout.name = name;
  return layout;
}

function createTestLibrary(entryCount = 1): LayoutLibrary {
  const entries: LayoutEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      id: `layout-${i}`,
      name: `Test Layout ${i}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: i,
        layerCount: 1,
      },
    });
  }

  return {
    version: '1.0',
    activeLayoutId: entries[0]?.id || '',
    settings: {},
    entries,
  };
}

describe('storage-library', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Close DB and drain pending fire-and-forget writes before deleting
    closeDatabase();
    await new Promise((r) => setTimeout(r, 0));
    clearIndexedDB();
    resetStorageBackendCache();
  });

  afterEach(async () => {
    localStorage.clear();
    closeDatabase();
    await new Promise((r) => setTimeout(r, 0));
    clearIndexedDB();
    resetStorageBackendCache();
    vi.restoreAllMocks();
  });

  describe('getLayoutStorageKey', () => {
    it('returns prefixed key', () => {
      expect(getLayoutStorageKey('abc-123')).toBe('gridfinity-layout-abc-123');
    });
  });

  describe('saveLayoutSync', () => {
    it('saves layout to localStorage with correct key', () => {
      const layout = createTestLayout();

      saveLayoutSync('test-id', layout);

      const stored = localStorage.getItem('gridfinity-layout-test-id');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).name).toBe('Test Layout');
    });

    it('overwrites existing layout', () => {
      const layout1 = createTestLayout('First');
      const layout2 = createTestLayout('Second');

      saveLayoutSync('test-id', layout1);
      saveLayoutSync('test-id', layout2);

      const stored = JSON.parse(localStorage.getItem('gridfinity-layout-test-id')!);
      expect(stored.name).toBe('Second');
    });

    it('returns Err when storage quota exceeded', () => {
      // Mock localStorage.setItem to throw
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const layout = createTestLayout();

      const result = saveLayoutSync('test-id', layout);
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
        })
      );

      mockSetItem.mockRestore();
    });
  });

  describe('loadLayoutSync', () => {
    it('loads and returns layout', () => {
      const layout = createTestLayout('My Layout');
      saveLayoutSync('test-id', layout);

      const loaded = loadLayoutSync('test-id');

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('My Layout');
    });

    it('returns null for non-existent id', () => {
      const loaded = loadLayoutSync('non-existent');

      expect(loaded).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('gridfinity-layout-corrupt', 'not valid json {{{');

      const loaded = loadLayoutSync('corrupt');

      expect(loaded).toBeNull();
    });

    it('returns null for invalid layout structure', () => {
      // Missing required fields
      localStorage.setItem(
        'gridfinity-layout-invalid',
        JSON.stringify({
          version: '1.0',
          name: 'Invalid',
          // Missing drawer, layers, categories, bins
        })
      );

      const loaded = loadLayoutSync('invalid');

      expect(loaded).toBeNull();
    });

    it('migrates old layout format', () => {
      // Old format without gridUnitMm
      const oldLayout = {
        version: '1.0',
        name: 'Old Layout',
        drawer: { width: 10, depth: 8, height: 12 },
        categories: [{ id: 'cat1', name: 'Test', color: '#fff' }],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [],
        // Missing gridUnitMm, heightUnitMm, printBedSize
      };
      localStorage.setItem('gridfinity-layout-old', JSON.stringify(oldLayout));

      const loaded = loadLayoutSync('old');

      expect(loaded).not.toBeNull();
      expect(loaded!.gridUnitMm).toBe(42); // Default value
      expect(loaded!.heightUnitMm).toBe(7); // Default value
    });
  });

  describe('deleteLayoutSync', () => {
    it('removes layout from localStorage', () => {
      const layout = createTestLayout();
      saveLayoutSync('test-id', layout);

      deleteLayoutSync('test-id');

      expect(localStorage.getItem('gridfinity-layout-test-id')).toBeNull();
    });

    it('does not throw for non-existent id', () => {
      expect(() => deleteLayoutSync('non-existent')).not.toThrow();
    });
  });

  describe('saveLibrary', () => {
    it('fires off async IndexedDB write (returns void)', () => {
      const library = createTestLibrary(2);

      // saveLibrary now returns void and writes to IndexedDB asynchronously
      const result = saveLibrary(library);
      expect(result).toBeUndefined();
    });

    it('does not throw when called normally', () => {
      const library = createTestLibrary();

      expect(() => saveLibrary(library)).not.toThrow();
    });
  });

  describe('loadLibrary', () => {
    it('loads and returns library', () => {
      const library = createTestLibrary(3);
      // Also save the layouts themselves so orphan cleanup doesn't remove them
      library.entries.forEach((entry) => {
        saveLayoutSync(entry.id, createTestLayout(entry.name));
      });
      // Write directly to localStorage since saveLibrary now writes to IndexedDB async
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.entries).toHaveLength(3);
    });

    it('returns null for non-existent library', () => {
      const loaded = loadLibrary();

      expect(loaded).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem(LIBRARY_STORAGE_KEY, 'invalid json');

      const loaded = loadLibrary();

      expect(loaded).toBeNull();
    });

    it('returns null for invalid library structure', () => {
      localStorage.setItem(
        LIBRARY_STORAGE_KEY,
        JSON.stringify({
          // Missing required fields
          entries: [],
        })
      );

      const loaded = loadLibrary();

      expect(loaded).toBeNull();
    });

    it('returns all entries even if layouts are missing (orphan cleanup is deferred)', () => {
      const library = createTestLibrary(3);
      // Only save layout for first entry — loadLibrary no longer filters orphans
      saveLayoutSync('layout-0', createTestLayout('Layout 0'));
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      // loadLibrary now only validates structure, does not check layout existence
      expect(loaded).not.toBeNull();
      expect(loaded!.entries).toHaveLength(3);
    });

    it('preserves activeLayoutId even if layout data is missing', () => {
      const library = createTestLibrary(3);
      library.activeLayoutId = 'layout-2';
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.activeLayoutId).toBe('layout-2');
    });

    it('returns library even when no layout data exists', () => {
      const library = createTestLibrary(3);
      // Don't save any layout data — loadLibrary only validates structure
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      // loadLibrary validates structure only; orphan cleanup is in reconcileLibraryAsync
      expect(loaded).not.toBeNull();
      expect(loaded!.entries).toHaveLength(3);
    });
  });

  describe('hasLegacyLayout', () => {
    it('returns true when legacy key exists', () => {
      localStorage.setItem(LEGACY_STORAGE_KEY, '{}');

      expect(hasLegacyLayout()).toBe(true);
    });

    it('returns false when legacy key does not exist', () => {
      expect(hasLegacyLayout()).toBe(false);
    });
  });

  describe('migrateFromLegacyStorage', () => {
    it('returns null if no legacy layout', () => {
      const result = migrateFromLegacyStorage();

      expect(result).toBeNull();
    });

    it('migrates valid legacy layout to library', () => {
      const legacyLayout = createTestLayout('Legacy Layout');
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLayout));

      const library = migrateFromLegacyStorage();

      expect(library).not.toBeNull();
      expect(library!.entries).toHaveLength(1);
      expect(library!.entries[0].name).toBe('Legacy Layout');
    });

    it('removes legacy key after migration', () => {
      const legacyLayout = createTestLayout();
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLayout));

      migrateFromLegacyStorage();

      expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    });

    it('saves migrated layout under new key', () => {
      const legacyLayout = createTestLayout('Legacy');
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLayout));

      const library = migrateFromLegacyStorage();

      // Should be able to load it with new system
      const loaded = loadLayoutSync(library!.activeLayoutId);
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Legacy');
    });

    it('returns null for corrupted legacy layout', () => {
      localStorage.setItem(LEGACY_STORAGE_KEY, 'not valid json');

      const result = migrateFromLegacyStorage();

      expect(result).toBeNull();
    });
  });

  describe('initializeLayoutLibrary', () => {
    it('returns existing library if present', async () => {
      const library = createTestLibrary(2);
      library.entries.forEach((entry) => {
        saveLayoutSync(entry.id, createTestLayout(entry.name));
      });
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const result = await initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(2);
    });

    it('migrates from legacy storage if no library', async () => {
      const legacyLayout = createTestLayout('Migrated Layout');
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLayout));

      const result = await initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(1);
      expect(result.library.entries[0].name).toBe('Migrated Layout');
      expect(result.activeLayout.name).toBe('Migrated Layout');
    });

    it('creates default library if nothing exists', async () => {
      const result = await initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(1);
      expect(result.library.entries[0].name).toBe('Untitled layout');
      expect(result.activeLayout.name).toBe('Untitled layout');
    });

    it('recovers if active layout is missing', async () => {
      const library = createTestLibrary(2);
      // Only save the second layout, not the first (which is active)
      saveLayoutSync('layout-1', createTestLayout('Layout 1'));
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const result = await initializeLayoutLibrary();

      // Should recover to the available layout
      expect(result.library.activeLayoutId).toBe('layout-1');
      expect(result.activeLayout.name).toBe('Layout 1');
    });

    it('creates fresh layout if all layouts are missing', async () => {
      const library = createTestLibrary(2);
      // Don't save any layouts, just the library index in localStorage
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const result = await initializeLayoutLibrary();

      // initializeLayoutLibrary tries to load each layout, fails, and creates a recovered layout
      expect(result.activeLayout.name).toBe('Recovered layout');
      expect(result.library.entries).toHaveLength(1);
    });

    it('saves recovered state to storage', async () => {
      // Start with nothing — initializeLayoutLibrary creates a fresh library
      const result = await initializeLayoutLibrary();

      // The newly created layout is saved to IndexedDB (primary storage)
      const activeId = result.library.activeLayoutId;
      const loaded = await loadLayoutAsync(activeId);
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Untitled layout');
    });
  });

  describe('concurrent access simulation', () => {
    it('handles rapid save/load cycles', () => {
      const layouts: Layout[] = [];
      for (let i = 0; i < 10; i++) {
        layouts.push(createTestLayout(`Layout ${i}`));
      }

      // Rapid saves
      layouts.forEach((layout, i) => {
        saveLayoutSync(`rapid-${i}`, layout);
      });

      // Rapid loads
      const loaded = layouts.map((_, i) => loadLayoutSync(`rapid-${i}`));

      // All should be loaded correctly
      loaded.forEach((layout, i) => {
        expect(layout).not.toBeNull();
        expect(layout!.name).toBe(`Layout ${i}`);
      });
    });

    it('handles interleaved operations', () => {
      const layout1 = createTestLayout('Layout 1');
      const layout2 = createTestLayout('Layout 2');

      // Interleaved operations
      saveLayoutSync('id-1', layout1);
      const loaded1 = loadLayoutSync('id-1');
      saveLayoutSync('id-2', layout2);
      deleteLayoutSync('id-1');
      const loaded1After = loadLayoutSync('id-1');
      const loaded2 = loadLayoutSync('id-2');

      expect(loaded1).not.toBeNull();
      expect(loaded1After).toBeNull();
      expect(loaded2).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles special characters in layout ID', () => {
      const layout = createTestLayout('Special');
      const specialId = 'id-with-special_chars.and-dots';

      saveLayoutSync(specialId, layout);
      const loaded = loadLayoutSync(specialId);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Special');
    });

    it('handles very long layout ID', () => {
      const layout = createTestLayout('Long ID');
      const longId = 'a'.repeat(200);

      saveLayoutSync(longId, layout);
      const loaded = loadLayoutSync(longId);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Long ID');
    });

    it('handles empty string layout ID', () => {
      const layout = createTestLayout('Empty ID');

      saveLayoutSync('', layout);
      const loaded = loadLayoutSync('');

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Empty ID');
    });

    it('handles layout with many bins', () => {
      const layout = createTestLayout('Many Bins');
      // Use actual layer and category IDs from the layout
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      // Expand drawer to fit 100 bins (10x10 grid)
      layout.drawer = { width: 10, depth: 10, height: 12 };

      layout.bins = [];
      for (let i = 0; i < 100; i++) {
        layout.bins.push({
          id: `bin-${i}`,
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          depth: 1,
          height: 3,
          layerId,
          category: categoryId,
          label: `Bin ${i}`,
          notes: '',
        });
      }

      saveLayoutSync('many-bins', layout);
      const loaded = loadLayoutSync('many-bins');

      expect(loaded).not.toBeNull();
      expect(loaded!.bins).toHaveLength(100);
    });

    it('preserves library settings through save/load cycle', () => {
      const library = createTestLibrary(2);
      library.settings = { authorName: 'Test Author' };
      library.entries.forEach((entry) => {
        saveLayoutSync(entry.id, createTestLayout(entry.name));
      });
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.settings.authorName).toBe('Test Author');
    });

    it('handles library with single entry correctly', () => {
      const library = createTestLibrary(1);
      saveLayoutSync('layout-0', createTestLayout('Only Layout'));
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.entries).toHaveLength(1);
      expect(loaded!.activeLayoutId).toBe('layout-0');
    });

    it('handles layout with unicode characters in name', () => {
      const layout = createTestLayout('レイアウト 🎨 émoji');

      saveLayoutSync('unicode', layout);
      const loaded = loadLayoutSync('unicode');

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('レイアウト 🎨 émoji');
    });

    it('handles layout with clearanceHeight on bins', () => {
      const layout = createTestLayout('Clearance');
      const layerId = layout.layers[0].id;
      const categoryId = layout.categories[0].id;

      layout.bins = [
        {
          id: 'bin-1',
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          layerId,
          category: categoryId,
          label: '',
          notes: '',
          clearanceHeight: 5,
        },
      ];

      saveLayoutSync('clearance', layout);
      const loaded = loadLayoutSync('clearance');

      expect(loaded).not.toBeNull();
      expect(loaded!.bins[0].clearanceHeight).toBe(5);
    });
  });
});
