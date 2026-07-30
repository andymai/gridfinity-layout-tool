import { describe, it, expect } from 'vitest';
import { fillAllWithSize, fillGaps } from '@/shared/utils/fill';
import { createTestLayout as baseCreateTestLayout } from '@/test/testUtils';
import type { Layout } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId, mm } from '@/core/types';

// 6×6 drawer for fill algorithm tests
const createTestLayout = () =>
  baseCreateTestLayout({
    drawer: { width: gridUnits(6), depth: gridUnits(6), height: heightUnits(9) },
    printBedSize: mm(168),
  });

describe('fillAllWithSize', () => {
  it('fills empty layer with specified size', () => {
    const layout = createTestLayout();
    const result = fillAllWithSize(layout, layerId('layer1'), 2, 2, categoryId('cat1'));

    // 6×6 grid with 2×2 bins = 9 bins
    expect(result.bins).toHaveLength(9);
    expect(result.skippedCells).toBe(0);
  });

  it('returns empty for invalid layer', () => {
    const layout = createTestLayout();
    const result = fillAllWithSize(layout, layerId('nonexistent'), 2, 2, categoryId('cat1'));
    expect(result.bins).toHaveLength(0);
    expect(result.skippedCells).toBe(0);
  });

  it('skips cells occupied by existing bins', () => {
    const layout = createTestLayout();
    layout.bins = [
      {
        id: binId('existing'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillAllWithSize(layout, layerId('layer1'), 2, 2, categoryId('cat1'));

    // One position should be skipped
    expect(result.bins).toHaveLength(8);
  });

  it('handles non-divisible grid sizes', () => {
    const layout = createTestLayout();
    layout.drawer.width = gridUnits(5);
    layout.drawer.depth = gridUnits(5);

    const result = fillAllWithSize(layout, layerId('layer1'), 2, 2, categoryId('cat1'));

    // Should create bins, some may be 1-wide at edges
    expect(result.bins.length).toBeGreaterThan(0);
  });

  it('skips cells already covered by newly placed bins', () => {
    const layout = createTestLayout();
    // Use 1x1 bins so each cell is tracked individually
    const result = fillAllWithSize(layout, layerId('layer1'), 1, 1, categoryId('cat1'));
    // All 36 cells should be covered with no skips
    expect(result.bins).toHaveLength(36);
    expect(result.skippedCells).toBe(0);
  });

  it('counts skipped cells when bins partially cover positions', () => {
    const layout = createTestLayout();
    // Place a bin that will cause overlap detection
    layout.bins = [
      {
        id: binId('existing'),
        layerId: layerId('layer1'),
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];
    // Try to fill with 2x2 bins - some positions will be skipped
    const result = fillAllWithSize(layout, layerId('layer1'), 2, 2, categoryId('cat1'));
    expect(result.skippedCells).toBeGreaterThan(0);
  });

  it('skips positions where newly placed bins already cover cells', () => {
    // The covered set tracks cells from bins placed during this fill operation.
    // When iterating with step size < bin size, we may revisit covered positions.
    const layout = createTestLayout();
    layout.drawer.width = gridUnits(4);
    layout.drawer.depth = gridUnits(4);
    // Use 3x3 bins with step of 3, but grid is 4x4
    // First bin at (0,0) covers cells (0,0)-(2,2)
    // Next iteration at (3,0) - doesn't overlap with covered set
    const result = fillAllWithSize(layout, layerId('layer1'), 3, 3, categoryId('cat1'));
    // Should place 1 bin at (0,0) since (3,0) doesn't fit (3+3=6 > 4)
    expect(result.bins).toHaveLength(1);
    // (3,0), (0,3), (3,3) are all skipped due to bounds
    expect(result.skippedCells).toBe(3);
  });

  it('stops at QUICK_FILL_MAX_BINS limit', () => {
    const layout = createTestLayout();
    // Large drawer to hit the 2500 bin limit
    layout.drawer.width = gridUnits(60);
    layout.drawer.depth = gridUnits(60);
    const result = fillAllWithSize(layout, layerId('layer1'), 1, 1, categoryId('cat1'));
    // Should stop at 2500 bins even though 3600 could fit
    expect(result.bins).toHaveLength(2500);
  });
});

describe('fillGaps', () => {
  it('fills gaps with optimal sizes', () => {
    const layout = createTestLayout();
    layout.bins = [
      {
        id: binId('existing'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(4),
        depth: gridUnits(4),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillGaps(layout, layerId('layer1'), categoryId('cat1'), 4);

    // Should fill remaining space
    expect(result.bins.length).toBeGreaterThan(0);
  });

  it('returns empty array for full layer', () => {
    const layout = createTestLayout();
    layout.drawer.width = gridUnits(2);
    layout.drawer.depth = gridUnits(2);
    layout.bins = [
      {
        id: binId('full'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillGaps(layout, layerId('layer1'), categoryId('cat1'), 4);

    expect(result.bins).toHaveLength(0);
  });

  it('returns empty for invalid layer', () => {
    const layout = createTestLayout();
    const result = fillGaps(layout, layerId('nonexistent'), categoryId('cat1'), 4);
    expect(result.bins).toHaveLength(0);
    expect(result.addedCount).toBe(0);
  });
});

describe('fillAllWithSize with blocked zones', () => {
  const createMultiLayerLayout = (): Layout => ({
    version: '1.0',
    name: 'Test',
    drawer: { width: gridUnits(6), depth: gridUnits(6), height: heightUnits(12) },
    printBedSize: mm(168),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    categories: [{ id: categoryId('cat1'), name: 'Test', color: '#000' }],
    layers: [
      { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
    ],
    bins: [],
  });

  it('skips blocked zones from protruding lower layer bins', () => {
    const layout = createMultiLayerLayout();
    // Add a bin on layer 1 with clearanceHeight that protrudes into layer 2
    // Layer 1 starts at z=0, has height=3
    // Bin has height=3 and clearanceHeight=2, so it extends to z=5
    // Layer 2 starts at z=3, so the protruding bin blocks footprint on layer 2
    layout.bins = [
      {
        id: binId('protruding'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2), // Protrudes into layer 2
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    // Fill layer 2 with 2x2 bins
    const result = fillAllWithSize(layout, layerId('layer2'), 2, 2, categoryId('cat1'));

    // 6×6 grid with 2×2 bins = 9 positions normally
    // But (0,0) is blocked by protruding bin
    // So we should get 8 bins
    expect(result.bins).toHaveLength(8);

    // Verify none of the bins overlap with the blocked zone (0,0 to 2,2)
    for (const bin of result.bins) {
      const overlapsBlocked =
        bin.x < 2 && bin.x + bin.width > 0 && bin.y < 2 && bin.y + bin.depth > 0;
      expect(overlapsBlocked).toBe(false);
    }
  });

  it('handles multiple blocked zones from multiple protruding bins', () => {
    const layout = createMultiLayerLayout();
    // Add two bins on layer 1 that protrude into layer 2
    layout.bins = [
      {
        id: binId('protruding1'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
      {
        id: binId('protruding2'),
        layerId: layerId('layer1'),
        x: gridUnits(4),
        y: gridUnits(4),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillAllWithSize(layout, layerId('layer2'), 2, 2, categoryId('cat1'));

    // 9 positions - 2 blocked = 7 bins
    expect(result.bins).toHaveLength(7);
  });

  it('allows filling when lower layer bins do not protrude', () => {
    const layout = createMultiLayerLayout();
    // Bin without clearanceHeight - doesn't protrude
    layout.bins = [
      {
        id: binId('nonprotruding'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        // No clearanceHeight, so doesn't protrude
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillAllWithSize(layout, layerId('layer2'), 2, 2, categoryId('cat1'));

    // All 9 positions should be available
    expect(result.bins).toHaveLength(9);
  });

  it('handles blocked zone covering entire layer', () => {
    const layout = createMultiLayerLayout();
    // Add a bin that blocks the entire layer 2
    layout.bins = [
      {
        id: binId('bigprotruding'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(6),
        depth: gridUnits(6),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillAllWithSize(layout, layerId('layer2'), 2, 2, categoryId('cat1'));

    // All positions blocked
    expect(result.bins).toHaveLength(0);
    expect(result.skippedCells).toBe(9); // All 9 2x2 positions skipped
  });
});

describe('fillGaps with blocked zones', () => {
  const createMultiLayerLayout = (): Layout => ({
    version: '1.0',
    name: 'Test',
    drawer: { width: gridUnits(6), depth: gridUnits(6), height: heightUnits(12) },
    printBedSize: mm(168),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    categories: [{ id: categoryId('cat1'), name: 'Test', color: '#000' }],
    layers: [
      { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
    ],
    bins: [],
  });

  it('respects blocked zones when filling gaps', () => {
    const layout = createMultiLayerLayout();
    // Protruding bin from layer 1
    layout.bins = [
      {
        id: binId('protruding'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    // Fill gaps on layer 2
    const result = fillGaps(layout, layerId('layer2'), categoryId('cat1'), 4);

    // Should have some bins, but not in the blocked zone
    expect(result.bins.length).toBeGreaterThan(0);

    // Verify no bins overlap with blocked zone (0,0 to 3,3)
    for (const bin of result.bins) {
      const overlapsBlocked =
        bin.x < 3 && bin.x + bin.width > 0 && bin.y < 3 && bin.y + bin.depth > 0;
      expect(overlapsBlocked).toBe(false);
    }
  });

  it('fills around partial blocked zones optimally', () => {
    const layout = createMultiLayerLayout();
    // Protruding bin blocking corner
    layout.bins = [
      {
        id: binId('cornerblock'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillGaps(layout, layerId('layer2'), categoryId('cat1'), 4);

    // Calculate expected coverage: 36 total cells - 4 blocked = 32 available
    const totalBinCells = result.bins.reduce((sum, b) => sum + b.width * b.depth, 0);
    expect(totalBinCells).toBe(32);
  });

  it('returns empty when entire layer is blocked', () => {
    const layout = createMultiLayerLayout();
    layout.bins = [
      {
        id: binId('fullblock'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(6),
        depth: gridUnits(6),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillGaps(layout, layerId('layer2'), categoryId('cat1'), 4);

    expect(result.bins).toHaveLength(0);
    expect(result.addedCount).toBe(0);
  });

  it('combines blocked zones with existing bins on target layer', () => {
    const layout = createMultiLayerLayout();
    layout.bins = [
      // Protruding bin from layer 1 blocking (0,0)-(2,2)
      {
        id: binId('protruding'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        clearanceHeight: heightUnits(2),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
      // Existing bin on layer 2 at (4,4)-(6,6)
      {
        id: binId('existing'),
        layerId: layerId('layer2'),
        x: gridUnits(4),
        y: gridUnits(4),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: '',
        notes: '',
      },
    ];

    const result = fillGaps(layout, layerId('layer2'), categoryId('cat1'), 4);

    // 36 cells - 4 blocked - 4 existing = 28 cells to fill
    const totalBinCells = result.bins.reduce((sum, b) => sum + b.width * b.depth, 0);
    expect(totalBinCells).toBe(28);
  });
});
