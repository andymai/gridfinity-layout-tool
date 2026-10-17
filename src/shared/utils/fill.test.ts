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

  it('skips cells over clearance a lower-layer bin reserves', () => {
    const layout = createMultiLayerLayout();
    // A fill bin there would rest on the contents the clearance protects.
    layout.bins = [
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
    ];

    // Fill layer 2 with 2x2 bins
    const result = fillAllWithSize(layout, layerId('layer2'), 2, 2, categoryId('cat1'));

    // 6×6 grid with 2×2 bins = 9 positions; the clearance takes (0,0)
    expect(result.bins).toHaveLength(8);

    // Verify none of the bins overlap with the blocked zone (0,0 to 2,2)
    for (const bin of result.bins) {
      const overlapsBlocked =
        bin.x < 2 && bin.x + bin.width > 0 && bin.y < 2 && bin.y + bin.depth > 0;
      expect(overlapsBlocked).toBe(false);
    }
  });

  it('handles clearance from several lower-layer bins', () => {
    const layout = createMultiLayerLayout();
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

  it('fills on top of lower-layer bins without clearance', () => {
    const layout = createMultiLayerLayout();
    layout.bins = [
      {
        id: binId('nonprotruding'),
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

describe('fill and the resting stack', () => {
  const layout = (bins: Layout['bins']): Layout => ({
    version: '1.0',
    name: 'Test',
    drawer: { width: gridUnits(4), depth: gridUnits(2), height: heightUnits(8) },
    printBedSize: mm(168),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    categories: [{ id: categoryId('cat1'), name: 'Test', color: '#000' }],
    layers: [
      { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
    ],
    bins,
  });
  const bin = (id: string, layer: string, x: number, height: number): Layout['bins'][number] => ({
    id: binId(id),
    layerId: layerId(layer),
    x: gridUnits(x),
    y: gridUnits(0),
    width: gridUnits(2),
    depth: gridUnits(2),
    height: heightUnits(height),
    category: categoryId('cat1'),
    label: '',
    notes: '',
  });

  it('skips cells where a layer-height bin would rest past the drawer top', () => {
    // 6u + 3u passes the 8u drawer; the plate beside it leaves room.
    const result = fillAllWithSize(
      layout([bin('tall', 'layer1', 0, 6)]),
      layerId('layer2'),
      2,
      2,
      categoryId('cat1')
    );
    expect(result.bins.map((b) => b.x)).toEqual([2]);
  });

  it('drops fill bins that would lift a bin above past the drawer', () => {
    // Filling layer 1 lifts the 6u layer-2 bin onto a 3u fill bin: 9u > 8u.
    // The 2u one beside it ends at 5u and stays.
    const result = fillAllWithSize(
      layout([bin('high', 'layer2', 0, 6), bin('low', 'layer2', 2, 2)]),
      layerId('layer1'),
      2,
      2,
      categoryId('cat1')
    );
    expect(result.bins.map((b) => b.x)).toEqual([2]);
    expect(result.skippedCells).toBe(1);
  });

  it('stays fast when every upper bin rests on many shared supporters', () => {
    // Alternating rows and columns on many layers give each bin several
    // supporters below it; an unremembered walk revisits them exponentially.
    const layers = Array.from({ length: 13 }, (_, i) => ({
      id: layerId(`l${String(i)}`),
      name: `Layer ${String(i)}`,
      height: heightUnits(2),
    }));
    const bins: Layout['bins'] = [];
    for (let i = 1; i < layers.length; i++) {
      for (let k = 0; k < 4; k++) {
        const vertical = i % 2 === 0;
        bins.push({
          id: binId(`b${String(i)}-${String(k)}`),
          layerId: layers[i].id,
          x: gridUnits(vertical ? k : 0),
          y: gridUnits(vertical ? 0 : k),
          width: gridUnits(vertical ? 1 : 4),
          depth: gridUnits(vertical ? 4 : 1),
          height: heightUnits(2),
          category: categoryId('cat1'),
          label: '',
          notes: '',
        });
      }
    }
    const tall: Layout = {
      ...layout(bins),
      drawer: { width: gridUnits(4), depth: gridUnits(4), height: heightUnits(25) },
      layers,
    };
    const started = performance.now();
    const result = fillAllWithSize(tall, layers[0].id, 1, 1, categoryId('cat1'));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result.bins).toHaveLength(0);
  });

  it('packs around a lift it cannot make instead of leaving the region empty', () => {
    // A 4×2 gap bin would lift the 6u bin to 9u in the 8u drawer; the right
    // 2×2 lifts nothing and still gets filled.
    const result = fillGaps(
      layout([bin('high', 'layer2', 0, 6)]),
      layerId('layer1'),
      categoryId('cat1'),
      4
    );
    expect(result.bins.map((b) => [b.x, b.width])).toEqual([[2, 2]]);
  });

  it('applies the same lift rule to filling gaps', () => {
    const result = fillGaps(
      layout([bin('high', 'layer2', 0, 6), bin('low', 'layer2', 2, 2)]),
      layerId('layer1'),
      categoryId('cat1'),
      2
    );
    expect(result.bins.every((b) => b.x >= 2)).toBe(true);
    expect(result.addedCount).toBeGreaterThan(0);
  });
});
