import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  filterBySearch,
  calculateSelectionRange,
  toggleSelection,
  getSelectedBinIds,
  formatAsCSV,
  formatAsJSON,
  calculateCategoryBreakdown,
  downloadAsFile,
} from '@/utils/binListOperations';
import type { EnhancedPrintRow, Category, Layout } from '@/core/types';

// Helper to create test rows
function createTestRow(overrides: Partial<EnhancedPrintRow> = {}): EnhancedPrintRow {
  return {
    size: '2×2',
    height: 3,
    binCount: 1,
    pieces: [{ width: 2, depth: 2, count: 1 }],
    totalPieces: 1,
    needsSplit: false,
    filament: 4.5,
    categoryIds: ['cat1'],
    labels: [],
    notes: '',
    binIds: ['bin1'],
    area: 4,
    costEstimate: 0.2,
    spoolPercentage: 1.4,
    ...overrides,
  };
}

// Test categories
const testCategories: Category[] = [
  { id: 'cat1', name: 'Tools', color: '#ff0000' },
  { id: 'cat2', name: 'Parts', color: '#00ff00' },
  { id: 'cat3', name: 'Hardware', color: '#0000ff' },
];

// Test layout for JSON export
const testLayout: Layout = {
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: testCategories,
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
};

describe('binListOperations', () => {
  describe('filterBySearch', () => {
    it('returns all rows when query is empty', () => {
      const rows = [
        createTestRow({ labels: ['Tools box'] }),
        createTestRow({ labels: ['Screws'] }),
      ];
      expect(filterBySearch(rows, '')).toHaveLength(2);
      expect(filterBySearch(rows, '   ')).toHaveLength(2);
    });

    it('filters rows by label match', () => {
      const rows = [
        createTestRow({ labels: ['Tools box'] }),
        createTestRow({ labels: ['Screws'] }),
        createTestRow({ labels: ['Socket set'] }),
      ];
      const result = filterBySearch(rows, 'tool');
      expect(result).toHaveLength(1);
      expect(result[0].labels[0]).toBe('Tools box');
    });

    it('filters rows by notes match', () => {
      const rows = [
        createTestRow({ notes: 'Keep spare parts here' }),
        createTestRow({ notes: 'For electronics' }),
      ];
      const result = filterBySearch(rows, 'spare');
      expect(result).toHaveLength(1);
      expect(result[0].notes).toContain('spare');
    });

    it('is case-insensitive', () => {
      const rows = [
        createTestRow({ labels: ['TOOLS'] }),
        createTestRow({ labels: ['Tools'] }),
        createTestRow({ labels: ['tools'] }),
      ];
      expect(filterBySearch(rows, 'TOOLS')).toHaveLength(3);
      expect(filterBySearch(rows, 'tools')).toHaveLength(3);
      expect(filterBySearch(rows, 'TooLs')).toHaveLength(3);
    });

    it('matches partial strings', () => {
      const rows = [createTestRow({ labels: ['Screwdriver set'] })];
      expect(filterBySearch(rows, 'screw')).toHaveLength(1);
      expect(filterBySearch(rows, 'driver')).toHaveLength(1);
      expect(filterBySearch(rows, 'set')).toHaveLength(1);
    });

    it('searches across multiple labels', () => {
      const rows = [createTestRow({ labels: ['First label', 'Second label'] })];
      expect(filterBySearch(rows, 'First')).toHaveLength(1);
      expect(filterBySearch(rows, 'Second')).toHaveLength(1);
    });

    it('handles rows with empty labels array', () => {
      const rows = [createTestRow({ labels: [], notes: 'Has notes' })];
      expect(filterBySearch(rows, 'notes')).toHaveLength(1);
      expect(filterBySearch(rows, 'label')).toHaveLength(0);
    });

    it('handles empty rows array', () => {
      expect(filterBySearch([], 'test')).toHaveLength(0);
    });

    it('trims whitespace from query', () => {
      const rows = [createTestRow({ labels: ['Tools'] })];
      expect(filterBySearch(rows, '  tools  ')).toHaveLength(1);
    });
  });

  describe('calculateSelectionRange', () => {
    it('adds single index when no previous selection', () => {
      const current = new Set<number>();
      const result = calculateSelectionRange(current, 5, null);
      expect(result.size).toBe(1);
      expect(result.has(5)).toBe(true);
    });

    it('adds range when shift-clicking after previous selection', () => {
      const current = new Set([3]);
      const result = calculateSelectionRange(current, 7, 3);
      expect(result.size).toBe(5); // 3, 4, 5, 6, 7
      expect([...result].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7]);
    });

    it('handles reverse range (clicking before previous)', () => {
      const current = new Set([7]);
      const result = calculateSelectionRange(current, 3, 7);
      expect(result.size).toBe(5); // 3, 4, 5, 6, 7
      expect([...result].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7]);
    });

    it('preserves existing selections when adding range', () => {
      const current = new Set([0, 1]);
      const result = calculateSelectionRange(current, 5, 3);
      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(true);
      expect(result.has(3)).toBe(true);
      expect(result.has(5)).toBe(true);
    });

    it('handles same index click (no range)', () => {
      const current = new Set([5]);
      const result = calculateSelectionRange(current, 5, 5);
      expect(result.size).toBe(1);
      expect(result.has(5)).toBe(true);
    });

    it('handles adjacent indices', () => {
      const current = new Set([5]);
      const result = calculateSelectionRange(current, 6, 5);
      expect(result.size).toBe(2);
      expect([...result].sort((a, b) => a - b)).toEqual([5, 6]);
    });
  });

  describe('toggleSelection', () => {
    it('adds index if not present', () => {
      const current = new Set([1, 2]);
      const result = toggleSelection(current, 3);
      expect(result.size).toBe(3);
      expect(result.has(3)).toBe(true);
    });

    it('removes index if present', () => {
      const current = new Set([1, 2, 3]);
      const result = toggleSelection(current, 2);
      expect(result.size).toBe(2);
      expect(result.has(2)).toBe(false);
    });

    it('does not mutate original set', () => {
      const current = new Set([1, 2]);
      toggleSelection(current, 3);
      expect(current.size).toBe(2);
      expect(current.has(3)).toBe(false);
    });

    it('handles empty set', () => {
      const current = new Set<number>();
      const result = toggleSelection(current, 0);
      expect(result.size).toBe(1);
      expect(result.has(0)).toBe(true);
    });
  });

  describe('getSelectedBinIds', () => {
    it('returns bin IDs from selected row indices', () => {
      const rows = [
        createTestRow({ binIds: ['a', 'b'] }),
        createTestRow({ binIds: ['c'] }),
        createTestRow({ binIds: ['d', 'e', 'f'] }),
      ];
      const selected = new Set([0, 2]);
      const result = getSelectedBinIds(rows, selected);
      expect(result).toEqual(['a', 'b', 'd', 'e', 'f']);
    });

    it('returns empty array when no selection', () => {
      const rows = [createTestRow({ binIds: ['a'] })];
      expect(getSelectedBinIds(rows, new Set())).toEqual([]);
    });

    it('handles out-of-bounds indices gracefully', () => {
      const rows = [createTestRow({ binIds: ['a'] })];
      const selected = new Set([0, 5, 10]); // 5 and 10 are out of bounds
      const result = getSelectedBinIds(rows, selected);
      expect(result).toEqual(['a']);
    });

    it('handles empty rows array', () => {
      expect(getSelectedBinIds([], new Set([0, 1]))).toEqual([]);
    });
  });

  describe('formatAsCSV', () => {
    // Default meta for tests (required for new column format)
    const defaultMeta = {
      gridUnitMm: 42,
      categories: [{ id: 'cat1', name: 'Tools' }],
    };

    it('creates valid CSV with new column order', () => {
      const rows = [
        createTestRow({
          size: '3×2',
          height: 4,
          binCount: 2,
          categoryIds: ['cat1'],
          labels: ['Test bin'],
          notes: 'Some notes',
        }),
      ];
      const csv = formatAsCSV(rows, defaultMeta);
      const lines = csv.split('\n');

      // New column order: Qty, Size, Size(mm), Height, Category, Label, Notes
      expect(lines[0]).toBe('Qty,Size,Size(mm),Height,Category,Label,Notes');
      expect(lines[1]).toBe('2,3×2,126×84,4u,Tools,Test bin,Some notes');
    });

    it('escapes commas in values', () => {
      const rows = [createTestRow({ labels: ['Label, with comma'] })];
      const csv = formatAsCSV(rows, defaultMeta);
      expect(csv).toContain('"Label, with comma"');
    });

    it('escapes double quotes in values', () => {
      const rows = [createTestRow({ labels: ['Label with "quotes"'] })];
      const csv = formatAsCSV(rows, defaultMeta);
      expect(csv).toContain('"Label with ""quotes"""');
    });

    it('escapes newlines in values', () => {
      const rows = [createTestRow({ notes: 'Line 1\nLine 2' })];
      const csv = formatAsCSV(rows, defaultMeta);
      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('prevents formula injection', () => {
      const rows = [
        createTestRow({ labels: ['=SUM(A1:A10)'] }),
        createTestRow({ labels: ['+1234567890'] }),
        createTestRow({ labels: ['-NEGATIVE'] }),
        createTestRow({ labels: ['@INDIRECT'] }),
      ];
      const csv = formatAsCSV(rows, defaultMeta);
      // Values starting with formula chars should be prefixed with '
      expect(csv).toContain("'=SUM");
      expect(csv).toContain("'+1234567890");
      expect(csv).toContain("'-NEGATIVE");
      expect(csv).toContain("'@INDIRECT");
    });

    it('handles empty labels and notes', () => {
      const rows = [createTestRow({ labels: [], notes: '' })];
      const csv = formatAsCSV(rows, defaultMeta);
      const lines = csv.split('\n');
      // Qty,Size,Size(mm),Height,Category,Label,Notes
      expect(lines[1]).toBe('1,2×2,84×84,3u,Tools,,');
    });

    it('handles empty rows array', () => {
      const csv = formatAsCSV([], defaultMeta);
      expect(csv).toBe('Qty,Size,Size(mm),Height,Category,Label,Notes');
    });

    it('includes custom property columns when present', () => {
      const rows = [
        createTestRow({
          labels: ['Bin 1'],
          customProperties: {
            Color: 'Red',
            Material: 'PETG',
          },
        }),
        createTestRow({
          labels: ['Bin 2'],
          customProperties: {
            Color: 'Blue',
          },
        }),
      ];
      const csv = formatAsCSV(rows, defaultMeta);
      const lines = csv.split('\n');

      // Header should include custom property columns (sorted alphabetically)
      expect(lines[0]).toBe('Qty,Size,Size(mm),Height,Category,Label,Notes,Color,Material');

      // First row has both properties
      expect(lines[1]).toContain('Red,PETG');

      // Second row has only Color, Material is empty
      expect(lines[2]).toContain('Blue,');
    });

    it('escapes custom property values', () => {
      const rows = [
        createTestRow({
          customProperties: {
            Notes: 'Value, with comma',
          },
        }),
      ];
      const csv = formatAsCSV(rows, defaultMeta);
      expect(csv).toContain('"Value, with comma"');
    });

    it('handles rows with no custom properties', () => {
      const rows = [
        createTestRow({
          labels: ['Bin 1'],
          customProperties: undefined,
        }),
        createTestRow({
          labels: ['Bin 2'],
          customProperties: {},
        }),
      ];
      const csv = formatAsCSV(rows, defaultMeta);
      const lines = csv.split('\n');

      // No custom property columns
      expect(lines[0]).toBe('Qty,Size,Size(mm),Height,Category,Label,Notes');
    });

    it('shows Uncategorized for missing category', () => {
      const rows = [createTestRow({ categoryIds: ['unknown'] })];
      const csv = formatAsCSV(rows, defaultMeta);
      expect(csv).toContain('Uncategorized');
    });

    it('calculates Size(mm) correctly with different gridUnitMm', () => {
      const rows = [createTestRow({ size: '2×3' })];
      const csv = formatAsCSV(rows, {
        gridUnitMm: 50,
        categories: [{ id: 'cat1', name: 'Tools' }],
      });
      const lines = csv.split('\n');
      // 2*50 = 100, 3*50 = 150
      expect(lines[1]).toContain('100×150');
    });

    it('escapes category names with special characters', () => {
      const rows = [createTestRow({ categoryIds: ['cat1'] })];
      const csv = formatAsCSV(rows, {
        gridUnitMm: 42,
        categories: [{ id: 'cat1', name: 'Tools, Hardware' }],
      });
      // Category name with comma should be quoted
      expect(csv).toContain('"Tools, Hardware"');
    });
  });

  describe('formatAsJSON', () => {
    it('creates valid JSON with metadata', () => {
      const rows = [
        createTestRow({
          size: '3×2',
          height: 4,
          binCount: 2,
          totalPieces: 2,
          filament: 5.5,
          labels: ['Test bin'],
          notes: 'Some notes',
          categoryIds: ['cat1'],
        }),
      ];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed._meta).toBeDefined();
      expect(parsed._meta.layoutName).toBe('Test Layout');
      expect(parsed._meta.drawerSize).toBe('10×8');
      expect(parsed._meta.exportedFrom).toBe('Gridfinity Layout Tool');
      expect(parsed._meta.exportedAt).toBeDefined();

      expect(parsed.bins).toHaveLength(1);
      expect(parsed.bins[0]).toEqual({
        size: '3×2',
        height: '4u',
        bins: 2,
        pieces: 2,
        filament: 5.5,
        label: 'Test bin',
        notes: 'Some notes',
        categories: ['Tools'],
      });
    });

    it('resolves category names from IDs', () => {
      const rows = [createTestRow({ categoryIds: ['cat1', 'cat2'] })];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins[0].categories).toEqual(['Tools', 'Parts']);
    });

    it('handles unknown category IDs', () => {
      const rows = [createTestRow({ categoryIds: ['unknown-id'] })];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins[0].categories).toEqual(['Unknown']);
    });

    it('handles empty rows array', () => {
      const json = formatAsJSON([], testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins).toHaveLength(0);
      expect(parsed._meta).toBeDefined();
    });

    it('produces valid JSON (parseable)', () => {
      const rows = [createTestRow({ labels: ['Special chars: "quotes" & <tags>'] })];
      expect(() => JSON.parse(formatAsJSON(rows, testLayout))).not.toThrow();
    });

    it('includes custom properties when present', () => {
      const rows = [
        createTestRow({
          labels: ['Bin with props'],
          customProperties: {
            Color: 'Red',
            Material: 'PETG',
          },
        }),
      ];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins[0].customProperties).toEqual({
        Color: 'Red',
        Material: 'PETG',
      });
    });

    it('omits customProperties when empty', () => {
      const rows = [
        createTestRow({
          labels: ['Bin without props'],
          customProperties: {},
        }),
      ];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins[0].customProperties).toBeUndefined();
    });

    it('omits customProperties when undefined', () => {
      const rows = [
        createTestRow({
          labels: ['Bin without props'],
          customProperties: undefined,
        }),
      ];
      const json = formatAsJSON(rows, testLayout);
      const parsed = JSON.parse(json);

      expect(parsed.bins[0].customProperties).toBeUndefined();
    });
  });

  describe('calculateCategoryBreakdown', () => {
    it('calculates breakdown by primary category', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 10, costEstimate: 0.5, binCount: 2 }),
        createTestRow({ categoryIds: ['cat1'], filament: 5, costEstimate: 0.25, binCount: 1 }),
        createTestRow({ categoryIds: ['cat2'], filament: 8, costEstimate: 0.4, binCount: 3 }),
      ];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown).toHaveLength(2);

      const cat1 = breakdown.find((b) => b.categoryId === 'cat1')!;
      expect(cat1.categoryName).toBe('Tools');
      expect(cat1.categoryColor).toBe('#ff0000');
      expect(cat1.filament).toBe(15);
      expect(cat1.cost).toBe(0.75);
      expect(cat1.binCount).toBe(3);

      const cat2 = breakdown.find((b) => b.categoryId === 'cat2')!;
      expect(cat2.filament).toBe(8);
      expect(cat2.binCount).toBe(3);
    });

    it('calculates percentages correctly', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 75 }),
        createTestRow({ categoryIds: ['cat2'], filament: 25 }),
      ];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      const cat1 = breakdown.find((b) => b.categoryId === 'cat1')!;
      const cat2 = breakdown.find((b) => b.categoryId === 'cat2')!;

      expect(cat1.percentage).toBe(75);
      expect(cat2.percentage).toBe(25);
    });

    it('sorts by filament usage descending', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 5 }),
        createTestRow({ categoryIds: ['cat2'], filament: 20 }),
        createTestRow({ categoryIds: ['cat3'], filament: 10 }),
      ];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown[0].categoryId).toBe('cat2'); // 20
      expect(breakdown[1].categoryId).toBe('cat3'); // 10
      expect(breakdown[2].categoryId).toBe('cat1'); // 5
    });

    it('handles uncategorized rows', () => {
      const rows = [createTestRow({ categoryIds: ['unknown-cat'], filament: 10 })];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].categoryName).toBe('Uncategorized');
      expect(breakdown[0].categoryColor).toBe('#6B7280');
    });

    it('handles rows with empty categoryIds', () => {
      const rows = [createTestRow({ categoryIds: [], filament: 10 })];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].categoryId).toBe('uncategorized');
    });

    it('returns empty array for empty rows', () => {
      const breakdown = calculateCategoryBreakdown([], testCategories);
      expect(breakdown).toHaveLength(0);
    });

    it('handles zero total filament (no division by zero)', () => {
      const rows = [createTestRow({ categoryIds: ['cat1'], filament: 0 })];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].percentage).toBe(0);
    });

    it('rounds values correctly', () => {
      const rows = [
        createTestRow({ categoryIds: ['cat1'], filament: 1.111, costEstimate: 0.111 }),
        createTestRow({ categoryIds: ['cat1'], filament: 2.222, costEstimate: 0.222 }),
      ];
      const breakdown = calculateCategoryBreakdown(rows, testCategories);

      expect(breakdown[0].filament).toBe(3.3); // Rounded to 1 decimal
      expect(breakdown[0].cost).toBe(0.33); // Rounded to 2 decimals
    });
  });

  describe('downloadAsFile', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockAnchor: Partial<HTMLAnchorElement>;

    beforeEach(() => {
      // Mock URL methods
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock anchor element
      mockClick = vi.fn();
      mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      };

      // Mock document methods
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as HTMLAnchorElement);
      mockAppendChild = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => mockAnchor as Node);
      mockRemoveChild = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => mockAnchor as Node);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates blob with correct content and mime type', () => {
      downloadAsFile('test content', 'test.txt', 'text/plain');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
    });

    it('sets correct href and download attributes on anchor', () => {
      downloadAsFile('test content', 'myfile.csv', 'text/csv');

      expect(mockAnchor.href).toBe('blob:test-url');
      expect(mockAnchor.download).toBe('myfile.csv');
    });

    it('appends anchor to body, clicks it, and removes it', () => {
      downloadAsFile('test content', 'test.txt', 'text/plain');

      expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
    });

    it('revokes object URL after download', () => {
      downloadAsFile('test content', 'test.txt', 'text/plain');

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('works with CSV content', () => {
      const csvContent = 'Header1,Header2\nValue1,Value2';
      downloadAsFile(csvContent, 'export.csv', 'text/csv');

      expect(mockAnchor.download).toBe('export.csv');
      expect(mockClick).toHaveBeenCalled();
    });

    it('works with JSON content', () => {
      const jsonContent = JSON.stringify({ data: [1, 2, 3] });
      downloadAsFile(jsonContent, 'export.json', 'application/json');

      expect(mockAnchor.download).toBe('export.json');
      expect(mockClick).toHaveBeenCalled();
    });
  });
});
