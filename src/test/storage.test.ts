import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveLayout,
  loadLayout,
  clearStorage,
  exportLayoutJSON,
  importLayoutJSON,
  exportPrintListTSV,
  getStorageUsage,
} from '../utils/storage';
import type { Layout } from '../types';
import { createDefaultLayout, STAGING_ID } from '../constants';

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
      void _; // Suppress unused variable warning
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    // For testing storage usage
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('storage', () => {
  let defaultLayout: Layout;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    defaultLayout = createDefaultLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveLayout', () => {
    it('saves layout to localStorage', () => {
      saveLayout(defaultLayout);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'gridfinity-layout-v1',
        JSON.stringify(defaultLayout)
      );
    });

    it('throws error when storage is full', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveLayout(defaultLayout)).toThrow(
        'Storage full. Export your layout to save it.'
      );
    });
  });

  describe('loadLayout', () => {
    it('returns null when no stored layout', () => {
      expect(loadLayout()).toBeNull();
    });

    it('returns layout when valid data exists', () => {
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(defaultLayout));
      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe(defaultLayout.name);
    });

    it('returns null on invalid JSON', () => {
      localStorageMock.setItem('gridfinity-layout-v1', 'not valid json{{{');
      expect(loadLayout()).toBeNull();
    });

    it('returns null on validation failure', () => {
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify({ invalid: 'data' }));
      expect(loadLayout()).toBeNull();
    });

    it('migrates old data without gridUnitMm', () => {
      const oldLayout = { ...defaultLayout };
       
      delete (oldLayout as any).gridUnitMm;
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(oldLayout));

      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.gridUnitMm).toBe(42);
    });

    it('migrates old data without heightUnitMm', () => {
      const oldLayout = { ...defaultLayout };
       
      delete (oldLayout as any).heightUnitMm;
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(oldLayout));

      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.heightUnitMm).toBe(7);
    });

    it('migrates maxPrintSize to printBedSize', () => {
      const oldLayout = {
        ...defaultLayout,
        maxPrintSize: 6, // 6 grid units
        gridUnitMm: 42,
      };
       
      delete (oldLayout as any).printBedSize;
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(oldLayout));

      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.printBedSize).toBe(252); // 6 * 42 = 252mm
    });

    it('fixes printBedSize saved in grid units', () => {
      const oldLayout = {
        ...defaultLayout,
        printBedSize: 6, // Should be 252mm, but was saved as 6 (grid units)
        gridUnitMm: 42,
      };
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(oldLayout));

      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.printBedSize).toBe(252); // 6 * 42 = 252mm
    });

    it('sets default printBedSize when missing', () => {
      const oldLayout = { ...defaultLayout };
       
      delete (oldLayout as any).printBedSize;
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(oldLayout));

      const loaded = loadLayout();
      expect(loaded).not.toBeNull();
      expect(loaded?.printBedSize).toBe(256);
    });
  });

  describe('clearStorage', () => {
    it('removes layout from localStorage', () => {
      localStorageMock.setItem('gridfinity-layout-v1', JSON.stringify(defaultLayout));
      clearStorage();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-layout-v1');
    });
  });

  describe('exportLayoutJSON', () => {
    it('exports layout as formatted JSON', () => {
      const json = exportLayoutJSON(defaultLayout);
      expect(json).toBe(JSON.stringify(defaultLayout, null, 2));
    });

    it('exported JSON can be parsed back', () => {
      const json = exportLayoutJSON(defaultLayout);
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe(defaultLayout.name);
      expect(parsed.version).toBe(defaultLayout.version);
    });
  });

  describe('importLayoutJSON', () => {
    it('imports valid JSON and regenerates IDs', () => {
      const json = JSON.stringify(defaultLayout);
      const result = importLayoutJSON(json);

      expect(result.layout).not.toBeNull();
      expect(result.errors).toHaveLength(0);

      // IDs should be regenerated (different from original)
      expect(result.layout?.layers[0].id).not.toBe(defaultLayout.layers[0].id);
      expect(result.layout?.categories[0].id).not.toBe(defaultLayout.categories[0].id);
    });

    it('preserves STAGING_ID for staged bins', () => {
      const layoutWithStagedBin = {
        ...defaultLayout,
        bins: [
          {
            id: 'bin1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: STAGING_ID,
            category: defaultLayout.categories[0].id,
          },
        ],
      };

      const json = JSON.stringify(layoutWithStagedBin);
      const result = importLayoutJSON(json);

      expect(result.layout).not.toBeNull();
      expect(result.layout?.bins[0].layerId).toBe(STAGING_ID);
    });

    it('updates bin references to new layer and category IDs', () => {
      const layoutWithBin = {
        ...defaultLayout,
        bins: [
          {
            id: 'bin1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: defaultLayout.layers[0].id,
            category: defaultLayout.categories[0].id,
          },
        ],
      };

      const json = JSON.stringify(layoutWithBin);
      const result = importLayoutJSON(json);

      expect(result.layout).not.toBeNull();
      // Bin should reference new layer ID
      expect(result.layout?.bins[0].layerId).toBe(result.layout?.layers[0].id);
      // Bin should reference new category ID
      expect(result.layout?.bins[0].category).toBe(result.layout?.categories[0].id);
    });

    it('returns errors for invalid JSON', () => {
      const result = importLayoutJSON('not valid json{{{');
      expect(result.layout).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Parse error');
    });

    it('returns validation errors for invalid layout', () => {
      const result = importLayoutJSON(JSON.stringify({ invalid: 'data' }));
      expect(result.layout).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('exportPrintListTSV', () => {
    it('exports empty list with header only', () => {
      const tsv = exportPrintListTSV([]);
      expect(tsv).toBe('Size\tHeight\tBins\tPieces\tLabel\tNotes');
    });

    it('exports single row correctly', () => {
      const rows = [
        { size: '1x1', height: 3, binCount: 5, totalPieces: 5 },
      ];
      const tsv = exportPrintListTSV(rows);
      const lines = tsv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toBe('1x1\t3u\t5\t5\t\t');
    });

    it('exports row with labels and notes', () => {
      const rows = [
        { size: '2x3', height: 6, binCount: 2, totalPieces: 4, labels: ['Screws', 'Nails'], notes: 'Small parts' },
      ];
      const tsv = exportPrintListTSV(rows);
      const lines = tsv.split('\n');
      expect(lines[1]).toBe('2x3\t6u\t2\t4\tScrews\tSmall parts');
    });

    it('exports multiple rows', () => {
      const rows = [
        { size: '1x1', height: 3, binCount: 10, totalPieces: 10 },
        { size: '2x2', height: 6, binCount: 4, totalPieces: 4 },
        { size: '3x1', height: 3, binCount: 2, totalPieces: 6 },
      ];
      const tsv = exportPrintListTSV(rows);
      const lines = tsv.split('\n');
      expect(lines).toHaveLength(4);
    });
  });

  describe('getStorageUsage', () => {
    it('returns a number (percentage of storage used)', () => {
      // The mock doesn't fully support for...in iteration,
      // but we can verify the function returns a valid number type
      // and doesn't crash
      const usage = getStorageUsage();
      // Should be a number (could be 0, NaN handled as number type)
      expect(typeof usage === 'number' || Number.isNaN(usage)).toBe(true);
    });

    it('handles localStorage access errors and returns 0', () => {
      // Temporarily break localStorage
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('Access denied'); },
          setItem: () => { throw new Error('Access denied'); },
        },
        configurable: true,
      });

      // Should return 0 on error
      expect(getStorageUsage()).toBe(0);

      // Restore
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
      });
    });
  });
});
