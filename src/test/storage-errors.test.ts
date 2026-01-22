import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutSync,
  loadLayoutSync,
  deleteLayoutSync,
  saveLibrary,
  loadLibrary,
  initializeLayoutLibrary,
  migrateFromLegacyStorage,
  getLayoutStorageKey,
  computeLayoutPreview,
} from '@/core/storage';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import type { Layout, LayoutLibrary } from '@/core/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
      void _;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('storage error handling', () => {
  let defaultLayout: Layout;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    defaultLayout = createDefaultLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveLayoutSync', () => {
    it('saves layout to localStorage with correct key', () => {
      const layoutId = 'test-uuid-123';
      saveLayoutSync(layoutId, defaultLayout);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gridfinity-layout-test-uuid-123',
        JSON.stringify(defaultLayout)
      );
    });

    it('throws error when localStorage quota exceeded', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => saveLayoutSync('test-id', defaultLayout)).toThrow(
        'Storage full. Export your layout to save it.'
      );
    });

    it('throws error on generic storage failure', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage unavailable');
      });

      expect(() => saveLayoutSync('test-id', defaultLayout)).toThrow(
        'Storage full. Export your layout to save it.'
      );
    });
  });

  describe('loadLayoutSync', () => {
    it('returns null for non-existent layout', () => {
      const result = loadLayoutSync('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns layout when valid data exists', () => {
      const layoutId = 'test-layout';
      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        JSON.stringify(defaultLayout)
      );

      const result = loadLayoutSync(layoutId);
      expect(result).not.toBeNull();
      expect(result?.name).toBe(defaultLayout.name);
    });

    it('returns null and logs error for corrupted JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const layoutId = 'corrupted-layout';
      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        'not valid json{{{[['
      );

      const result = loadLayoutSync(layoutId);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('returns null and logs warning for invalid layout structure', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const layoutId = 'invalid-layout';
      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        JSON.stringify({ invalid: 'structure', missing: 'fields' })
      );

      const result = loadLayoutSync(layoutId);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Layout invalid-layout failed validation'),
        expect.anything()
      );
    });

    it('migrates old layout format', () => {
      const layoutId = 'old-layout';
      const oldLayout = {
        ...defaultLayout,
        maxPrintSize: 6, // Old format used grid units
      };
      delete (oldLayout as Record<string, unknown>).printBedSize;
      delete (oldLayout as Record<string, unknown>).gridUnitMm;
      delete (oldLayout as Record<string, unknown>).heightUnitMm;

      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        JSON.stringify(oldLayout)
      );

      const result = loadLayoutSync(layoutId);
      expect(result).not.toBeNull();
      expect(result?.gridUnitMm).toBe(42);
      expect(result?.heightUnitMm).toBe(7);
      expect(result?.printBedSize).toBe(252); // 6 * 42
    });
  });

  describe('deleteLayoutSync', () => {
    it('removes layout from localStorage', () => {
      const layoutId = 'to-delete';
      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        JSON.stringify(defaultLayout)
      );

      deleteLayoutSync(layoutId);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'gridfinity-layout-to-delete'
      );
    });

    it('does not throw when deleting non-existent layout', () => {
      expect(() => deleteLayoutSync('non-existent')).not.toThrow();
    });
  });

  describe('saveLibrary', () => {
    const testLibrary: LayoutLibrary = {
      version: '1.0',
      activeLayoutId: 'test-id',
      settings: {},
      entries: [],
    };

    it('saves library to localStorage', () => {
      saveLibrary(testLibrary);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gridfinity-library-v1',
        JSON.stringify(testLibrary)
      );
    });

    it('throws error when quota exceeded', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveLibrary(testLibrary)).toThrow(
        'Storage full. Export your layouts to save them.'
      );
    });
  });

  describe('loadLibrary', () => {
    it('returns null when no library exists', () => {
      const result = loadLibrary();
      expect(result).toBeNull();
    });

    it('returns null for corrupted library JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.setItem('gridfinity-library-v1', 'invalid json{{{');

      const result = loadLibrary();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('returns null for invalid library structure', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem(
        'gridfinity-library-v1',
        JSON.stringify({ invalid: 'structure' })
      );

      const result = loadLibrary();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('filters out orphaned entries', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create library with entries but don't create the layout data
      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'existing-id',
        settings: {},
        entries: [
          {
            id: 'existing-id',
            name: 'Existing',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
          {
            id: 'orphaned-id',
            name: 'Orphaned',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
        ],
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      // Only create layout for 'existing-id'
      localStorageMock.setItem(
        'gridfinity-layout-existing-id',
        JSON.stringify(defaultLayout)
      );

      const result = loadLibrary();
      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(1);
      expect(result?.entries[0].id).toBe('existing-id');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('orphaned-id listed in library but not found')
      );
    });

    it('updates activeLayoutId when active is orphaned', () => {
      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'orphaned-active',
        settings: {},
        entries: [
          {
            id: 'orphaned-active',
            name: 'Orphaned Active',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
          {
            id: 'valid-id',
            name: 'Valid',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
        ],
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      // Only create layout for 'valid-id'
      localStorageMock.setItem(
        'gridfinity-layout-valid-id',
        JSON.stringify(defaultLayout)
      );

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadLibrary();
      expect(result?.activeLayoutId).toBe('valid-id');
    });
  });

  describe('initializeLayoutLibrary', () => {
    it('creates fresh library when no data exists', () => {
      const { library, activeLayout } = initializeLayoutLibrary();

      expect(library).not.toBeNull();
      expect(library.version).toBe('1.0');
      expect(library.entries).toHaveLength(1);
      expect(activeLayout).not.toBeNull();
      expect(activeLayout.name).toBe('Untitled layout');
    });

    it('loads existing library', () => {
      const layoutId = 'existing-layout';
      const existingLayout: Layout = {
        ...defaultLayout,
        name: 'My Existing Layout',
      };

      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: layoutId,
        settings: {},
        entries: [{
          id: layoutId,
          name: existingLayout.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
        }],
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      localStorageMock.setItem(
        getLayoutStorageKey(layoutId),
        JSON.stringify(existingLayout)
      );

      const result = initializeLayoutLibrary();
      expect(result.activeLayout.name).toBe('My Existing Layout');
    });

    it('recovers when active layout is missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'missing-layout',
        settings: {},
        entries: [
          {
            id: 'missing-layout',
            name: 'Missing',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
          {
            id: 'backup-layout',
            name: 'Backup',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
        ],
      };

      const backupLayout: Layout = {
        ...defaultLayout,
        name: 'Backup Layout',
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      localStorageMock.setItem(
        getLayoutStorageKey('backup-layout'),
        JSON.stringify(backupLayout)
      );

      const result = initializeLayoutLibrary();

      // The orphaned entry filtering in loadLibrary logs this warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-layout listed in library but not found')
      );
      expect(result.activeLayout.name).toBe('Backup Layout');
      expect(result.library.activeLayoutId).toBe('backup-layout');
    });

    it('creates recovery layout when all layouts are corrupted', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'corrupted-1',
        settings: {},
        entries: [
          {
            id: 'corrupted-1',
            name: 'Corrupted 1',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          },
        ],
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      // Layout exists but is corrupted
      localStorageMock.setItem(
        getLayoutStorageKey('corrupted-1'),
        'not valid json{{{['
      );

      const result = initializeLayoutLibrary();

      expect(result.activeLayout.name).toBe('Recovered layout');
      expect(result.library.entries).toHaveLength(1);
    });
  });

  describe('migrateFromLegacyStorage', () => {
    it('returns null when no legacy layout exists', () => {
      const result = migrateFromLegacyStorage();
      expect(result).toBeNull();
    });

    it('migrates legacy layout to library format', () => {
      const legacyLayout: Layout = {
        ...defaultLayout,
        name: 'Legacy Layout',
      };

      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(legacyLayout));

      const result = migrateFromLegacyStorage();

      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(1);
      expect(result?.entries[0].name).toBe('Legacy Layout');
    });

    it('removes legacy key after migration', () => {
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(defaultLayout));

      migrateFromLegacyStorage();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-layout-v1');
    });
  });

  describe('computeLayoutPreview', () => {
    it('computes preview with correct dimensions', () => {
      const layout: Layout = {
        ...defaultLayout,
        drawer: { width: 15, depth: 10, height: 18 },
        layers: [
          { id: 'l1', name: 'Layer 1', height: 3 },
          { id: 'l2', name: 'Layer 2', height: 6 },
        ],
        bins: [
          { id: 'b1', x: 0, y: 0, width: 2, depth: 2, height: 3, layerId: 'l1', category: 'c1', label: '', notes: '' },
          { id: 'b2', x: 3, y: 0, width: 1, depth: 1, height: 3, layerId: 'l1', category: 'c1', label: '', notes: '' },
        ],
      };

      const preview = computeLayoutPreview(layout);

      expect(preview.drawerWidth).toBe(15);
      expect(preview.drawerDepth).toBe(10);
      expect(preview.drawerHeight).toBe(18);
      expect(preview.binCount).toBe(2);
      expect(preview.layerCount).toBe(2);
    });

    it('excludes staged bins from binMap', () => {
      const layout: Layout = {
        ...defaultLayout,
        bins: [
          { id: 'b1', x: 0, y: 0, width: 2, depth: 2, height: 3, layerId: defaultLayout.layers[0].id, category: defaultLayout.categories[0].id, label: '', notes: '' },
          { id: 'b2', x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: STAGING_ID, category: defaultLayout.categories[0].id, label: '', notes: '' },
        ],
      };

      const preview = computeLayoutPreview(layout);

      expect(preview.binCount).toBe(2); // All bins counted
      expect(preview.binMap).toHaveLength(1); // Only non-staged in binMap
    });

    it('maps category colors to bins', () => {
      const layout: Layout = {
        ...defaultLayout,
        categories: [
          { id: 'cat1', name: 'Red', color: '#ff0000' },
          { id: 'cat2', name: 'Blue', color: '#0000ff' },
        ],
        bins: [
          { id: 'b1', x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: defaultLayout.layers[0].id, category: 'cat1', label: '', notes: '' },
          { id: 'b2', x: 1, y: 0, width: 1, depth: 1, height: 3, layerId: defaultLayout.layers[0].id, category: 'cat2', label: '', notes: '' },
        ],
      };

      const preview = computeLayoutPreview(layout);

      expect(preview.binMap?.[0].c).toBe('#ff0000');
      expect(preview.binMap?.[1].c).toBe('#0000ff');
    });

    it('uses fallback color for unknown category', () => {
      const layout: Layout = {
        ...defaultLayout,
        bins: [
          { id: 'b1', x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: defaultLayout.layers[0].id, category: 'unknown-cat', label: '', notes: '' },
        ],
      };

      const preview = computeLayoutPreview(layout);

      expect(preview.binMap?.[0].c).toBe('#6B7280'); // Fallback gray
    });
  });

  describe('getLayoutStorageKey', () => {
    it('generates correct storage key', () => {
      expect(getLayoutStorageKey('abc123')).toBe('gridfinity-layout-abc123');
      expect(getLayoutStorageKey('uuid-test')).toBe('gridfinity-layout-uuid-test');
    });
  });
});
