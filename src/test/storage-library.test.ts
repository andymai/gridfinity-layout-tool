import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutById,
  loadLayoutById,
  deleteLayoutById,
  saveLibrary,
  loadLibrary,
  computeLayoutPreview,
  hasLegacyLayout,
  migrateFromLegacyStorage,
  initializeLayoutLibrary,
  getLayoutStorageKey,
} from '../utils/storage';
import { createDefaultLayout } from '../constants';
import type { Layout, LayoutLibrary, LayoutEntry } from '../types';

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
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getLayoutStorageKey', () => {
    it('returns prefixed key', () => {
      expect(getLayoutStorageKey('abc-123')).toBe('gridfinity-layout-abc-123');
    });
  });

  describe('saveLayoutById', () => {
    it('saves layout to localStorage with correct key', () => {
      const layout = createTestLayout();

      saveLayoutById('test-id', layout);

      const stored = localStorage.getItem('gridfinity-layout-test-id');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).name).toBe('Test Layout');
    });

    it('overwrites existing layout', () => {
      const layout1 = createTestLayout('First');
      const layout2 = createTestLayout('Second');

      saveLayoutById('test-id', layout1);
      saveLayoutById('test-id', layout2);

      const stored = JSON.parse(localStorage.getItem('gridfinity-layout-test-id')!);
      expect(stored.name).toBe('Second');
    });

    it('throws when storage quota exceeded', () => {
      // Mock localStorage.setItem to throw
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const layout = createTestLayout();

      expect(() => saveLayoutById('test-id', layout)).toThrow('Storage full');

      mockSetItem.mockRestore();
    });
  });

  describe('loadLayoutById', () => {
    it('loads and returns layout', () => {
      const layout = createTestLayout('My Layout');
      saveLayoutById('test-id', layout);

      const loaded = loadLayoutById('test-id');

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('My Layout');
    });

    it('returns null for non-existent id', () => {
      const loaded = loadLayoutById('non-existent');

      expect(loaded).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('gridfinity-layout-corrupt', 'not valid json {{{');

      const loaded = loadLayoutById('corrupt');

      expect(loaded).toBeNull();
    });

    it('returns null for invalid layout structure', () => {
      // Missing required fields
      localStorage.setItem('gridfinity-layout-invalid', JSON.stringify({
        version: '1.0',
        name: 'Invalid',
        // Missing drawer, layers, categories, bins
      }));

      const loaded = loadLayoutById('invalid');

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

      const loaded = loadLayoutById('old');

      expect(loaded).not.toBeNull();
      expect(loaded!.gridUnitMm).toBe(42); // Default value
      expect(loaded!.heightUnitMm).toBe(7); // Default value
    });
  });

  describe('deleteLayoutById', () => {
    it('removes layout from localStorage', () => {
      const layout = createTestLayout();
      saveLayoutById('test-id', layout);

      deleteLayoutById('test-id');

      expect(localStorage.getItem('gridfinity-layout-test-id')).toBeNull();
    });

    it('does not throw for non-existent id', () => {
      expect(() => deleteLayoutById('non-existent')).not.toThrow();
    });
  });

  describe('saveLibrary', () => {
    it('saves library to localStorage', () => {
      const library = createTestLibrary(2);

      saveLibrary(library);

      const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).entries).toHaveLength(2);
    });

    it('throws when storage quota exceeded', () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const library = createTestLibrary();

      expect(() => saveLibrary(library)).toThrow('Storage full');

      mockSetItem.mockRestore();
    });
  });

  describe('loadLibrary', () => {
    it('loads and returns library', () => {
      const library = createTestLibrary(3);
      // Also save the layouts themselves so orphan cleanup doesn't remove them
      library.entries.forEach(entry => {
        saveLayoutById(entry.id, createTestLayout(entry.name));
      });
      saveLibrary(library);

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
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({
        // Missing required fields
        entries: [],
      }));

      const loaded = loadLibrary();

      expect(loaded).toBeNull();
    });

    it('removes orphaned entries (entry in library but layout missing)', () => {
      const library = createTestLibrary(3);
      // Only save layout for first entry
      saveLayoutById('layout-0', createTestLayout('Layout 0'));
      saveLibrary(library);

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.entries).toHaveLength(1);
      expect(loaded!.entries[0].id).toBe('layout-0');
    });

    it('updates activeLayoutId if active was orphaned', () => {
      const library = createTestLibrary(3);
      library.activeLayoutId = 'layout-2'; // This one will be orphaned
      // Only save layout for first entry
      saveLayoutById('layout-0', createTestLayout('Layout 0'));
      saveLibrary(library);

      const loaded = loadLibrary();

      expect(loaded).not.toBeNull();
      expect(loaded!.activeLayoutId).toBe('layout-0'); // Switched to first available
    });
  });

  describe('computeLayoutPreview', () => {
    it('computes correct preview', () => {
      const layout = createTestLayout();
      layout.drawer = { width: 15, depth: 12, height: 10 };
      layout.bins = [
        { id: '1', x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: 'l1', category: 'cat1', label: '', notes: '' },
        { id: '2', x: 1, y: 0, width: 1, depth: 1, height: 3, layerId: 'l1', category: 'cat1', label: '', notes: '' },
        { id: '3', x: 2, y: 0, width: 1, depth: 1, height: 3, layerId: 'l1', category: 'cat1', label: '', notes: '' },
      ];
      layout.layers = [
        { id: 'l1', name: 'L1', height: 3 },
        { id: 'l2', name: 'L2', height: 5 },
      ];

      const preview = computeLayoutPreview(layout);

      expect(preview).toEqual({
        drawerWidth: 15,
        drawerDepth: 12,
        drawerHeight: 10,
        binCount: 3,
        layerCount: 2,
      });
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
      const loaded = loadLayoutById(library!.activeLayoutId);
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
    it('returns existing library if present', () => {
      const library = createTestLibrary(2);
      library.entries.forEach(entry => {
        saveLayoutById(entry.id, createTestLayout(entry.name));
      });
      saveLibrary(library);

      const result = initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(2);
    });

    it('migrates from legacy storage if no library', () => {
      const legacyLayout = createTestLayout('Migrated Layout');
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLayout));

      const result = initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(1);
      expect(result.library.entries[0].name).toBe('Migrated Layout');
      expect(result.activeLayout.name).toBe('Migrated Layout');
    });

    it('creates default library if nothing exists', () => {
      const result = initializeLayoutLibrary();

      expect(result.library.entries).toHaveLength(1);
      expect(result.library.entries[0].name).toBe('Untitled layout');
      expect(result.activeLayout.name).toBe('Untitled layout');
    });

    it('recovers if active layout is missing', () => {
      const library = createTestLibrary(2);
      // Only save the second layout, not the first (which is active)
      saveLayoutById('layout-1', createTestLayout('Layout 1'));
      saveLibrary(library);

      const result = initializeLayoutLibrary();

      // Should recover to the available layout
      expect(result.library.activeLayoutId).toBe('layout-1');
      expect(result.activeLayout.name).toBe('Layout 1');
    });

    it('creates fresh layout if all layouts are missing', () => {
      const library = createTestLibrary(2);
      // Don't save any layouts, just the library index
      saveLibrary(library);

      const result = initializeLayoutLibrary();

      // Should create a recovered layout
      expect(result.activeLayout.name).toBe('Recovered layout');
      expect(result.library.entries).toHaveLength(1);
    });

    it('saves recovered state to storage', () => {
      const library = createTestLibrary(1);
      // Don't save the actual layout
      saveLibrary(library);

      initializeLayoutLibrary();

      // Should be able to reload
      const reloaded = loadLibrary();
      expect(reloaded).not.toBeNull();
      expect(reloaded!.entries).toHaveLength(1);
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
        saveLayoutById(`rapid-${i}`, layout);
      });

      // Rapid loads
      const loaded = layouts.map((_, i) => loadLayoutById(`rapid-${i}`));

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
      saveLayoutById('id-1', layout1);
      const loaded1 = loadLayoutById('id-1');
      saveLayoutById('id-2', layout2);
      deleteLayoutById('id-1');
      const loaded1After = loadLayoutById('id-1');
      const loaded2 = loadLayoutById('id-2');

      expect(loaded1).not.toBeNull();
      expect(loaded1After).toBeNull();
      expect(loaded2).not.toBeNull();
    });
  });
});
