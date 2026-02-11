import { describe, it, expect } from 'vitest';
import { getClusterKey, clusterBins, packBins } from './packing';
import type { PackedBin } from './packing';
import { binId, categoryId } from '@/core/types';
import type { BinId, CategoryId } from '@/core/types';

/** Test helper: create PackedBin with minimal required fields */
function makeBin(overrides: Partial<PackedBin> & { id: BinId; category: CategoryId }): PackedBin {
  return {
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 1,
    label: '',
    ...overrides,
  };
}

describe('getClusterKey', () => {
  it('should create key from category and floored dimensions', () => {
    const bin = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 2,
      depth: 3,
    });

    expect(getClusterKey(bin)).toBe('cat-1_2_3');
  });

  it('should floor width and depth dimensions', () => {
    const bin = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 2.9,
      depth: 3.7,
    });

    expect(getClusterKey(bin)).toBe('cat-1_2_3');
  });

  it('should treat 2.0 and 2.9 as same cluster (both floor to 2)', () => {
    const bin1 = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 2.0,
      depth: 3.0,
    });
    const bin2 = makeBin({
      id: binId('2'),
      category: categoryId('cat-1'),
      width: 2.9,
      depth: 3.9,
    });

    expect(getClusterKey(bin1)).toBe(getClusterKey(bin2));
  });

  it('should separate 1.9 and 2.0 into different clusters (floor to 1 vs 2)', () => {
    const bin1 = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 1.9,
      depth: 3.0,
    });
    const bin2 = makeBin({
      id: binId('2'),
      category: categoryId('cat-1'),
      width: 2.0,
      depth: 3.0,
    });

    expect(getClusterKey(bin1)).toBe('cat-1_1_3');
    expect(getClusterKey(bin2)).toBe('cat-1_2_3');
  });

  it('should separate different categories even with same dimensions', () => {
    const bin1 = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 2,
      depth: 3,
    });
    const bin2 = makeBin({
      id: binId('2'),
      category: categoryId('cat-2'),
      width: 2,
      depth: 3,
    });

    expect(getClusterKey(bin1)).toBe('cat-1_2_3');
    expect(getClusterKey(bin2)).toBe('cat-2_2_3');
  });

  it('should separate 2×3 from 3×2 (different dimensions)', () => {
    const bin1 = makeBin({
      id: binId('1'),
      category: categoryId('cat-1'),
      width: 2,
      depth: 3,
    });
    const bin2 = makeBin({
      id: binId('2'),
      category: categoryId('cat-1'),
      width: 3,
      depth: 2,
    });

    expect(getClusterKey(bin1)).toBe('cat-1_2_3');
    expect(getClusterKey(bin2)).toBe('cat-1_3_2');
  });
});

describe('clusterBins', () => {
  it('should return empty array for empty input', () => {
    expect(clusterBins([])).toEqual([]);
  });

  it('should group bins with same category and floored dimensions together', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 2.1, depth: 3.0 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 2.9, depth: 3.8 }),
      makeBin({ id: binId('3'), category: categoryId('cat-2'), width: 2.5, depth: 3.5 }),
    ];

    const result = clusterBins(bins);

    // Bins 1 and 2 should be together (cat-1, floor to 2×3)
    // Bin 3 should be separate (cat-2, floor to 2×3)
    expect(result).toHaveLength(3);

    // Find positions of bins in result
    const idx1 = result.findIndex((b) => b.id === binId('1'));
    const idx2 = result.findIndex((b) => b.id === binId('2'));
    const idx3 = result.findIndex((b) => b.id === binId('3'));

    // Bins 1 and 2 should be adjacent (same cluster: cat-1_2_3)
    expect(Math.abs(idx1 - idx2)).toBe(1);
    // Both clusters have same size (2 bins vs 1 bin), so cat-1 cluster comes first
    // Then cat-2 cluster, so bin 3 should be at position 2
    expect(idx3).toBe(2);
  });

  it('should sort clusters by size (most bins first)', () => {
    const bins = [
      // cat-1: 2 bins
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 1, depth: 1 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 1, depth: 1 }),
      // cat-2: 3 bins
      makeBin({ id: binId('3'), category: categoryId('cat-2'), width: 2, depth: 2 }),
      makeBin({ id: binId('4'), category: categoryId('cat-2'), width: 2, depth: 2 }),
      makeBin({ id: binId('5'), category: categoryId('cat-2'), width: 2, depth: 2 }),
      // cat-3: 1 bin
      makeBin({ id: binId('6'), category: categoryId('cat-3'), width: 3, depth: 3 }),
    ];

    const result = clusterBins(bins);

    // cat-2 cluster (3 bins) should come first
    expect(result[0].category).toBe(categoryId('cat-2'));
    expect(result[1].category).toBe(categoryId('cat-2'));
    expect(result[2].category).toBe(categoryId('cat-2'));

    // cat-1 cluster (2 bins) should come second
    expect(result[3].category).toBe(categoryId('cat-1'));
    expect(result[4].category).toBe(categoryId('cat-1'));

    // cat-3 cluster (1 bin) should come last
    expect(result[5].category).toBe(categoryId('cat-3'));
  });

  it('should sort within cluster by area (largest first)', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 2, depth: 2 }), // area 4
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 2.5, depth: 2.9 }), // area ~7.25, floor to 2×2
      makeBin({ id: binId('3'), category: categoryId('cat-1'), width: 2.1, depth: 2.1 }), // area ~4.41, floor to 2×2
    ];

    const result = clusterBins(bins);

    // All three bins cluster together (cat-1_2_2)
    // Within cat-1_2_2 cluster, sorted by area (largest first)
    expect(result[0].id).toBe(binId('2')); // 2.5×2.9 ≈ 7.25
    expect(result[1].id).toBe(binId('3')); // 2.1×2.1 ≈ 4.41
    expect(result[2].id).toBe(binId('1')); // 2×2 = 4
  });

  it('should use key alphabetical order for tie-breaking when clusters have same size', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-b'), width: 1, depth: 1 }),
      makeBin({ id: binId('2'), category: categoryId('cat-a'), width: 1, depth: 1 }),
    ];

    const result = clusterBins(bins);

    // cat-a_1_1 < cat-b_1_1 alphabetically
    expect(result[0].category).toBe(categoryId('cat-a'));
    expect(result[1].category).toBe(categoryId('cat-b'));
  });

  it('should handle complex scenario with multiple clusters', () => {
    const bins = [
      // Electronics 2×3: 4 bins, different areas
      makeBin({
        id: binId('e1'),
        category: categoryId('electronics'),
        width: 2.5,
        depth: 3.9,
        label: 'E1',
      }), // area ~10
      makeBin({
        id: binId('e2'),
        category: categoryId('electronics'),
        width: 2.1,
        depth: 3.1,
        label: 'E2',
      }), // area ~6.5
      makeBin({
        id: binId('e3'),
        category: categoryId('electronics'),
        width: 2.9,
        depth: 3.2,
        label: 'E3',
      }), // area ~9.3
      makeBin({
        id: binId('e4'),
        category: categoryId('electronics'),
        width: 2.0,
        depth: 3.0,
        label: 'E4',
      }), // area 6
      // Hardware 1×1: 2 bins
      makeBin({
        id: binId('h1'),
        category: categoryId('hardware'),
        width: 1,
        depth: 1,
        label: 'H1',
      }),
      makeBin({
        id: binId('h2'),
        category: categoryId('hardware'),
        width: 1,
        depth: 1,
        label: 'H2',
      }),
      // Tools 3×2: 1 bin
      makeBin({ id: binId('t1'), category: categoryId('tools'), width: 3, depth: 2, label: 'T1' }),
    ];

    const result = clusterBins(bins);

    // Electronics cluster (4 bins) comes first
    expect(result[0].category).toBe(categoryId('electronics'));
    expect(result[1].category).toBe(categoryId('electronics'));
    expect(result[2].category).toBe(categoryId('electronics'));
    expect(result[3].category).toBe(categoryId('electronics'));

    // Within electronics cluster, sorted by area (largest first)
    expect(result[0].id).toBe(binId('e1')); // 2.5×3.9
    expect(result[1].id).toBe(binId('e3')); // 2.9×3.2
    expect(result[2].id).toBe(binId('e2')); // 2.1×3.1
    expect(result[3].id).toBe(binId('e4')); // 2.0×3.0

    // Hardware cluster (2 bins) comes second
    expect(result[4].category).toBe(categoryId('hardware'));
    expect(result[5].category).toBe(categoryId('hardware'));

    // Tools cluster (1 bin) comes last
    expect(result[6].category).toBe(categoryId('tools'));
  });
});

describe('packBins', () => {
  it('should return empty array for empty input', () => {
    expect(packBins([], 10)).toEqual([]);
  });

  it('should place single bin at (0,0)', () => {
    const bins = [makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 2, depth: 3 })];

    const result = packBins(bins, 10);

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });

  it('should pack multiple bins without overlap', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 2, depth: 2 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 2, depth: 2 }),
    ];

    const result = packBins(bins, 10);

    expect(result).toHaveLength(2);

    // Check no overlap using bounding boxes
    const occupied = new Set<string>();
    for (const bin of result) {
      for (let x = bin.x; x < bin.x + bin.width; x++) {
        for (let y = bin.y; y < bin.y + bin.depth; y++) {
          const key = `${Math.floor(x)},${Math.floor(y)}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
        }
      }
    }
  });

  it('should fit bins within grid width', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 2, depth: 1 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 2, depth: 1 }),
      makeBin({ id: binId('3'), category: categoryId('cat-1'), width: 2, depth: 1 }),
    ];

    const gridWidth = 5;
    const result = packBins(bins, gridWidth);

    // All bins should fit within grid width
    for (const bin of result) {
      expect(bin.x + bin.width).toBeLessThanOrEqual(gridWidth);
    }
  });

  it('should wrap large bin to next row when it does not fit horizontally', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 3, depth: 1 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 4, depth: 1 }),
    ];

    const gridWidth = 5;
    const result = packBins(bins, gridWidth);

    expect(result).toHaveLength(2);

    // First bin at (0,0)
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);

    // Second bin (width 4) doesn't fit next to first (x=3, width=4 would exceed grid width 5)
    // So it wraps to next row
    expect(result[1].x).toBe(0);
    expect(result[1].y).toBe(1);
  });

  it('should handle fractional dimensions using ceil for occupancy', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 1.5, depth: 1.5 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 1.5, depth: 1.5 }),
    ];

    const result = packBins(bins, 10);

    expect(result).toHaveLength(2);

    // First bin at (0,0), occupies ceil(1.5) = 2 grid cells in each dimension
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);

    // Second bin should not overlap, accounting for ceiling
    // If placed at (1.5, 0), it would overlap because ceil(1.5) = 2 extends to x=2
    // and bin1's occupancy extends from 0 to 2
    expect(result[1].x >= 2 || result[1].y >= 2).toBe(true);
  });

  it('should pack bins left-to-right, bottom-to-top', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 1, depth: 1 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 1, depth: 1 }),
      makeBin({ id: binId('3'), category: categoryId('cat-1'), width: 1, depth: 1 }),
    ];

    const result = packBins(bins, 3);

    // Should fill first row left-to-right
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[1]).toMatchObject({ x: 1, y: 0 });
    expect(result[2]).toMatchObject({ x: 2, y: 0 });
  });

  it('should use clustering to organize bins by category and size', () => {
    const bins = [
      // Small hardware bin
      makeBin({ id: binId('h1'), category: categoryId('hardware'), width: 1, depth: 1 }),
      // Large electronics bins (bigger cluster)
      makeBin({ id: binId('e1'), category: categoryId('electronics'), width: 2, depth: 2 }),
      makeBin({ id: binId('e2'), category: categoryId('electronics'), width: 2, depth: 2 }),
      makeBin({ id: binId('e3'), category: categoryId('electronics'), width: 2, depth: 2 }),
    ];

    const result = packBins(bins, 10);

    // Electronics cluster (3 bins) should be packed first
    // because clusterBins sorts by cluster size
    expect(result[0].category).toBe(categoryId('electronics'));
    expect(result[1].category).toBe(categoryId('electronics'));
    expect(result[2].category).toBe(categoryId('electronics'));

    // Hardware bin packed last
    expect(result[3].category).toBe(categoryId('hardware'));
  });

  it('should handle edge case with zero-width or zero-depth bins gracefully', () => {
    // According to the implementation, ceil(0) || 1 ensures minimum 1 grid cell
    const bins = [makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 0, depth: 1 })];

    const result = packBins(bins, 10);

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });

  it('should pack complex scenario with varied sizes', () => {
    const bins = [
      makeBin({ id: binId('1'), category: categoryId('cat-1'), width: 3, depth: 2 }),
      makeBin({ id: binId('2'), category: categoryId('cat-1'), width: 2, depth: 1 }),
      makeBin({ id: binId('3'), category: categoryId('cat-1'), width: 1, depth: 1 }),
      makeBin({ id: binId('4'), category: categoryId('cat-1'), width: 2, depth: 2 }),
    ];

    const gridWidth = 5;
    const result = packBins(bins, gridWidth);

    expect(result).toHaveLength(4);

    // Verify all bins fit within grid width
    for (const bin of result) {
      expect(bin.x + bin.width).toBeLessThanOrEqual(gridWidth);
    }

    // Verify no overlaps
    const occupied = new Set<string>();
    for (const bin of result) {
      const ceilW = Math.ceil(bin.width) || 1;
      const ceilD = Math.ceil(bin.depth) || 1;
      const baseX = Math.floor(bin.x);
      const baseY = Math.floor(bin.y);

      for (let dx = 0; dx < ceilW; dx++) {
        for (let dy = 0; dy < ceilD; dy++) {
          const key = `${baseX + dx},${baseY + dy}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
        }
      }
    }
  });
});
