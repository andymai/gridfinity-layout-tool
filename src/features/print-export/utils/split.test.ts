import { describe, it, expect } from 'vitest';
import type { PrintSplitFit } from '@/features/print-export/utils/split';
import {
  splitBinSize,
  formatPieceSize,
  generatePrintList,
  getTotalPieces,
  getTotalBins,
  getTotalFilament,
  getSpoolEstimate,
} from '@/features/print-export/utils/split';
import type { Bin, PrintRow } from '@/core/types';
import { binId, layerId, categoryId, designId, gridUnits, heightUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import type { OverhangConfig } from '@/shared/types/bin';

/** A print-bed fit expressed as "N grid units fit each axis". */
function fitAt(maxUnits: number, overhangFor?: PrintSplitFit['overhangFor']): PrintSplitFit {
  const gridUnitMm = 42;
  return {
    bedWidthMm: maxUnits * gridUnitMm,
    bedDepthMm: maxUnits * gridUnitMm,
    gridUnitMm,
    gridUnitMmY: gridUnitMm,
    ...(overhangFor ? { overhangFor } : {}),
  };
}

describe('splitBinSize', () => {
  const maxSize = 4;

  // Equal pieces, per axis, from the same helper the exporter cuts with. The
  // old recursive halving listed sizes the exporter never emits (a 5 as 3 + 2
  // rather than two 2.5s) and at 10 and 12 units a whole extra piece.
  it.each([
    { w: 3, d: 3, max: maxSize, piece: [3, 3], count: 1 },
    { w: 4, d: 4, max: maxSize, piece: [4, 4], count: 1 },
    { w: 1, d: 1, max: maxSize, piece: [1, 1], count: 1 },
    { w: 5, d: 3, max: maxSize, piece: [2.5, 3], count: 2 },
    { w: 3, d: 5, max: maxSize, piece: [3, 2.5], count: 2 },
    { w: 9, d: 3, max: maxSize, piece: [3, 3], count: 3 },
    { w: 12, d: 1, max: maxSize, piece: [4, 1], count: 3 },
    { w: 5, d: 6, max: maxSize, piece: [2.5, 3], count: 4 },
    { w: 8, d: 2, max: maxSize, piece: [4, 2], count: 2 },
    { w: 2, d: 8, max: maxSize, piece: [2, 4], count: 2 },
    { w: 8, d: 8, max: maxSize, piece: [4, 4], count: 4 },
    { w: 6, d: 5, max: maxSize, piece: [3, 2.5], count: 4 },
    { w: 3, d: 3, max: 2, piece: [1.5, 1.5], count: 4 },
  ])('cuts $w x $d into $count equal pieces at max $max', ({ w, d, max, piece, count }) => {
    expect(splitBinSize(w, d, max)).toEqual([
      { width: gridUnits(piece[0]), depth: gridUnits(piece[1]), count },
    ]);
  });

  // Exact, not rounded: the size feeds the filament estimate and the diagram's
  // grid recovery. Only the label rounds it (`formatPieceSize`).
  it('keeps an even three-way split exact', () => {
    expect(splitBinSize(10, 1, maxSize)).toEqual([
      { width: gridUnits(10 / 3), depth: gridUnits(1), count: 3 },
    ]);
    expect(formatPieceSize(10 / 3)).toBe('3.33');
  });

  it('never yields a zero-sized piece', () => {
    for (const [w, d] of [
      [1, 5],
      [5, 1],
      [0.5, 9],
    ]) {
      expect(splitBinSize(w, d, maxSize).every((p) => p.width > 0 && p.depth > 0)).toBe(true);
    }
  });

  it('keeps every piece inside the limit', () => {
    for (const [w, d] of [
      [5, 6],
      [9, 9],
      [13, 7],
    ]) {
      expect(
        splitBinSize(w, d, maxSize).every((p) => p.width <= maxSize && p.depth <= maxSize)
      ).toBe(true);
    }
  });

  // The pieces tile the bin: their spans must add back up to it, which is what
  // lets the diagram recover the grid from one piece size.
  it.each([
    [5, 3],
    [9, 3],
    [12, 1],
    [6, 5],
    [7, 3],
  ])('tiles %d x %d exactly', (w, d) => {
    const [piece] = splitBinSize(w, d, maxSize);
    const cols = Math.round(w / piece.width);
    const rows = Math.round(d / piece.depth);
    expect(cols * rows).toBe(piece.count);
    expect(piece.width * cols).toBeCloseTo(w, 1);
    expect(piece.depth * rows).toBeCloseTo(d, 1);
  });
});

describe('splitBinSize with fractional dimensions (half-bin mode)', () => {
  it.each([
    { w: 1.5, d: 1.5, max: 2, piece: [1.5, 1.5], count: 1 },
    { w: 0.5, d: 0.5, max: 1, piece: [0.5, 0.5], count: 1 },
    { w: 6.5, d: 3, max: 6.5, piece: [6.5, 3], count: 1 },
    // Halving a half-unit axis lands on quarters — a real cut plane, since
    // `getSplitPlanePositionsMm` puts the seam exactly there.
    { w: 1.5, d: 1.5, max: 1, piece: [0.75, 0.75], count: 4 },
    { w: 2.5, d: 3, max: 2, piece: [1.25, 1.5], count: 4 },
    { w: 2.5, d: 2, max: 2, piece: [1.25, 2], count: 2 },
    { w: 7, d: 3, max: 6.5, piece: [3.5, 3], count: 2 },
  ])('cuts $w x $d into $count equal pieces at max $max', ({ w, d, max, piece, count }) => {
    expect(splitBinSize(w, d, max)).toEqual([
      { width: gridUnits(piece[0]), depth: gridUnits(piece[1]), count },
    ]);
  });
});

describe('generatePrintList', () => {
  it('groups identical bins', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].totalPieces).toBe(2);
  });

  it('does not merge bins linked to different designs even with identical dims', () => {
    const base = {
      layerId: layerId('l1'),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: categoryId('c1'),
      label: '',
      notes: '',
    };
    const bins = [
      { ...base, id: binId('1'), x: gridUnits(0), linkedDesignId: designId('design-a') },
      { ...base, id: binId('2'), x: gridUnits(2), linkedDesignId: designId('design-b') },
      { ...base, id: binId('3'), x: gridUnits(4) }, // unlinked
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows).toHaveLength(3);
  });

  it('still merges bins linked to the same design', () => {
    const base = {
      layerId: layerId('l1'),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: categoryId('c1'),
      label: '',
      notes: '',
    };
    const bins = [
      { ...base, id: binId('1'), x: gridUnits(0), linkedDesignId: designId('design-a') },
      { ...base, id: binId('2'), x: gridUnits(2), linkedDesignId: designId('design-a') },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
  });

  it('carries the linked design id onto the row', () => {
    const base = {
      layerId: layerId('l1'),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: categoryId('c1'),
      label: '',
      notes: '',
    };
    const bins = [
      { ...base, id: binId('1'), x: gridUnits(0), linkedDesignId: designId('design-a') },
      { ...base, id: binId('2'), x: gridUnits(2) },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    const linked = rows.find((r) => r.linkedDesignId !== undefined);
    const unlinked = rows.find((r) => r.linkedDesignId === undefined);
    expect(linked?.linkedDesignId).toBe('design-a');
    expect(unlinked).toBeDefined();
  });

  it('excludes staging bins', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(1);
  });

  it('separates bins with different heights', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(6),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows).toHaveLength(2);
  });

  it('calculates split pieces correctly', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(5),
        depth: gridUnits(3),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows[0].needsSplit).toBe(true);
    expect(rows[0].totalPieces).toBe(2); // 3×3 + 2×3
  });

  it('merges identical split pieces from same bin size', () => {
    // A 9x3 bin with maxSize 4 splits into: 3×3 + 2×3 + 4×3
    // Two identical 9x3 bins should result in merged piece counts
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(9),
        depth: gridUnits(3),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(3),
        width: gridUnits(9),
        depth: gridUnits(3),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
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
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(6),
        depth: gridUnits(6),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    expect(rows[0].needsSplit).toBe(true);
    // 6x6 with max 4: splits to 4 pieces of 3x3
    expect(rows[0].pieces).toHaveLength(1); // All identical, merged
    expect(rows[0].pieces[0].count).toBe(4);
  });

  it('keeps labeled bins with DIFFERENT labels separate', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: 'Screws',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: 'Bolts',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Bins with different labels get separate rows
    expect(rows).toHaveLength(2);
    expect(rows[0].labels).toContain('Screws');
    expect(rows[1].labels).toContain('Bolts');
  });

  it('consolidates labeled bins with SAME label', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: 'Screws',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: 'Screws',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Bins with same dimensions + label + category are consolidated
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].labels).toContain('Screws');
  });

  it('groups unlabeled bins with same dimensions', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('3'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(2),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: 'Special',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Two unlabeled bins grouped, one labeled bin separate
    expect(rows).toHaveLength(2);
  });

  it('consolidates bins with custom properties (merges values)', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: { SKU: 'A1' },
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: { SKU: 'B2' },
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Bins are consolidated, custom properties are merged with "; " separator
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].customProperties?.SKU).toBe('A1; B2');
  });

  it('consolidates bins with custom properties - same values are deduplicated', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: { Color: 'Red' },
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: { Color: 'Red' },
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Consolidated - duplicate values are deduplicated
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].customProperties?.Color).toBe('Red');
  });

  it('consolidates notes from multiple bins (unique values joined)', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: 'Note 1',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: 'Note 2',
      },
      {
        id: binId('3'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(2),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: 'Note 1', // Duplicate
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // All bins consolidated, notes merged (unique only)
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(3);
    expect(rows[0].notes).toBe('Note 1; Note 2');
  });

  it('groups bins without custom properties together', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
      {
        id: binId('3'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(2),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: { SKU: 'C3' },
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // All 3 bins are consolidated (same dimensions + label + category)
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(3);
    // Custom property from the one bin that has it
    expect(rows[0].customProperties?.SKU).toBe('C3');
  });

  it('treats empty customProperties object as no custom properties', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
        customProperties: {},
      },
      {
        id: binId('2'),
        layerId: layerId('l1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows = generatePrintList(bins, fitAt(4));
    // Empty customProperties should not cause separation
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
  });

  it('filament estimate is independent of nozzle size (bin geometry is fixed)', () => {
    const bins: Bin[] = [
      {
        id: binId('1'),
        layerId: layerId('l1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('c1'),
        label: '',
        notes: '',
      },
    ];
    const rows04 = generatePrintList(bins, fitAt(4), {
      ...DEFAULT_PRINT_SETTINGS,
      nozzleSizeMm: 0.4,
    });
    const rows06 = generatePrintList(bins, fitAt(4), {
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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
        height: heightUnits(3),
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

// An overhang grows a bin's body in millimetres past its footprint, so a bin
// whose grid units fit the bed can still be too wide to print. The exporter has
// always charged it; the print list did not, and reported one uncut piece for a
// part the export writes in two.
describe('generatePrintList with overhang', () => {
  function binAt(id: string, x: number, width = 4): Bin {
    return {
      id: binId(id),
      layerId: layerId('l1'),
      x: gridUnits(x),
      y: gridUnits(0),
      width: gridUnits(width),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: categoryId('c1'),
      label: '',
      notes: '',
      linkedDesignId: designId('d1'),
    };
  }

  const WIDE: OverhangConfig = { left: 61.5, right: 42, front: 0, back: 0, enabled: true };

  it('splits a bin whose overhang overruns the bed', () => {
    // 4 x 42mm is 168mm of grid, inside a 180mm bed; the overhang makes the
    // real part 271.5mm wide.
    const fit = fitAt(180 / 42, () => WIDE);
    const rows = generatePrintList([binAt('1', 0)], fit);
    expect(rows[0].needsSplit).toBe(true);
    expect(rows[0].pieces[0].count).toBe(2);
  });

  it('leaves the same bin unsplit with no overhang', () => {
    const rows = generatePrintList([binAt('1', 0)], fitAt(180 / 42));
    expect(rows[0].needsSplit).toBe(false);
    expect(rows[0].pieces[0].count).toBe(1);
  });

  // Two placements of one design with different overhangs are two printed
  // parts, and only one of them may need cutting — the layout export keys on
  // `designId|overhangKey` for the same reason.
  it('keeps placements with different overhangs in separate rows', () => {
    const fit = fitAt(180 / 42, (bin) => (bin.x === 0 ? WIDE : undefined));
    const rows = generatePrintList([binAt('1', 0), binAt('2', 4)], fit);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.needsSplit)).toHaveLength(1);
  });

  it('merges placements that resolve to the same overhang', () => {
    const fit = fitAt(180 / 42, () => WIDE);
    const rows = generatePrintList([binAt('1', 0), binAt('2', 4)], fit);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].totalPieces).toBe(4);
  });
});
