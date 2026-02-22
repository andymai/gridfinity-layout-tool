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
} from '@/core/storage';
import { createDefaultLayout } from '@/core/constants';
import type { Layout, LayoutLibrary } from '@/core/types';

// Mock IndexedDB backend (saveLibrary now fires off to IndexedDB)
vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLibraryIndex: vi.fn().mockResolvedValue(undefined),
  loadLibraryIndex: vi.fn().mockResolvedValue(null),
  saveLayout: vi.fn().mockResolvedValue(undefined),
  loadLayout: vi.fn().mockResolvedValue(null),
  deleteLayout: vi.fn().mockResolvedValue(undefined),
  getAllLayoutIds: vi.fn().mockResolvedValue([]),
  isIndexedDBAvailable: vi.fn().mockResolvedValue(false),
}));

// Mock librarySync (used by saveLibrary fire-and-forget)
vi.mock('@/core/storage/librarySync', () => ({
  notifyLibraryChanged: vi.fn(),
}));

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

    it('returns Err when localStorage quota exceeded', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const result = saveLayoutSync('test-id', defaultLayout);
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
        })
      );
    });

    it('returns Err on generic storage failure', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage unavailable');
      });

      const result = saveLayoutSync('test-id', defaultLayout);
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
        })
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
      localStorageMock.setItem(getLayoutStorageKey(layoutId), JSON.stringify(defaultLayout));

      const result = loadLayoutSync(layoutId);
      expect(result).not.toBeNull();
      expect(result?.name).toBe(defaultLayout.name);
    });

    it('returns null for corrupted JSON', () => {
      const layoutId = 'corrupted-layout';
      localStorageMock.setItem(getLayoutStorageKey(layoutId), 'not valid json{{{[[');

      const result = loadLayoutSync(layoutId);
      expect(result).toBeNull();
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

      localStorageMock.setItem(getLayoutStorageKey(layoutId), JSON.stringify(oldLayout));

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
      localStorageMock.setItem(getLayoutStorageKey(layoutId), JSON.stringify(defaultLayout));

      deleteLayoutSync(layoutId);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-layout-to-delete');
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

    it('writes activeLayoutId to localStorage', () => {
      saveLibrary(testLibrary);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gridfinity-library-active-id',
        'test-id'
      );
    });

    it('returns void (fire-and-forget to IndexedDB)', () => {
      const result = saveLibrary(testLibrary);
      expect(result).toBeUndefined();
    });
  });

  describe('loadLibrary', () => {
    it('returns null when no library exists', () => {
      const result = loadLibrary();
      expect(result).toBeNull();
    });

    it('returns null for corrupted library JSON', () => {
      localStorageMock.setItem('gridfinity-library-v1', 'invalid json{{{');

      const result = loadLibrary();
      expect(result).toBeNull();
    });

    it('returns null for invalid library structure', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify({ invalid: 'structure' }));

      const result = loadLibrary();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('returns all entries without orphan filtering (deferred to reconcileLibraryAsync)', () => {
      // loadLibrary no longer checks per-entry existence; orphan cleanup
      // is deferred to reconcileLibraryAsync() after mount.
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
            preview: {
              drawerWidth: 10,
              drawerDepth: 8,
              drawerHeight: 12,
              binCount: 0,
              layerCount: 1,
            },
          },
          {
            id: 'orphaned-id',
            name: 'Orphaned',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
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

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));

      const result = loadLibrary();
      expect(result).not.toBeNull();
      // Both entries are returned — no orphan filtering at load time
      expect(result?.entries).toHaveLength(2);
    });

    it('fixes activeLayoutId when it does not reference any entry', () => {
      // validateLibraryStructure still ensures activeLayoutId references a valid entry
      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: 'non-existent-id',
        settings: {},
        entries: [
          {
            id: 'valid-id',
            name: 'Valid',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
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

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));

      const result = loadLibrary();
      expect(result?.activeLayoutId).toBe('valid-id');
    });
  });

  describe('initializeLayoutLibrary', () => {
    it('creates fresh library when no data exists', async () => {
      const { library, activeLayout } = await initializeLayoutLibrary();

      expect(library).not.toBeNull();
      expect(library.version).toBe('1.0');
      expect(library.entries).toHaveLength(1);
      expect(activeLayout).not.toBeNull();
      expect(activeLayout.name).toBe('Untitled layout');
    });

    it('loads existing library', async () => {
      const layoutId = 'existing-layout';
      const existingLayout: Layout = {
        ...defaultLayout,
        name: 'My Existing Layout',
      };

      const library: LayoutLibrary = {
        version: '1.0',
        activeLayoutId: layoutId,
        settings: {},
        entries: [
          {
            id: layoutId,
            name: existingLayout.name,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
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

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      localStorageMock.setItem(getLayoutStorageKey(layoutId), JSON.stringify(existingLayout));

      const result = await initializeLayoutLibrary();
      expect(result.activeLayout.name).toBe('My Existing Layout');
    });

    it('recovers when active layout is missing', async () => {
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
            preview: {
              drawerWidth: 10,
              drawerDepth: 8,
              drawerHeight: 12,
              binCount: 0,
              layerCount: 1,
            },
          },
          {
            id: 'backup-layout',
            name: 'Backup',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
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

      const backupLayout: Layout = {
        ...defaultLayout,
        name: 'Backup Layout',
      };

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      localStorageMock.setItem(getLayoutStorageKey('backup-layout'), JSON.stringify(backupLayout));

      const result = await initializeLayoutLibrary();

      // initializeLayoutLibrary now warns when the active layout is not found
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing-layout'));
      expect(result.activeLayout.name).toBe('Backup Layout');
      expect(result.library.activeLayoutId).toBe('backup-layout');
    });

    it('creates fresh layout when all layouts are corrupted', async () => {
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

      localStorageMock.setItem('gridfinity-library-v1', JSON.stringify(library));
      // Layout exists but is corrupted
      localStorageMock.setItem(getLayoutStorageKey('corrupted-1'), 'not valid json{{{[');

      const result = await initializeLayoutLibrary();

      // When the active layout is corrupted and no other entries can be loaded,
      // initializeLayoutLibrary creates a recovered layout
      expect(result.activeLayout).toBeDefined();
      expect(result.library.entries.length).toBeGreaterThanOrEqual(1);
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

  describe('getLayoutStorageKey', () => {
    it('generates correct storage key', () => {
      expect(getLayoutStorageKey('abc123')).toBe('gridfinity-layout-abc123');
      expect(getLayoutStorageKey('uuid-test')).toBe('gridfinity-layout-uuid-test');
    });
  });
});
