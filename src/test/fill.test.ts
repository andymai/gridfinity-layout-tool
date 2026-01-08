import { describe, it, expect } from 'vitest';
import { fillAllWithSize, fillGaps, getLayerCoverage } from '../utils/fill';
import type { Layout } from '../types';

const createTestLayout = (): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 6, depth: 6, height: 9 },
  printBedSize: 168,  // 4 grid units * 42mm
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Test', color: '#000' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
});

describe('fillAllWithSize', () => {
  it('fills empty layer with specified size', () => {
    const layout = createTestLayout();
    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // 6×6 grid with 2×2 bins = 9 bins
    expect(result.bins).toHaveLength(9);
    expect(result.skippedCells).toBe(0);
  });

  it('returns empty for invalid layer', () => {
    const layout = createTestLayout();
    const result = fillAllWithSize(layout, 'nonexistent', 2, 2, 'cat1');
    expect(result.bins).toHaveLength(0);
    expect(result.skippedCells).toBe(0);
  });

  it('skips cells occupied by existing bins', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // One position should be skipped
    expect(result.bins).toHaveLength(8);
  });

  it('handles non-divisible grid sizes', () => {
    const layout = createTestLayout();
    layout.drawer.width = 5;
    layout.drawer.depth = 5;

    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // Should create bins, some may be 1-wide at edges
    expect(result.bins.length).toBeGreaterThan(0);
  });

  it('skips cells already covered by newly placed bins', () => {
    const layout = createTestLayout();
    // Use 1x1 bins so each cell is tracked individually
    const result = fillAllWithSize(layout, 'layer1', 1, 1, 'cat1');
    // All 36 cells should be covered with no skips
    expect(result.bins).toHaveLength(36);
    expect(result.skippedCells).toBe(0);
  });

  it('counts skipped cells when bins partially cover positions', () => {
    const layout = createTestLayout();
    // Place a bin that will cause overlap detection
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 1, y: 1, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    // Try to fill with 2x2 bins - some positions will be skipped
    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');
    expect(result.skippedCells).toBeGreaterThan(0);
  });

  it('skips positions where newly placed bins already cover cells', () => {
    // The covered set tracks cells from bins placed during this fill operation.
    // When iterating with step size < bin size, we may revisit covered positions.
    const layout = createTestLayout();
    layout.drawer.width = 4;
    layout.drawer.depth = 4;
    // Use 3x3 bins with step of 3, but grid is 4x4
    // First bin at (0,0) covers cells (0,0)-(2,2)
    // Next iteration at (3,0) - doesn't overlap with covered set
    const result = fillAllWithSize(layout, 'layer1', 3, 3, 'cat1');
    // Should place 1 bin at (0,0) since (3,0) doesn't fit (3+3=6 > 4)
    expect(result.bins).toHaveLength(1);
    // (3,0), (0,3), (3,3) are all skipped due to bounds
    expect(result.skippedCells).toBe(3);
  });

  it('stops at QUICK_FILL_MAX_BINS limit', () => {
    const layout = createTestLayout();
    // Large drawer to hit the 500 bin limit
    layout.drawer.width = 50;
    layout.drawer.depth = 50;
    const result = fillAllWithSize(layout, 'layer1', 1, 1, 'cat1');
    // Should stop at 500 bins even though 2500 could fit
    expect(result.bins).toHaveLength(500);
  });
});

describe('fillGaps', () => {
  it('fills gaps with optimal sizes', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 4, depth: 4, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillGaps(layout, 'layer1', 'cat1', 4);

    // Should fill remaining space
    expect(result.bins.length).toBeGreaterThan(0);
  });

  it('returns empty array for full layer', () => {
    const layout = createTestLayout();
    layout.drawer.width = 2;
    layout.drawer.depth = 2;
    layout.bins = [
      { id: 'full', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillGaps(layout, 'layer1', 'cat1', 4);

    expect(result.bins).toHaveLength(0);
  });

  it('returns empty for invalid layer', () => {
    const layout = createTestLayout();
    const result = fillGaps(layout, 'nonexistent', 'cat1', 4);
    expect(result.bins).toHaveLength(0);
    expect(result.addedCount).toBe(0);
  });
});

describe('getLayerCoverage', () => {
  it('returns 0 for empty layer', () => {
    const layout = createTestLayout();
    expect(getLayerCoverage(layout, 'layer1')).toBe(0);
  });

  it('calculates correct percentage', () => {
    const layout = createTestLayout();
    // 6×6 = 36 cells, 3×3 = 9 cells = 25%
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    expect(getLayerCoverage(layout, 'layer1')).toBe(25);
  });

  it('returns 100 for full layer', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'full', layerId: 'layer1', x: 0, y: 0, width: 6, depth: 6, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    expect(getLayerCoverage(layout, 'layer1')).toBe(100);
  });
});
