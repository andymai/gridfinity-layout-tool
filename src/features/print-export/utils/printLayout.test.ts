import { describe, it, expect } from 'vitest';
import {
  getVisibleBinsForPrint,
  getVisibleLayers,
  getUsedCategories,
  formatDrawerDimensions,
  formatPrintDate,
  getBinCountByLayer,
  sortBinsForPrint,
} from '@/features/print-export/utils/printLayout';
import type { Bin, Layer, Category, Drawer } from '@/core/types';
import type { BinListSortOrder } from '@/core/store/settings';
import { STAGING_ID } from '@/core/constants';

describe('printLayout utilities', () => {
  // Test fixtures
  const createDrawer = (width: number, depth: number, height = 12): Drawer => ({
    width,
    depth,
    height,
  });

  const createLayer = (id: string, name: string, height = 3): Layer => ({
    id,
    name,
    height,
  });

  const createBin = (
    id: string,
    layerId: string,
    category: string,
    x = 0,
    y = 0,
    width = 1,
    depth = 1
  ): Bin => ({
    id,
    layerId,
    x,
    y,
    width,
    depth,
    height: 3,
    category,
    label: '',
    notes: '',
  });

  const createCategory = (id: string, name: string, color: string): Category => ({
    id,
    name,
    color,
  });

  describe('getVisibleBinsForPrint', () => {
    const layer1 = 'layer1';
    const layer2 = 'layer2';
    const bins: Bin[] = [
      createBin('bin1', layer1, 'cat1'),
      createBin('bin2', layer2, 'cat1'),
      createBin('bin3', STAGING_ID, 'cat1'),
      createBin('bin4', layer1, 'cat2'),
    ];

    it('returns bins for selected layers', () => {
      const result = getVisibleBinsForPrint(bins, [layer1]);
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin4']);
    });

    it('returns bins for multiple selected layers', () => {
      const result = getVisibleBinsForPrint(bins, [layer1, layer2]);
      expect(result).toHaveLength(3);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2', 'bin4']);
    });

    it('excludes staging bins', () => {
      const result = getVisibleBinsForPrint(bins, [layer1, layer2, STAGING_ID]);
      expect(result.map((b) => b.id)).not.toContain('bin3');
    });

    it('returns empty array when no layers selected', () => {
      const result = getVisibleBinsForPrint(bins, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('getVisibleLayers', () => {
    const layers: Layer[] = [
      createLayer('l1', 'Layer 1'),
      createLayer('l2', 'Layer 2'),
      createLayer('l3', 'Layer 3'),
    ];

    it('returns selected layers', () => {
      const result = getVisibleLayers(layers, ['l1', 'l3']);
      expect(result).toHaveLength(2);
      expect(result.map((l) => l.id)).toEqual(['l1', 'l3']);
    });

    it('preserves layer order', () => {
      const result = getVisibleLayers(layers, ['l3', 'l1', 'l2']);
      // Order should match original layers array, not selection order
      expect(result.map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
    });

    it('returns empty array for no selection', () => {
      expect(getVisibleLayers(layers, [])).toHaveLength(0);
    });

    it('handles non-existent layer IDs', () => {
      const result = getVisibleLayers(layers, ['l1', 'nonexistent']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('l1');
    });
  });

  describe('getUsedCategories', () => {
    const categories: Category[] = [
      createCategory('cat1', 'Category 1', '#ff0000'),
      createCategory('cat2', 'Category 2', '#00ff00'),
      createCategory('cat3', 'Category 3', '#0000ff'),
    ];

    it('returns only categories used by bins', () => {
      const bins: Bin[] = [createBin('b1', 'l1', 'cat1'), createBin('b2', 'l1', 'cat3')];
      const result = getUsedCategories(bins, categories);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(['cat1', 'cat3']);
    });

    it('returns empty array when no bins', () => {
      expect(getUsedCategories([], categories)).toHaveLength(0);
    });

    it('handles bins with unknown categories', () => {
      const bins: Bin[] = [createBin('b1', 'l1', 'unknown')];
      const result = getUsedCategories(bins, categories);
      expect(result).toHaveLength(0);
    });

    it('deduplicates categories', () => {
      const bins: Bin[] = [
        createBin('b1', 'l1', 'cat1'),
        createBin('b2', 'l1', 'cat1'),
        createBin('b3', 'l1', 'cat1'),
      ];
      const result = getUsedCategories(bins, categories);
      expect(result).toHaveLength(1);
    });
  });

  describe('formatDrawerDimensions', () => {
    it('formats dimensions with mm conversion', () => {
      const drawer = createDrawer(10, 8, 12);
      expect(formatDrawerDimensions(drawer, 42)).toBe('10x8 (420x336 mm)');
    });

    it('handles fractional dimensions', () => {
      const drawer = createDrawer(10.5, 8.5, 12);
      // 10.5 * 42 = 441, 8.5 * 42 = 357
      expect(formatDrawerDimensions(drawer, 42)).toBe('10.5x8.5 (441x357 mm)');
    });

    it('uses provided grid unit size', () => {
      const drawer = createDrawer(10, 8, 12);
      expect(formatDrawerDimensions(drawer, 50)).toBe('10x8 (500x400 mm)');
    });
  });

  describe('formatPrintDate', () => {
    it('returns a formatted date string', () => {
      const result = formatPrintDate();
      // Should contain a year (4 digits)
      expect(result).toMatch(/\d{4}/);
      // Should contain a month name or number
      expect(result.length).toBeGreaterThan(5);
    });
  });

  describe('getBinCountByLayer', () => {
    const layers: Layer[] = [createLayer('l1', 'Layer 1'), createLayer('l2', 'Layer 2')];

    it('counts bins per layer', () => {
      const bins: Bin[] = [
        createBin('b1', 'l1', 'cat1'),
        createBin('b2', 'l1', 'cat1'),
        createBin('b3', 'l2', 'cat1'),
      ];
      const result = getBinCountByLayer(bins, layers);
      expect(result.get('l1')).toBe(2);
      expect(result.get('l2')).toBe(1);
    });

    it('returns 0 for layers with no bins', () => {
      const bins: Bin[] = [createBin('b1', 'l1', 'cat1')];
      const result = getBinCountByLayer(bins, layers);
      expect(result.get('l2')).toBe(0);
    });

    it('excludes staging bins from count', () => {
      const bins: Bin[] = [createBin('b1', 'l1', 'cat1'), createBin('b2', STAGING_ID, 'cat1')];
      const result = getBinCountByLayer(bins, layers);
      expect(result.get('l1')).toBe(1);
    });

    it('handles empty bins array', () => {
      const result = getBinCountByLayer([], layers);
      expect(result.get('l1')).toBe(0);
      expect(result.get('l2')).toBe(0);
    });
  });

  describe('sortBinsForPrint', () => {
    const layers: Layer[] = [createLayer('l1', 'Alpha Layer'), createLayer('l2', 'Beta Layer')];

    const categories: Category[] = [
      createCategory('cat1', 'Zebra', '#ff0000'),
      createCategory('cat2', 'Apple', '#00ff00'),
      createCategory('cat3', 'Mango', '#0000ff'),
    ];

    // Helper to create bins with more options
    const createFullBin = (
      id: string,
      layerId: string,
      category: string,
      x: number,
      y: number,
      width: number,
      depth: number,
      height: number,
      label: string
    ): Bin => ({
      id,
      layerId,
      x,
      y,
      width,
      depth,
      height,
      category,
      label,
      notes: '',
    });

    it('sorts by category name alphabetically', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'), // Zebra
        createFullBin('b2', 'l1', 'cat2', 1, 0, 1, 1, 3, 'B'), // Apple
        createFullBin('b3', 'l1', 'cat3', 2, 0, 1, 1, 3, 'C'), // Mango
      ];
      const sortOrder: BinListSortOrder = [{ field: 'category', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']); // Apple, Mango, Zebra
    });

    it('sorts by position (Y descending, then X ascending)', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'), // (0,0)
        createFullBin('b2', 'l1', 'cat1', 2, 2, 1, 1, 3, 'B'), // (2,2)
        createFullBin('b3', 'l1', 'cat1', 0, 2, 1, 1, 3, 'C'), // (0,2)
        createFullBin('b4', 'l1', 'cat1', 1, 0, 1, 1, 3, 'D'), // (1,0)
      ];
      const sortOrder: BinListSortOrder = [{ field: 'position', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Y descending: y=2 first, then y=0. Within same Y, X ascending
      expect(result.map((b) => b.id)).toEqual(['b3', 'b2', 'b1', 'b4']); // (0,2), (2,2), (0,0), (1,0)
    });

    it('sorts by size (area descending)', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'), // 1x1 = 1
        createFullBin('b2', 'l1', 'cat1', 1, 0, 2, 3, 3, 'B'), // 2x3 = 6
        createFullBin('b3', 'l1', 'cat1', 3, 0, 2, 2, 3, 'C'), // 2x2 = 4
      ];
      const sortOrder: BinListSortOrder = [{ field: 'size', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']); // 6, 4, 1
    });

    it('sorts by height (descending)', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'),
        createFullBin('b2', 'l1', 'cat1', 1, 0, 1, 1, 6, 'B'),
        createFullBin('b3', 'l1', 'cat1', 2, 0, 1, 1, 1, 'C'),
      ];
      const sortOrder: BinListSortOrder = [{ field: 'height', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b2', 'b1', 'b3']); // 6, 3, 1
    });

    it('sorts by label alphabetically', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'Zebra'),
        createFullBin('b2', 'l1', 'cat1', 1, 0, 1, 1, 3, 'Apple'),
        createFullBin('b3', 'l1', 'cat1', 2, 0, 1, 1, 3, 'Mango'),
      ];
      const sortOrder: BinListSortOrder = [{ field: 'label', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']); // Apple, Mango, Zebra
    });

    it('sorts by layer name alphabetically', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l2', 'cat1', 0, 0, 1, 1, 3, 'A'), // Beta Layer
        createFullBin('b2', 'l1', 'cat1', 1, 0, 1, 1, 3, 'B'), // Alpha Layer
      ];
      const sortOrder: BinListSortOrder = [{ field: 'layer', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b2', 'b1']); // Alpha, Beta
    });

    it('applies multiple sort fields in order', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'), // Zebra, (0,0)
        createFullBin('b2', 'l1', 'cat1', 1, 1, 1, 1, 3, 'B'), // Zebra, (1,1)
        createFullBin('b3', 'l1', 'cat2', 0, 0, 1, 1, 3, 'C'), // Apple, (0,0)
        createFullBin('b4', 'l1', 'cat2', 2, 2, 1, 1, 3, 'D'), // Apple, (2,2)
      ];
      const sortOrder: BinListSortOrder = [
        { field: 'category', enabled: true },
        { field: 'position', enabled: true },
      ];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Apple first (sorted by position: (2,2), (0,0)), then Zebra (sorted by position: (1,1), (0,0))
      expect(result.map((b) => b.id)).toEqual(['b4', 'b3', 'b2', 'b1']);
    });

    it('ignores disabled sort fields', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'Zebra'),
        createFullBin('b2', 'l1', 'cat2', 1, 0, 1, 1, 3, 'Apple'),
      ];
      const sortOrder: BinListSortOrder = [
        { field: 'category', enabled: false },
        { field: 'label', enabled: true },
      ];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Category disabled, only label applies
      expect(result.map((b) => b.id)).toEqual(['b2', 'b1']); // Apple, Zebra (by label)
    });

    it('returns original order when no sort fields enabled', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'A'),
        createFullBin('b2', 'l1', 'cat2', 1, 0, 1, 1, 3, 'B'),
      ];
      const sortOrder: BinListSortOrder = [
        { field: 'category', enabled: false },
        { field: 'label', enabled: false },
      ];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      expect(result.map((b) => b.id)).toEqual(['b1', 'b2']); // Original order
    });

    it('handles empty bins array', () => {
      const sortOrder: BinListSortOrder = [{ field: 'category', enabled: true }];
      const result = sortBinsForPrint([], sortOrder, categories, layers);
      expect(result).toEqual([]);
    });

    it('handles bins with unknown categories', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'unknown', 0, 0, 1, 1, 3, 'A'),
        createFullBin('b2', 'l1', 'cat1', 1, 0, 1, 1, 3, 'B'),
      ];
      const sortOrder: BinListSortOrder = [{ field: 'category', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Unknown category sorts as empty string, comes first
      expect(result.map((b) => b.id)).toEqual(['b1', 'b2']);
    });

    it('handles bins with empty labels', () => {
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, ''),
        createFullBin('b2', 'l1', 'cat1', 1, 0, 1, 1, 3, 'Zebra'),
        createFullBin('b3', 'l1', 'cat1', 2, 0, 1, 1, 3, 'Apple'),
      ];
      const sortOrder: BinListSortOrder = [{ field: 'label', enabled: true }];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Empty label sorts first
      expect(result.map((b) => b.id)).toEqual(['b1', 'b3', 'b2']);
    });

    it('maintains relative order when all sort fields are equal', () => {
      // Two bins with identical values for all enabled sort fields
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'Same'),
        createFullBin('b2', 'l1', 'cat1', 0, 0, 1, 1, 3, 'Same'),
      ];
      const sortOrder: BinListSortOrder = [
        { field: 'category', enabled: true },
        { field: 'position', enabled: true },
        { field: 'label', enabled: true },
      ];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Should maintain original order when equal
      expect(result.map((b) => b.id)).toEqual(['b1', 'b2']);
    });

    it('handles bins with identical values across multiple fields', () => {
      // Three bins that only differ in size
      const bins: Bin[] = [
        createFullBin('b1', 'l1', 'cat1', 0, 0, 1, 1, 3, 'Same'),
        createFullBin('b2', 'l1', 'cat1', 0, 0, 2, 2, 3, 'Same'),
        createFullBin('b3', 'l1', 'cat1', 0, 0, 1, 2, 3, 'Same'),
      ];
      const sortOrder: BinListSortOrder = [
        { field: 'category', enabled: true }, // All same
        { field: 'label', enabled: true }, // All same
        { field: 'size', enabled: true }, // This distinguishes them
      ];
      const result = sortBinsForPrint(bins, sortOrder, categories, layers);
      // Size comparison (larger first): (2*2=4) > (1*2=2) > (1*1=1)
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
    });
  });
});
