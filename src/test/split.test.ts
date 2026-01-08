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
});

describe('getTotalPieces', () => {
  it('sums totalPieces across all rows', () => {
    const rows: PrintRow[] = [
      { size: '2×2', height: 3, binCount: 2, pieces: [], totalPieces: 2, needsSplit: false, filament: 10, categoryIds: [], labels: [], notes: '' },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 4, needsSplit: true, filament: 20, categoryIds: [], labels: [], notes: '' },
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
      { size: '2×2', height: 3, binCount: 3, pieces: [], totalPieces: 3, needsSplit: false, filament: 10, categoryIds: [], labels: [], notes: '' },
      { size: '4×4', height: 3, binCount: 5, pieces: [], totalPieces: 5, needsSplit: false, filament: 20, categoryIds: [], labels: [], notes: '' },
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
      { size: '2×2', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 10.5, categoryIds: [], labels: [], notes: '' },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 20.3, categoryIds: [], labels: [], notes: '' },
    ];
    expect(getTotalFilament(rows)).toBe(30.8);
  });

  it('rounds to one decimal place', () => {
    const rows: PrintRow[] = [
      { size: '2×2', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 10.123, categoryIds: [], labels: [], notes: '' },
      { size: '4×4', height: 3, binCount: 1, pieces: [], totalPieces: 1, needsSplit: false, filament: 20.456, categoryIds: [], labels: [], notes: '' },
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
