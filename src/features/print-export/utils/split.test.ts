import { describe, it, expect } from 'vitest';
import {
  splitBinSize,
  generatePrintList,
  getTotalPieces,
  getTotalBins,
  getTotalFilament,
  getSpoolEstimate,
} from '@/features/print-export/utils/split';
import type { Bin, PrintRow } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

describe('splitBinSize', () => {
  const maxSize = 4;

  it('returns single piece for small bins', () => {
    const pieces = splitBinSize(3, 3, maxSize);
    expect(pieces).toEqual([{ width: 3, depth: 3, count: 1 }]);
  });

  it('splits width only when needed', () => {
    const pieces = splitBinSize(5, 3, maxSize);
    // 5×3 → 3×3 + 2×3
    expect(pieces).toHaveLength(2);
    expect(pieces).toContainEqual({ width: 3, depth: 3, count: 1 });
    expect(pieces).toContainEqual({ width: 2, depth: 3, count: 1 });
  });

  it('splits depth only when needed', () => {
    const pieces = splitBinSize(3, 5, maxSize);
    // 3×5 → 3×3 + 3×2
    expect(pieces).toHaveLength(2);
    expect(pieces).toContainEqual({ width: 3, depth: 3, count: 1 });
    expect(pieces).toContainEqual({ width: 3, depth: 2, count: 1 });
  });

  it('handles PRD example: 9×3 with max 4', () => {
    const pieces = splitBinSize(9, 3, maxSize);
    // 9×3 → 5×3 + 4×3 → 3×3 + 2×3 + 4×3
    expect(pieces).toHaveLength(3);
    const sizes = pieces.map((p) => `${p.width}×${p.depth}`).sort();
    expect(sizes).toEqual(['2×3', '3×3', '4×3']);
  });

  it('handles both dimensions exceeding max', () => {
    const pieces = splitBinSize(5, 6, maxSize);
    // Should result in 4 pieces
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    // All pieces should fit
    pieces.forEach((p) => {
      expect(p.width).toBeLessThanOrEqual(maxSize);
      expect(p.depth).toBeLessThanOrEqual(maxSize);
    });
  });

  it('handles exact max size', () => {
    const pieces = splitBinSize(4, 4, maxSize);
    expect(pieces).toEqual([{ width: 4, depth: 4, count: 1 }]);
  });

  it('splits width of 1 without creating zero-width pieces', () => {
    // 1×5 with max 4: splits depth only → 1×3 + 1×2
    const pieces = splitBinSize(1, 5, maxSize);
    expect(pieces.every((p) => p.width > 0 && p.depth > 0)).toBe(true);
    expect(pieces).toHaveLength(2);
  });

  it('splits depth of 1 without creating zero-depth pieces', () => {
    // 5×1 with max 4: splits width only → 3×1 + 2×1
    const pieces = splitBinSize(5, 1, maxSize);
    expect(pieces.every((p) => p.width > 0 && p.depth > 0)).toBe(true);
    expect(pieces).toHaveLength(2);
  });

  it('handles both dimensions being 1 and over max', () => {
    // Edge case: 1×1 always fits
    const pieces = splitBinSize(1, 1, maxSize);
    expect(pieces).toEqual([{ width: 1, depth: 1, count: 1 }]);
  });

  it('handles odd splits correctly', () => {
    // 3×3 with max 2: splits both → ceil(3/2)=2, floor(3/2)=1
    // Results in 2×2, 1×2, 2×1, 1×1
    const pieces = splitBinSize(3, 3, 2);
    expect(pieces.length).toBe(4);
    expect(pieces.every((p) => p.width <= 2 && p.depth <= 2)).toBe(true);
  });

  it('handles 8×2 with maxSize 4 (splits width only into equal halves)', () => {
    // 8×2 → 4×2 + 4×2 (right half is exactly 4, not 0)
    const pieces = splitBinSize(8, 2, 4);
    expect(pieces.length).toBe(2);
    expect(pieces.every((p) => p.width === 4 && p.depth === 2)).toBe(true);
  });

  it('handles 2×8 with maxSize 4 (splits depth only into equal halves)', () => {
    // 2×8 → 2×4 + 2×4 (bottom half is exactly 4, not 0)
    const pieces = splitBinSize(2, 8, 4);
    expect(pieces.length).toBe(2);
    expect(pieces.every((p) => p.width === 2 && p.depth === 4)).toBe(true);
  });

  it('handles 8×8 with maxSize 4 (splits both into equal halves)', () => {
    // 8×8 → 4 pieces of 4×4
    const pieces = splitBinSize(8, 8, 4);
    expect(pieces.length).toBe(4);
    expect(pieces.every((p) => p.width === 4 && p.depth === 4)).toBe(true);
  });

  it('handles 6×5 with maxSize 4 (both dimensions need splitting)', () => {
    // 6×5 → leftW=3, rightW=3, topD=3, bottomD=2
    // Results in: 3×3, 3×3, 3×2, 3×2
    const pieces = splitBinSize(6, 5, 4);
    expect(pieces.length).toBe(4);
    expect(pieces.every((p) => p.width <= 4 && p.depth <= 4)).toBe(true);
  });
});

describe('splitBinSize with fractional dimensions (half-bin mode)', () => {
  it('does not split 1.5×1.5 when maxSize is 2', () => {
    const pieces = splitBinSize(1.5, 1.5, 2);
    expect(pieces).toEqual([{ width: 1.5, depth: 1.5, count: 1 }]);
  });

  it('handles 1.5×1.5 with maxSize 1', () => {
    const pieces = splitBinSize(1.5, 1.5, 1);
    // Should split to: 1×1, 0.5×1, 1×0.5, 0.5×0.5
    expect(pieces).toHaveLength(4);
    expect(pieces.every((p) => p.width <= 1 && p.depth <= 1)).toBe(true);
    expect(pieces.every((p) => p.width > 0 && p.depth > 0)).toBe(true);
  });

  it('handles 2.5×3 with maxSize 2', () => {
    const pieces = splitBinSize(2.5, 3, 2);
    expect(pieces.every((p) => p.width <= 2 && p.depth <= 2)).toBe(true);
    expect(pieces.every((p) => p.width > 0 && p.depth > 0)).toBe(true);
  });

  it('handles 0.5×0.5 without creating zero-dimension pieces', () => {
    // Smallest half-bin should not split further
    const pieces = splitBinSize(0.5, 0.5, 1);
    expect(pieces).toEqual([{ width: 0.5, depth: 0.5, count: 1 }]);
  });

  it('preserves fractional dimensions in output', () => {
    // A 2.5×2 bin with max 2 should produce pieces with 0.5 dimensions
    const pieces = splitBinSize(2.5, 2, 2);
    // Should split width: 1.5 + 1 (uses 0.5-aware rounding for fractional input)
    expect(pieces.some((p) => p.width === 1.5 || p.width === 1)).toBe(true);
    expect(pieces.every((p) => p.width <= 2 && p.depth <= 2)).toBe(true);
  });

  it('does not split when bin fits with half-unit max (6.5 max)', () => {
    // A 6.5-unit bin should not split when maxWidth is 6.5
    const pieces = splitBinSize(6.5, 3, 6.5);
    expect(pieces).toEqual([{ width: 6.5, depth: 3, count: 1 }]);
  });

  it('splits correctly when exceeding half-unit max', () => {
    // A 7-unit bin with max 6.5 should split
    const pieces = splitBinSize(7, 3, 6.5);
    expect(pieces).toHaveLength(2);
    expect(pieces.every((p) => p.width <= 6.5 && p.depth <= 6.5)).toBe(true);
  });
});

describe('generatePrintList', () => {
  it('groups identical bins', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].totalPieces).toBe(2);
  });

  it('excludes staging bins', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(1);
  });

  it('separates bins with different heights', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 6,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(2);
  });

  it('calculates split pieces correctly', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 5,
        depth: 3,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows[0].needsSplit).toBe(true);
    expect(rows[0].totalPieces).toBe(2); // 3×3 + 2×3
  });

  it('merges identical split pieces from same bin size', () => {
    // A 9x3 bin with maxSize 4 splits into: 3×3 + 2×3 + 4×3
    // Two identical 9x3 bins should result in merged piece counts
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 9,
        depth: 3,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 0,
        y: 3,
        width: 9,
        depth: 3,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Both bins are identical, so they should be grouped into one row
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    // Each bin splits into 3 pieces, so total = 6
    expect(rows[0].totalPieces).toBe(6);
  });

  it('handles bins that split into identical pieces', () => {
    // A 6x6 bin splits into 4 identical 3x3 pieces (split both dimensions)
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 6,
        depth: 6,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows[0].needsSplit).toBe(true);
    // 6x6 with max 4: splits to 4 pieces of 3x3
    expect(rows[0].pieces).toHaveLength(1); // All identical, merged
    expect(rows[0].pieces[0].count).toBe(4);
  });

  it('keeps labeled bins with DIFFERENT labels separate', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: 'Screws',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: 'Bolts',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Bins with different labels get separate rows
    expect(rows).toHaveLength(2);
    expect(rows[0].labels).toContain('Screws');
    expect(rows[1].labels).toContain('Bolts');
  });

  it('consolidates labeled bins with SAME label', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: 'Screws',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: 'Screws',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Bins with same dimensions + label + category are consolidated
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].labels).toContain('Screws');
  });

  it('groups unlabeled bins with same dimensions', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '3',
        layerId: 'l1',
        x: 0,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: 'Special',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Two unlabeled bins grouped, one labeled bin separate
    expect(rows).toHaveLength(2);
  });

  it('consolidates bins with custom properties (merges values)', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: { SKU: 'A1' },
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: { SKU: 'B2' },
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Bins are consolidated, custom properties are merged with "; " separator
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].customProperties?.SKU).toBe('A1; B2');
  });

  it('consolidates bins with custom properties - same values are deduplicated', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: { Color: 'Red' },
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: { Color: 'Red' },
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Consolidated - duplicate values are deduplicated
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].customProperties?.Color).toBe('Red');
  });

  it('consolidates notes from multiple bins (unique values joined)', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: 'Note 1',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: 'Note 2',
      },
      {
        id: '3',
        layerId: 'l1',
        x: 0,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: 'Note 1', // Duplicate
      },
    ];
    const rows = generatePrintList(bins, 4);
    // All bins consolidated, notes merged (unique only)
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(3);
    expect(rows[0].notes).toBe('Note 1; Note 2');
  });

  it('groups bins without custom properties together', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
      {
        id: '3',
        layerId: 'l1',
        x: 0,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: { SKU: 'C3' },
      },
    ];
    const rows = generatePrintList(bins, 4);
    // All 3 bins are consolidated (same dimensions + label + category)
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(3);
    // Custom property from the one bin that has it
    expect(rows[0].customProperties?.SKU).toBe('C3');
  });

  it('treats empty customProperties object as no custom properties', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
        customProperties: {},
      },
      {
        id: '2',
        layerId: 'l1',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, 4);
    // Empty customProperties should not cause separation
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
  });

  it('filament estimate is independent of nozzle size (bin geometry is fixed)', () => {
    const bins: Bin[] = [
      {
        id: '1',
        layerId: 'l1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'c1',
        label: '',
        notes: '',
      },
    ];
    const rows04 = generatePrintList(bins, 4, {
      ...DEFAULT_PRINT_SETTINGS,
      nozzleSizeMm: 0.4,
    });
    const rows06 = generatePrintList(bins, 4, {
      ...DEFAULT_PRINT_SETTINGS,
      nozzleSizeMm: 0.6,
    });
    // The bin's CAD wall is a fixed spec thickness; nozzle only affects how the
    // slicer fills it and the print speed, never the part's filament volume.
    expect(rows06[0].filament).toBe(rows04[0].filament);
  });
});

describe('getTotalPieces', () => {
  it('sums totalPieces across all rows', () => {
    const rows: PrintRow[] = [
      {
        size: '2×2',
        height: 3,
        binCount: 2,
        pieces: [],
        totalPieces: 2,
        needsSplit: false,
        filament: 10,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
      {
        size: '4×4',
        height: 3,
        binCount: 1,
        pieces: [],
        totalPieces: 4,
        needsSplit: true,
        filament: 20,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
    ];
    expect(getTotalPieces(rows)).toBe(6);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalPieces([])).toBe(0);
  });
});

describe('getTotalBins', () => {
  it('sums binCount across all rows', () => {
    const rows: PrintRow[] = [
      {
        size: '2×2',
        height: 3,
        binCount: 3,
        pieces: [],
        totalPieces: 3,
        needsSplit: false,
        filament: 10,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
      {
        size: '4×4',
        height: 3,
        binCount: 5,
        pieces: [],
        totalPieces: 5,
        needsSplit: false,
        filament: 20,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
    ];
    expect(getTotalBins(rows)).toBe(8);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalBins([])).toBe(0);
  });
});

describe('getTotalFilament', () => {
  it('sums filament across all rows', () => {
    const rows: PrintRow[] = [
      {
        size: '2×2',
        height: 3,
        binCount: 1,
        pieces: [],
        totalPieces: 1,
        needsSplit: false,
        filament: 10.5,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
      {
        size: '4×4',
        height: 3,
        binCount: 1,
        pieces: [],
        totalPieces: 1,
        needsSplit: false,
        filament: 20.3,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
    ];
    expect(getTotalFilament(rows)).toBe(30.8);
  });

  it('rounds to one decimal place', () => {
    const rows: PrintRow[] = [
      {
        size: '2×2',
        height: 3,
        binCount: 1,
        pieces: [],
        totalPieces: 1,
        needsSplit: false,
        filament: 10.123,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
      {
        size: '4×4',
        height: 3,
        binCount: 1,
        pieces: [],
        totalPieces: 1,
        needsSplit: false,
        filament: 20.456,
        categoryIds: [],
        labels: [],
        notes: '',
        binIds: [],
      },
    ];
    // 10.123 + 20.456 = 30.579 → 30.6
    expect(getTotalFilament(rows)).toBe(30.6);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalFilament([])).toBe(0);
  });
});

describe('getSpoolEstimate', () => {
  it('estimates spools needed (330m per spool)', () => {
    // 330m = 1 spool
    expect(getSpoolEstimate(330)).toBe(1);
  });

  it('rounds up for partial spools', () => {
    // 400m → 400/330 = 1.21 → rounds up to 0.1 precision
    expect(getSpoolEstimate(400)).toBe(1.3);
  });

  it('handles small amounts', () => {
    // 50m → 50/330 = 0.15 → 0.2
    expect(getSpoolEstimate(50)).toBe(0.2);
  });

  it('returns 0 for zero filament', () => {
    expect(getSpoolEstimate(0)).toBe(0);
  });

  it('handles large amounts', () => {
    // 1000m → 1000/330 = 3.03 → 3.1
    expect(getSpoolEstimate(1000)).toBe(3.1);
  });
});
