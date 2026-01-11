import { describe, it, expect } from 'vitest';
import {
  filterByCategory,
  sortRows,
  groupByCategory,
  applyFiltersAndSort,
} from '../utils/printListOperations';
import type { EnhancedPrintRow, Category } from '../types';

// Helper to create test rows
function createTestRow(overrides: Partial<EnhancedPrintRow> = {}): EnhancedPrintRow {
  return {
    size: '1x1',
    height: 3,
    binCount: 1,
    pieces: [{ width: 1, depth: 1, count: 1 }],
    totalPieces: 1,
    needsSplit: false,
    filament: 2.3,
    categoryIds: ['cat1'],
    labels: [],
    notes: '',
    binIds: ['bin1'],
    area: 1,
    costEstimate: 0.1,
    spoolPercentage: 0.7,
    ...overrides,
  };
}

// Test categories
const testCategories: Category[] = [
  { id: 'cat1', name: 'Tools', color: '#ff0000' },
  { id: 'cat2', name: 'Parts', color: '#00ff00' },
  { id: 'cat3', name: 'Hardware', color: '#0000ff' },
];

describe('printListOperations', () => {
  describe('filterByCategory', () => {
    it('returns all rows when no categories are hidden', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'] }),
        createTestRow({ categoryIds: ['cat2'] }),
      ];
      const result = filterByCategory(rows, new Set());
      expect(result).toHaveLength(2);
    });

    it('filters out rows with all hidden categories', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'] }),
        createTestRow({ categoryIds: ['cat2'] }),
        createTestRow({ categoryIds: ['cat3'] }),
      ];
      const result = filterByCategory(rows, new Set(['cat2']));
      expect(result).toHaveLength(2);
      expect(result.map(r => r.categoryIds[0])).toEqual(['cat1', 'cat3']);
    });

    it('keeps rows with at least one visible category', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1', 'cat2'] }), // has cat1 visible
        createTestRow({ categoryIds: ['cat2'] }), // all hidden
      ];
      const result = filterByCategory(rows, new Set(['cat2']));
      expect(result).toHaveLength(1);
      expect(result[0].categoryIds).toContain('cat1');
    });

    it('returns empty array when all categories hidden', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'] }),
        createTestRow({ categoryIds: ['cat2'] }),
      ];
      const result = filterByCategory(rows, new Set(['cat1', 'cat2']));
      expect(result).toHaveLength(0);
    });

    it('handles empty rows array', () => {
      const result = filterByCategory([], new Set(['cat1']));
      expect(result).toHaveLength(0);
    });

    it('handles rows with empty categoryIds', () => {
      const rows = [
        createTestRow({ categoryIds: [] }),
      ];
      // Row with empty categoryIds is filtered out because every() on empty array returns true
      // (vacuously true - all 0 elements satisfy any condition)
      const result = filterByCategory(rows, new Set(['cat1']));
      expect(result).toHaveLength(0);
    });
  });

  describe('sortRows', () => {
    it('returns original order for default sort key', () => {
      const rows = [
        createTestRow({ area: 9 }),
        createTestRow({ area: 1 }),
        createTestRow({ area: 4 }),
      ];
      const result = sortRows(rows, 'default', 'asc');
      expect(result.map(r => r.area)).toEqual([9, 1, 4]);
    });

    it('sorts by area ascending', () => {
      const rows = [
        createTestRow({ area: 9 }),
        createTestRow({ area: 1 }),
        createTestRow({ area: 4 }),
      ];
      const result = sortRows(rows, 'area', 'asc');
      expect(result.map(r => r.area)).toEqual([1, 4, 9]);
    });

    it('sorts by area descending', () => {
      const rows = [
        createTestRow({ area: 1 }),
        createTestRow({ area: 9 }),
        createTestRow({ area: 4 }),
      ];
      const result = sortRows(rows, 'area', 'desc');
      expect(result.map(r => r.area)).toEqual([9, 4, 1]);
    });

    it('sorts by height ascending', () => {
      const rows = [
        createTestRow({ height: 6 }),
        createTestRow({ height: 3 }),
        createTestRow({ height: 9 }),
      ];
      const result = sortRows(rows, 'height', 'asc');
      expect(result.map(r => r.height)).toEqual([3, 6, 9]);
    });

    it('sorts by height descending', () => {
      const rows = [
        createTestRow({ height: 3 }),
        createTestRow({ height: 9 }),
        createTestRow({ height: 6 }),
      ];
      const result = sortRows(rows, 'height', 'desc');
      expect(result.map(r => r.height)).toEqual([9, 6, 3]);
    });

    it('sorts by filament ascending', () => {
      const rows = [
        createTestRow({ filament: 5.5 }),
        createTestRow({ filament: 2.3 }),
        createTestRow({ filament: 9.9 }),
      ];
      const result = sortRows(rows, 'filament', 'asc');
      expect(result.map(r => r.filament)).toEqual([2.3, 5.5, 9.9]);
    });

    it('sorts by filament descending', () => {
      const rows = [
        createTestRow({ filament: 2.3 }),
        createTestRow({ filament: 9.9 }),
        createTestRow({ filament: 5.5 }),
      ];
      const result = sortRows(rows, 'filament', 'desc');
      expect(result.map(r => r.filament)).toEqual([9.9, 5.5, 2.3]);
    });

    it('handles empty array', () => {
      const result = sortRows([], 'area', 'asc');
      expect(result).toHaveLength(0);
    });

    it('handles single item array', () => {
      const rows = [createTestRow({ area: 5 })];
      const result = sortRows(rows, 'area', 'asc');
      expect(result).toHaveLength(1);
      expect(result[0].area).toBe(5);
    });

    it('does not mutate original array', () => {
      const rows = [
        createTestRow({ area: 9 }),
        createTestRow({ area: 1 }),
      ];
      const original = [...rows];
      sortRows(rows, 'area', 'asc');
      expect(rows.map(r => r.area)).toEqual(original.map(r => r.area));
    });

    it('handles equal values (stable sort behavior)', () => {
      const rows = [
        createTestRow({ area: 4, binIds: ['a'] }),
        createTestRow({ area: 4, binIds: ['b'] }),
        createTestRow({ area: 4, binIds: ['c'] }),
      ];
      const result = sortRows(rows, 'area', 'asc');
      expect(result).toHaveLength(3);
      // All should still be present
      expect(result.map(r => r.binIds[0]).sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('groupByCategory', () => {
    it('groups rows by primary category', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], binCount: 2 }),
        createTestRow({ categoryIds: ['cat1'], binCount: 3 }),
        createTestRow({ categoryIds: ['cat2'], binCount: 1 }),
      ];
      const groups = groupByCategory(rows, testCategories);

      expect(groups).toHaveLength(2);

      const cat1Group = groups.find(g => g.categoryId === 'cat1');
      expect(cat1Group).toBeDefined();
      expect(cat1Group!.rows).toHaveLength(2);
      expect(cat1Group!.categoryName).toBe('Tools');
      expect(cat1Group!.categoryColor).toBe('#ff0000');
    });

    it('calculates group totals correctly', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 2, costEstimate: 0.1, binCount: 2 }),
        createTestRow({ categoryIds: ['cat1'], filament: 3, costEstimate: 0.15, binCount: 3 }),
      ];
      const groups = groupByCategory(rows, testCategories);

      expect(groups).toHaveLength(1);
      expect(groups[0].totalFilament).toBe(5);
      expect(groups[0].totalCost).toBe(0.25);
      expect(groups[0].totalBins).toBe(5);
    });

    it('handles uncategorized rows', () => {
      const rows = [
        createTestRow({ categoryIds: ['unknown-cat'], binCount: 1 }),
      ];
      const groups = groupByCategory(rows, testCategories);

      expect(groups).toHaveLength(1);
      expect(groups[0].categoryId).toBe('unknown-cat');
      expect(groups[0].categoryName).toBe('Uncategorized');
    });

    it('uses primary category (first in array)', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat2', 'cat1'] }),
      ];
      const groups = groupByCategory(rows, testCategories);

      expect(groups).toHaveLength(1);
      expect(groups[0].categoryId).toBe('cat2');
      expect(groups[0].categoryName).toBe('Parts');
    });

    it('sorts groups by total bins (most first)', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], binCount: 5 }),
        createTestRow({ categoryIds: ['cat2'], binCount: 10 }),
        createTestRow({ categoryIds: ['cat3'], binCount: 3 }),
      ];
      const groups = groupByCategory(rows, testCategories);

      expect(groups[0].categoryId).toBe('cat2'); // 10 bins
      expect(groups[1].categoryId).toBe('cat1'); // 5 bins
      expect(groups[2].categoryId).toBe('cat3'); // 3 bins
    });

    it('handles empty rows array', () => {
      const groups = groupByCategory([], testCategories);
      expect(groups).toHaveLength(0);
    });

    it('handles empty categories array', () => {
      const rows = [createTestRow({ categoryIds: ['cat1'] })];
      const groups = groupByCategory(rows, []);

      expect(groups).toHaveLength(1);
      expect(groups[0].categoryName).toBe('Uncategorized');
    });

    it('handles rows with empty categoryIds', () => {
      const rows = [createTestRow({ categoryIds: [] })];
      const groups = groupByCategory(rows, testCategories);

      expect(groups).toHaveLength(1);
      expect(groups[0].categoryId).toBe('uncategorized');
      expect(groups[0].categoryName).toBe('Uncategorized');
    });

    it('rounds totals correctly', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 1.111, costEstimate: 0.111 }),
        createTestRow({ categoryIds: ['cat1'], filament: 2.222, costEstimate: 0.222 }),
      ];
      const groups = groupByCategory(rows, testCategories);

      // Should round to 1 decimal for filament
      expect(groups[0].totalFilament).toBe(3.3);
      // Should round to 2 decimals for cost
      expect(groups[0].totalCost).toBe(0.33);
    });
  });

  describe('applyFiltersAndSort', () => {
    it('applies filter then sort', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], area: 9 }),
        createTestRow({ categoryIds: ['cat2'], area: 1 }),
        createTestRow({ categoryIds: ['cat1'], area: 4 }),
      ];
      const result = applyFiltersAndSort(rows, new Set(['cat2']), 'area', 'asc');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.area)).toEqual([4, 9]);
    });

    it('handles no filters and default sort', () => {
      const rows = [
        createTestRow({ area: 9 }),
        createTestRow({ area: 1 }),
      ];
      const result = applyFiltersAndSort(rows, new Set(), 'default', 'asc');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.area)).toEqual([9, 1]); // Original order
    });

    it('returns empty array when all filtered out', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'] }),
      ];
      const result = applyFiltersAndSort(rows, new Set(['cat1']), 'area', 'asc');

      expect(result).toHaveLength(0);
    });
  });
});
