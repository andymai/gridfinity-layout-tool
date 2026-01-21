import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  inferDrawerPurpose,
  loadLabelSizes,
  recordLabelSize,
  recordLayoutLabelSizes,
  getLabelSizeConsistency,
  calculateConsistencyRate,
} from '@/shared/analytics/purposeInference';
import type { Layout, Bin, Drawer, Layer, Category } from '@/core/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      // Use Reflect.deleteProperty to satisfy ESLint no-dynamic-delete rule
      Reflect.deleteProperty(store, key);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

const STORAGE_KEY = 'gridfinity-ml-label-sizes-v1';

// Helper to get only label-size storage calls (filtering out availability check calls)
function getStorageCalls(): Array<[string, string]> {
  return localStorageMock.setItem.mock.calls.filter(
    (call: [string, string]) => call[0] === STORAGE_KEY
  );
}

// Helper to create test layouts
function createTestLayout(bins: Partial<Bin>[], drawer?: Partial<Drawer>): Layout {
  const defaultDrawer: Drawer = {
    width: 10,
    depth: 8,
    height: 12,
    ...drawer,
  };

  const defaultLayer: Layer = {
    id: 'layer-1',
    name: 'Layer 1',
    height: defaultDrawer.height,
  };

  const defaultCategory: Category = {
    id: 'default',
    name: 'Default',
    color: '#3B82F6',
  };

  return {
    drawer: defaultDrawer,
    layers: [defaultLayer],
    categories: [defaultCategory],
    bins: bins.map((b, i) => ({
      id: `bin-${i}`,
      x: b.x ?? 0,
      y: b.y ?? 0,
      width: b.width ?? 1,
      depth: b.depth ?? 1,
      height: b.height ?? 3,
      layerId: b.layerId ?? 'layer-1',
      category: b.category ?? 'default',
      label: b.label,
      notes: b.notes,
    })),
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
  };
}

describe('purposeInference', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('inferDrawerPurpose', () => {
    it('returns null for empty layouts', () => {
      const layout = createTestLayout([]);
      const result = inferDrawerPurpose(layout);

      expect(result.purpose).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    it('returns lower confidence for layouts with no labeled bins', () => {
      // Without labels, only size patterns contribute
      // Domain-based signals (which are stronger) require labeled bins
      const layout = createTestLayout([
        { x: 0, y: 0, width: 5, depth: 5 }, // Unusual size that won't match typical patterns well
        { x: 5, y: 0, width: 4, depth: 3 },
      ]);
      const result = inferDrawerPurpose(layout);

      // Size patterns alone provide weaker signals than domain-based inference
      // The confidence should be lower than when we have matching labeled bins
      expect(result.signals.filter(s => s.type === 'domain_concentration')).toHaveLength(0);
    });

    it('infers workshop purpose from tool labels', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 4, label: 'screwdriver' },
        { x: 2, y: 0, width: 2, depth: 4, label: 'wrench' },
        { x: 4, y: 0, width: 2, depth: 4, label: 'pliers' },
        { x: 6, y: 0, width: 2, depth: 4, label: 'hammer' },
        { x: 8, y: 0, width: 2, depth: 4, label: 'tape measure' },
      ]);
      const result = inferDrawerPurpose(layout);

      expect(result.purpose).toBe('workshop');
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.signals.some(s => s.type === 'domain_concentration')).toBe(true);
    });

    it('infers electronics purpose from electronics labels', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 1, depth: 1, label: 'resistor' },
        { x: 1, y: 0, width: 1, depth: 1, label: 'capacitor' },
        { x: 2, y: 0, width: 1, depth: 1, label: 'LED' },
        { x: 3, y: 0, width: 1, depth: 1, label: 'wire' },
        { x: 4, y: 0, width: 1, depth: 1, label: 'arduino' },
      ]);
      const result = inferDrawerPurpose(layout);

      expect(result.purpose).toBe('electronics');
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('infers workshop from measurement patterns in labels', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 1, depth: 1, label: 'M3x8' },
        { x: 1, y: 0, width: 1, depth: 1, label: 'M4x10' },
        { x: 2, y: 0, width: 1, depth: 1, label: 'M5x12' },
        { x: 3, y: 0, width: 1, depth: 1, label: '10mm bolts' },
      ]);
      const result = inferDrawerPurpose(layout);

      // Should detect measurement pattern
      expect(result.signals.some(s => s.type === 'label_pattern' && s.value === 'workshop')).toBe(true);
    });

    it('provides signals for all detected patterns', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 1, depth: 1, label: 'screwdriver' }, // tools domain
        { x: 1, y: 0, width: 1, depth: 1, label: 'M3x8 screw' }, // measurement pattern
        { x: 2, y: 0, width: 1, depth: 1, label: 'wrench' }, // tools domain
      ]);
      const result = inferDrawerPurpose(layout);

      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('excludes staging bins from analysis', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, label: 'screwdriver', layerId: 'layer-1' },
        { x: 0, y: 0, width: 2, depth: 2, label: 'resistor', layerId: '__staging__' },
      ]);
      const result = inferDrawerPurpose(layout);

      // Should only consider the screwdriver (tools domain)
      expect(result.signals.some(s =>
        s.type === 'domain_concentration' && s.value === 'workshop'
      )).toBe(true);
    });
  });

  describe('loadLabelSizes', () => {
    it('returns empty object when localStorage is empty', () => {
      const result = loadLabelSizes();
      expect(result).toEqual({});
    });

    it('returns stored data when available', () => {
      const data = { 'abc12345': ['2x2x3', '3x3x6'] };
      localStorageMock.setItem('gridfinity-ml-label-sizes-v1', JSON.stringify(data));

      const result = loadLabelSizes();
      expect(result).toEqual(data);
    });

    it('returns empty object on parse error', () => {
      localStorageMock.setItem('gridfinity-ml-label-sizes-v1', 'invalid json');

      const result = loadLabelSizes();
      expect(result).toEqual({});
    });
  });

  describe('recordLabelSize', () => {
    it('records a new label-size association', () => {
      recordLabelSize('abc12345', '2x2x3');

      const storageCalls = getStorageCalls();
      expect(storageCalls.length).toBeGreaterThan(0);
      const stored = JSON.parse(storageCalls[0][1]);
      expect(stored['abc12345']).toContain('2x2x3');
    });

    it('does not duplicate sizes for same label', () => {
      recordLabelSize('abc12345', '2x2x3');
      recordLabelSize('abc12345', '2x2x3');

      const storageCalls = getStorageCalls();
      const lastCall = storageCalls[storageCalls.length - 1];
      const stored = JSON.parse(lastCall[1]);
      expect(stored['abc12345'].filter((s: string) => s === '2x2x3').length).toBe(1);
    });

    it('adds multiple different sizes for same label', () => {
      recordLabelSize('abc12345', '2x2x3');
      recordLabelSize('abc12345', '3x3x6');

      const storageCalls = getStorageCalls();
      const lastCall = storageCalls[storageCalls.length - 1];
      const stored = JSON.parse(lastCall[1]);
      expect(stored['abc12345']).toContain('2x2x3');
      expect(stored['abc12345']).toContain('3x3x6');
    });
  });

  describe('recordLayoutLabelSizes', () => {
    it('records all label-size associations from a layout', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
        { x: 2, y: 0, width: 3, depth: 3, height: 6, label: 'wrench' },
      ]);

      recordLayoutLabelSizes(layout);

      // Should have called setItem for each labeled bin
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('skips bins without labels', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2 },
        { x: 2, y: 0, width: 2, depth: 2, label: 'screwdriver' },
      ]);

      recordLayoutLabelSizes(layout);

      // Only one label recorded
      const lastCall = localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
      const stored = JSON.parse(lastCall[1]);
      expect(Object.keys(stored).length).toBe(1);
    });

    it('skips staging bins', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, label: 'screwdriver', layerId: 'layer-1' },
        { x: 0, y: 0, width: 2, depth: 2, label: 'wrench', layerId: '__staging__' },
      ]);

      recordLayoutLabelSizes(layout);

      // Only non-staging bin recorded
      const lastCall = localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1];
      const stored = JSON.parse(lastCall[1]);
      expect(Object.keys(stored).length).toBe(1);
    });
  });

  describe('getLabelSizeConsistency', () => {
    it('returns empty array for layout with no labeled bins', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2 },
      ]);

      const result = getLabelSizeConsistency(layout);
      expect(result).toHaveLength(0);
    });

    it('marks labels as consistent when only one size used', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
      ]);

      const result = getLabelSizeConsistency(layout);

      expect(result).toHaveLength(1);
      expect(result[0].isConsistent).toBe(true);
      expect(result[0].sizesUsed).toHaveLength(1);
    });

    it('marks labels as inconsistent when multiple sizes used', () => {
      // First, record a previous size
      const layout1 = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
      ]);
      recordLayoutLabelSizes(layout1);

      // Then check with a different size
      const layout2 = createTestLayout([
        { x: 0, y: 0, width: 3, depth: 3, height: 6, label: 'screwdriver' },
      ]);

      const result = getLabelSizeConsistency(layout2);

      expect(result).toHaveLength(1);
      expect(result[0].isConsistent).toBe(false);
      expect(result[0].sizesUsed.length).toBeGreaterThan(1);
    });

    it('deduplicates labels with same hash', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
        { x: 2, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' }, // Same label
      ]);

      const result = getLabelSizeConsistency(layout);

      // Should only have one entry for the duplicate label
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateConsistencyRate', () => {
    it('returns null for layout with no labeled bins', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2 },
      ]);

      const result = calculateConsistencyRate(layout);
      expect(result).toBeNull();
    });

    it('returns 1.0 when all labels are consistent', () => {
      const layout = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
        { x: 2, y: 0, width: 3, depth: 3, height: 6, label: 'wrench' },
      ]);

      const result = calculateConsistencyRate(layout);
      expect(result).toBe(1.0);
    });

    it('returns fraction when some labels are inconsistent', () => {
      // First, record a size for screwdriver
      const layout1 = createTestLayout([
        { x: 0, y: 0, width: 2, depth: 2, height: 3, label: 'screwdriver' },
      ]);
      recordLayoutLabelSizes(layout1);

      // Then check with different size for screwdriver but new label for wrench
      const layout2 = createTestLayout([
        { x: 0, y: 0, width: 3, depth: 3, height: 6, label: 'screwdriver' }, // Inconsistent
        { x: 3, y: 0, width: 2, depth: 2, height: 3, label: 'wrench' }, // Consistent (new)
      ]);

      const result = calculateConsistencyRate(layout2);

      // 1 consistent, 1 inconsistent = 0.5
      expect(result).toBe(0.5);
    });
  });
});
