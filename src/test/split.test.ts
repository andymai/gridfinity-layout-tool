import { describe, it, expect } from 'vitest';
import {
  splitBinSize,
  generatePrintList,
  getTotalPieces,
  getTotalBins,
  getTotalFilament,
  getSpoolEstimate,
} from '../utils/split';
import type { Bin, PrintRow } from '../types';
import { STAGING_ID } from '../constants';

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
    const sizes = pieces.map(p => `${p.width}×${p.depth}`).sort();
    expect(sizes).toEqual(['2×3', '3×3', '4×3']);
  });

  it('handles both dimensions exceeding max', () => {
    const pieces = splitBinSize(5, 6, maxSize);
    // Should result in 4 pieces
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    // All pieces should fit
    pieces.forEach(p => {
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
    expect(pieces.every(p => p.width > 0 && p.depth > 0)).toBe(true);
    expect(pieces).toHaveLength(2);
  });

  it('splits depth of 1 without creating zero-depth pieces', () => {
    // 5×1 with max 4: splits width only → 3×1 + 2×1
    const pieces = splitBinSize(5, 1, maxSize);
    expect(pieces.every(p => p.width > 0 && p.depth > 0)).toBe(true);
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
    expect(pieces.every(p => p.width <= 2 && p.depth <= 2)).toBe(true);
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
    expect(pieces.every(p => p.width <= 1 && p.depth <= 1)).toBe(true);
    expect(pieces.every(p => p.width > 0 && p.depth > 0)).toBe(true);
  });

  it('handles 2.5×3 with maxSize 2', () => {
    const pieces = splitBinSize(2.5, 3, 2);
    expect(pieces.every(p => p.width <= 2 && p.depth <= 2)).toBe(true);
    expect(pieces.every(p => p.width > 0 && p.depth > 0)).toBe(true);
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
    expect(pieces.some(p => p.width === 1.5 || p.width === 1)).toBe(true);
    expect(pieces.every(p => p.width <= 2 && p.depth <= 2)).toBe(true);
  });
});

describe('generatePrintList', () => {
  it('groups identical bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].totalPieces).toBe(2);
  });

  it('excludes staging bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(1);
  });

  it('separates bins with different heights', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 6, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(2);
  });

  it('calculates split pieces correctly', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 5, depth: 3, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows[0].needsSplit).toBe(true);
    expect(rows[0].totalPieces).toBe(2); // 3×3 + 2×3
  });

  it('merges identical split pieces from same bin size', () => {
    // A 9x3 bin with maxSize 4 splits into: 3×3 + 2×3 + 4×3
    // Two identical 9x3 bins should result in merged piece counts
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 9, depth: 3, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 0, y: 3, width: 9, depth: 3, height: 3, category: 'c1', label: '', notes: '' },
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
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 6, depth: 6, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows[0].needsSplit).toBe(true);
    // 6x6 with max 4: splits to 4 pieces of 3x3
    expect(rows[0].pieces).toHaveLength(1); // All identical, merged
    expect(rows[0].pieces[0].count).toBe(4);
  });

  it('keeps labeled bins separate even with same dimensions', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: 'Screws', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: 'Bolts', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    // Each labeled bin gets its own row
    expect(rows).toHaveLength(2);
    expect(rows[0].labels).toContain('Screws');
    expect(rows[1].labels).toContain('Bolts');
  });

  it('groups unlabeled bins with same dimensions', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '3', layerId: 'l1', x: 0, y: 2, width: 2, depth: 2, height: 3, category: 'c1', label: 'Special', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    // Two unlabeled bins grouped, one labeled bin separate
    expect(rows).toHaveLength(2);
  });
});

describe('getTotalPieces', () => {
  it('sums totalPieces across all rows', () => {
    const rows: PrintRow[] = [
      { size: '2×2', height: 3, binCount: 2, pieces: [], totalPieces: 2, needsSplit: false, filament: 10, categoryIds: [], labels: [], notes: '', binIds: [] },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 4, needsSplit: true, filament: 20, categoryIds: [], labels: [], notes: '', binIds: [] },
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
      { size: '2×2', height: 3, binCount: 3, pieces: [], totalPieces: 3, needsSplit: false, filament: 10, categoryIds: [], labels: [], notes: '', binIds: [] },
      { size: '4×4', height: 3, binCount: 5, pieces: [], totalPieces: 5, needsSplit: false, filament: 20, categoryIds: [], labels: [], notes: '', binIds: [] },
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
      { size: '2×2', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 10.5, categoryIds: [], labels: [], notes: '', binIds: [] },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 20.3, categoryIds: [], labels: [], notes: '', binIds: [] },
    ];
    expect(getTotalFilament(rows)).toBe(30.8);
  });

  it('rounds to one decimal place', () => {
    const rows: PrintRow[] = [
      { size: '2×2', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 10.123, categoryIds: [], labels: [], notes: '', binIds: [] },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 20.456, categoryIds: [], labels: [], notes: '', binIds: [] },
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
