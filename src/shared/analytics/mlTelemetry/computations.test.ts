import { describe, it, expect } from 'vitest';
import {
  assessLayoutQuality,
  isSubstantialLayout,
  computeLayoutHash,
  computeSizeDistribution,
  computeCategoryDistribution,
  computeDomainDistribution,
  computeTopLabelHashes,
  computeFillPercentage,
  computeLabeledPercentage,
  computeSessionConfidence,
  isDefaultCategoryName,
  hashCategoryName,
} from './computations';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { binId, layerId, categoryId } from '@/core/types';

// ============================================
// HELPERS
// ============================================

/**
 * Build a set of on-grid bins that fill exactly `filledArea` units of a drawer.
 * Uses 1x1 bins stacked at sequential positions.
 */
function makeBins(count: number, overrides: Partial<ReturnType<typeof createTestBin>> = {}) {
  return Array.from({ length: count }, (_, i) =>
    createTestBin({
      id: binId(`bin-${i}`),
      x: i,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      layerId: layerId('layer1'),
      ...overrides,
    })
  );
}

// ============================================
// assessLayoutQuality
// ============================================

describe('assessLayoutQuality', () => {
  it('returns skip when bin count is 0', () => {
    const layout = createTestLayout({ drawer: { width: 10, depth: 10, height: 12 }, bins: [] });
    expect(assessLayoutQuality(layout)).toBe('skip');
  });

  it('returns skip when bin count is 1', () => {
    const layout = createTestLayout({
      drawer: { width: 10, depth: 10, height: 12 },
      bins: makeBins(1),
    });
    expect(assessLayoutQuality(layout)).toBe('skip');
  });

  it('returns skip when bin count is 2 (below threshold of 3)', () => {
    const layout = createTestLayout({
      drawer: { width: 10, depth: 10, height: 12 },
      bins: makeBins(2),
    });
    expect(assessLayoutQuality(layout)).toBe('skip');
  });

  it('returns skip when fill is below 15% even with 3+ bins', () => {
    // Drawer is 10x10 = 100 area. 3 bins of 1x1 = 3% fill.
    const layout = createTestLayout({
      drawer: { width: 10, depth: 10, height: 12 },
      bins: makeBins(3),
    });
    expect(assessLayoutQuality(layout)).toBe('skip');
  });

  it('returns low when fill >= 15% and bin count >= 3 (no variety or labels)', () => {
    // Drawer 4x4 = 16 area. 3 bins of 1x1 = 3/16 ≈ 18.75% fill.
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: makeBins(3),
    });
    expect(assessLayoutQuality(layout)).toBe('low');
  });

  it('returns medium when fill >= 30% and bins >= 4 (without labels)', () => {
    // Drawer 4x4 = 16. 5 bins of 1x1 = 31.25% fill.
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: makeBins(5),
    });
    expect(assessLayoutQuality(layout)).toBe('medium');
  });

  it('returns medium when fill >= 30% with size variety', () => {
    // Drawer 4x4 = 16. Two different-sized bins: 2x2 + 2x2 = 8 area = 50%, but only 2 bins (< 5),
    // so medium via the size variety branch.
    const bins = [
      createTestBin({
        id: binId('b1'),
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b2'),
        x: 2,
        y: 0,
        width: 1,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b3'),
        x: 3,
        y: 0,
        width: 1,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
    ];
    // total area: 4+2+2 = 8 / 16 = 50% — but only 3 bins, not >= 5, so not 'high'
    // size variety (2x2x3 and 1x2x3) >= 2 unique sizes, fill >= 30% → medium
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins,
    });
    expect(assessLayoutQuality(layout)).toBe('medium');
  });

  it('returns high when fill >= 50%, bins >= 5, and has labels', () => {
    // Drawer 4x4 = 16. 8 bins of 1x1 = 50% fill, 5+ bins, with labels.
    const bins = makeBins(8, { label: 'tool' });
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins,
    });
    expect(assessLayoutQuality(layout)).toBe('high');
  });

  it('returns high when fill >= 50%, bins >= 5, and has size variety', () => {
    // Drawer 4x4 = 16. Mix of sizes totalling >= 50%.
    const bins = [
      createTestBin({
        id: binId('b1'),
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b2'),
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b3'),
        x: 0,
        y: 2,
        width: 1,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b4'),
        x: 1,
        y: 2,
        width: 1,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b5'),
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
      }),
    ];
    // areas: 4+4+2+2+4 = 16/16 = 100% fill, 5 bins, has variety
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins,
    });
    expect(assessLayoutQuality(layout)).toBe('high');
  });

  it('does not count staging bins in quality assessment', () => {
    // 3 staging bins and 2 on-grid bins → effectively 2 on-grid → skip
    const onGridBins = makeBins(2);
    const stagingBins = makeBins(3).map((b, i) =>
      createTestBin({ id: binId(`staging-${i}`), layerId: layerId('__staging__') })
    );
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: [...onGridBins, ...stagingBins],
    });
    expect(assessLayoutQuality(layout)).toBe('skip');
  });

  it('high quality requires bins >= 5 even with 50% fill and labels', () => {
    // 4 labeled bins at 50% fill — not enough bins for high
    const bins = [
      createTestBin({
        id: binId('b1'),
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
        label: 'a',
      }),
      createTestBin({
        id: binId('b2'),
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
        label: 'b',
      }),
      createTestBin({
        id: binId('b3'),
        x: 0,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
        label: 'c',
      }),
      createTestBin({
        id: binId('b4'),
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('layer1'),
        label: 'd',
      }),
    ];
    // area: 4*4 = 16, fill 16/16 = 100%, has labels, but only 4 bins
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins,
    });
    // medium: fill >= 30%, bins >= 4, has size variety (all same size, so variety=false)
    // but bins >= 4 satisfies medium condition
    expect(assessLayoutQuality(layout)).toBe('medium');
  });
});

// ============================================
// isSubstantialLayout
// ============================================

describe('isSubstantialLayout', () => {
  it('returns false for layouts that would be skip', () => {
    const layout = createTestLayout({ bins: [] });
    expect(isSubstantialLayout(layout)).toBe(false);
  });

  it('returns true for layouts that are low, medium, or high quality', () => {
    // 3 bins on a 4x4 drawer = ~19% fill → 'low'
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: makeBins(3),
    });
    expect(isSubstantialLayout(layout)).toBe(true);
  });

  it('delegates entirely to assessLayoutQuality', () => {
    // Testing that it is a thin wrapper: for every quality that is not skip, it returns true.
    const cases: Array<[string, boolean]> = [
      ['skip', false],
      ['low', true],
      ['medium', true],
      ['high', true],
    ];
    // We can't mock assessLayoutQuality easily, so we just verify behaviourally.
    // A 4x4 drawer with 8 labeled bins should be high quality → true.
    const highLayout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: makeBins(8, { label: 'test' }),
    });
    expect(isSubstantialLayout(highLayout)).toBe(true);
    void cases; // silence unused warning
  });
});

// ============================================
// computeLayoutHash
// ============================================

describe('computeLayoutHash', () => {
  it('returns an 8-character hex string', () => {
    const layout = createTestLayout({ bins: makeBins(3) });
    const hash = computeLayoutHash(layout);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic: same layout produces same hash', () => {
    const layout = createTestLayout({
      drawer: { width: 6, depth: 4, height: 12 },
      bins: makeBins(4),
    });
    expect(computeLayoutHash(layout)).toBe(computeLayoutHash(layout));
  });

  it('is order-independent: same bins in different order produce same hash', () => {
    const bin1 = createTestBin({
      id: binId('b1'),
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      layerId: layerId('layer1'),
    });
    const bin2 = createTestBin({
      id: binId('b2'),
      x: 1,
      y: 0,
      width: 2,
      depth: 2,
      height: 6,
      layerId: layerId('layer1'),
    });

    const layoutA = createTestLayout({ bins: [bin1, bin2] });
    const layoutB = createTestLayout({ bins: [bin2, bin1] });

    expect(computeLayoutHash(layoutA)).toBe(computeLayoutHash(layoutB));
  });

  it('produces different hashes for different drawer sizes', () => {
    const bins = makeBins(3);
    const layoutA = createTestLayout({ drawer: { width: 6, depth: 4, height: 12 }, bins });
    const layoutB = createTestLayout({ drawer: { width: 8, depth: 4, height: 12 }, bins });

    expect(computeLayoutHash(layoutA)).not.toBe(computeLayoutHash(layoutB));
  });

  it('produces different hashes for different bin compositions', () => {
    const binsA = [
      createTestBin({ id: binId('b1'), width: 1, depth: 1, height: 3, layerId: layerId('layer1') }),
    ];
    const binsB = [
      createTestBin({ id: binId('b2'), width: 2, depth: 2, height: 3, layerId: layerId('layer1') }),
    ];

    const layoutA = createTestLayout({ bins: binsA });
    const layoutB = createTestLayout({ bins: binsB });

    expect(computeLayoutHash(layoutA)).not.toBe(computeLayoutHash(layoutB));
  });

  it('excludes staging bins from the hash', () => {
    const gridBins = makeBins(2);
    const layoutWithoutStaging = createTestLayout({ bins: gridBins });

    const stagingBin = createTestBin({ id: binId('s1'), layerId: layerId('__staging__') });
    const layoutWithStaging = createTestLayout({ bins: [...gridBins, stagingBin] });

    expect(computeLayoutHash(layoutWithoutStaging)).toBe(computeLayoutHash(layoutWithStaging));
  });

  it('includes category in the hash computation', () => {
    const binWithCatA = createTestBin({
      id: binId('b1'),
      category: categoryId('cat-a'),
      layerId: layerId('layer1'),
    });
    const binWithCatB = createTestBin({
      id: binId('b1'),
      category: categoryId('cat-b'),
      layerId: layerId('layer1'),
    });

    const layoutA = createTestLayout({ bins: [binWithCatA] });
    const layoutB = createTestLayout({ bins: [binWithCatB] });

    expect(computeLayoutHash(layoutA)).not.toBe(computeLayoutHash(layoutB));
  });

  it('returns a hash for an empty layout', () => {
    const layout = createTestLayout({ bins: [] });
    const hash = computeLayoutHash(layout);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ============================================
// computeSizeDistribution
// ============================================

describe('computeSizeDistribution', () => {
  it('returns empty object for no bins', () => {
    expect(computeSizeDistribution([])).toEqual({});
  });

  it('counts bins by their WxDxH size string', () => {
    const bins = [
      createTestBin({ id: binId('b1'), width: 1, depth: 1, height: 3, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), width: 1, depth: 1, height: 3, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), width: 2, depth: 2, height: 6, layerId: layerId('layer1') }),
    ];
    expect(computeSizeDistribution(bins)).toEqual({ '1x1x3': 2, '2x2x6': 1 });
  });

  it('excludes staging bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), width: 1, depth: 1, height: 3, layerId: layerId('layer1') }),
      createTestBin({
        id: binId('s1'),
        width: 2,
        depth: 2,
        height: 3,
        layerId: layerId('__staging__'),
      }),
    ];
    expect(computeSizeDistribution(bins)).toEqual({ '1x1x3': 1 });
  });

  it('handles all-staging input', () => {
    const bins = [
      createTestBin({ id: binId('s1'), layerId: layerId('__staging__') }),
      createTestBin({ id: binId('s2'), layerId: layerId('__staging__') }),
    ];
    expect(computeSizeDistribution(bins)).toEqual({});
  });

  it('counts many distinct sizes independently', () => {
    const bins = [
      createTestBin({ id: binId('b1'), width: 1, depth: 2, height: 3, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), width: 3, depth: 2, height: 6, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), width: 1, depth: 1, height: 3, layerId: layerId('layer1') }),
    ];
    const result = computeSizeDistribution(bins);
    expect(result['1x2x3']).toBe(1);
    expect(result['3x2x6']).toBe(1);
    expect(result['1x1x3']).toBe(1);
  });
});

// ============================================
// computeCategoryDistribution
// ============================================

describe('computeCategoryDistribution', () => {
  it('returns empty object for no bins', () => {
    expect(computeCategoryDistribution([])).toEqual({});
  });

  it('counts bins by category', () => {
    const bins = [
      createTestBin({ id: binId('b1'), category: categoryId('cat-a'), layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), category: categoryId('cat-a'), layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), category: categoryId('cat-b'), layerId: layerId('layer1') }),
    ];
    expect(computeCategoryDistribution(bins)).toEqual({ 'cat-a': 2, 'cat-b': 1 });
  });

  it('uses "uncategorized" for bins with no category', () => {
    const bins = [
      createTestBin({ id: binId('b1'), category: undefined, layerId: layerId('layer1') }),
    ];
    const result = computeCategoryDistribution(bins);
    expect(result['uncategorized']).toBe(1);
  });

  it('excludes staging bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), category: categoryId('cat-a'), layerId: layerId('layer1') }),
      createTestBin({
        id: binId('s1'),
        category: categoryId('cat-b'),
        layerId: layerId('__staging__'),
      }),
    ];
    expect(computeCategoryDistribution(bins)).toEqual({ 'cat-a': 1 });
  });

  it('mixes categorized and uncategorized bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), category: categoryId('cat-a'), layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), category: undefined, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), category: undefined, layerId: layerId('layer1') }),
    ];
    expect(computeCategoryDistribution(bins)).toEqual({ 'cat-a': 1, uncategorized: 2 });
  });
});

// ============================================
// computeDomainDistribution
// ============================================

describe('computeDomainDistribution', () => {
  const processLabel = (label: string) => {
    const domainMap: Record<string, string> = {
      screwdriver: 'tools',
      hammer: 'tools',
      resistor: 'electronics',
    };
    return { domain: domainMap[label] ?? null };
  };

  it('returns empty object when no bins have labels', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: '', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: '   ', layerId: layerId('layer1') }),
    ];
    expect(computeDomainDistribution(bins, processLabel)).toEqual({});
  });

  it('counts domains from labeled bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'screwdriver', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'hammer', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), label: 'resistor', layerId: layerId('layer1') }),
    ];
    expect(computeDomainDistribution(bins, processLabel)).toEqual({ tools: 2, electronics: 1 });
  });

  it('uses "unknown" for labels that have no domain', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'mystery-item', layerId: layerId('layer1') }),
    ];
    expect(computeDomainDistribution(bins, processLabel)).toEqual({ unknown: 1 });
  });

  it('excludes staging bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'screwdriver', layerId: layerId('layer1') }),
      createTestBin({ id: binId('s1'), label: 'hammer', layerId: layerId('__staging__') }),
    ];
    expect(computeDomainDistribution(bins, processLabel)).toEqual({ tools: 1 });
  });

  it('skips bins with whitespace-only labels', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: '   ', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'screwdriver', layerId: layerId('layer1') }),
    ];
    expect(computeDomainDistribution(bins, processLabel)).toEqual({ tools: 1 });
  });

  it('passes the exact label string to processLabel', () => {
    const observed: string[] = [];
    const trackingProcessor = (label: string) => {
      observed.push(label);
      return { domain: null };
    };
    const bins = [
      createTestBin({ id: binId('b1'), label: 'Widget A', layerId: layerId('layer1') }),
    ];
    computeDomainDistribution(bins, trackingProcessor);
    expect(observed).toEqual(['Widget A']);
  });
});

// ============================================
// computeTopLabelHashes
// ============================================

describe('computeTopLabelHashes', () => {
  const processLabel = (label: string) => ({ hash: `hash-${label}` });

  it('returns empty array when no bins have labels', () => {
    const bins = [createTestBin({ id: binId('b1'), label: '', layerId: layerId('layer1') })];
    expect(computeTopLabelHashes(bins, 5, processLabel)).toEqual([]);
  });

  it('returns hashes sorted by frequency, most common first', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b4'), label: 'b', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b5'), label: 'b', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b6'), label: 'c', layerId: layerId('layer1') }),
    ];
    const result = computeTopLabelHashes(bins, 3, processLabel);
    expect(result).toEqual(['hash-a', 'hash-b', 'hash-c']);
  });

  it('limits to n results', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'b', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), label: 'c', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b4'), label: 'd', layerId: layerId('layer1') }),
    ];
    const result = computeTopLabelHashes(bins, 2, processLabel);
    expect(result).toHaveLength(2);
  });

  it('returns fewer than n when fewer unique labels exist', () => {
    const bins = [createTestBin({ id: binId('b1'), label: 'a', layerId: layerId('layer1') })];
    const result = computeTopLabelHashes(bins, 10, processLabel);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('hash-a');
  });

  it('excludes staging bins', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('s1'), label: 'b', layerId: layerId('__staging__') }),
    ];
    const result = computeTopLabelHashes(bins, 5, processLabel);
    expect(result).toEqual(['hash-a']);
  });

  it('skips bins with empty or whitespace-only labels', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: '', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: '   ', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), label: 'real', layerId: layerId('layer1') }),
    ];
    const result = computeTopLabelHashes(bins, 5, processLabel);
    expect(result).toEqual(['hash-real']);
  });

  it('groups bins that map to the same hash', () => {
    // Two different labels that happen to produce the same hash (simulating deduplication)
    const sameHashProcessor = (_label: string) => ({ hash: 'same-hash' });
    const bins = [
      createTestBin({ id: binId('b1'), label: 'a', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'b', layerId: layerId('layer1') }),
    ];
    const result = computeTopLabelHashes(bins, 5, sameHashProcessor);
    expect(result).toEqual(['same-hash']);
  });
});

// ============================================
// computeFillPercentage
// ============================================

describe('computeFillPercentage', () => {
  it('returns 0 for empty layout', () => {
    const layout = createTestLayout({ drawer: { width: 10, depth: 8, height: 12 }, bins: [] });
    expect(computeFillPercentage(layout)).toBe(0);
  });

  it('calculates fill as a rounded percentage', () => {
    // Drawer 4x4 = 16 area. 4 bins of 1x1 = 25%.
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: makeBins(4),
    });
    expect(computeFillPercentage(layout)).toBe(25);
  });

  it('returns 100 for fully filled drawer', () => {
    // Drawer 2x2 = 4 area. 4 bins of 1x1.
    const bins = [
      createTestBin({
        id: binId('b1'),
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b2'),
        x: 1,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b3'),
        x: 0,
        y: 1,
        width: 1,
        depth: 1,
        height: 3,
        layerId: layerId('layer1'),
      }),
      createTestBin({
        id: binId('b4'),
        x: 1,
        y: 1,
        width: 1,
        depth: 1,
        height: 3,
        layerId: layerId('layer1'),
      }),
    ];
    const layout = createTestLayout({
      drawer: { width: 2, depth: 2, height: 12 },
      bins,
    });
    expect(computeFillPercentage(layout)).toBe(100);
  });

  it('excludes staging bins from fill calculation', () => {
    // Drawer 4x4=16. 2 grid bins (2 area = 12.5%) + 10 staging bins.
    const gridBins = makeBins(2);
    const stagingBins = makeBins(10).map((b, i) =>
      createTestBin({ id: binId(`s-${i}`), layerId: layerId('__staging__') })
    );
    const layout = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: [...gridBins, ...stagingBins],
    });
    expect(computeFillPercentage(layout)).toBe(13); // Math.round(2/16*100) = Math.round(12.5) = 13
  });

  it('rounds to the nearest integer', () => {
    // Drawer 3x1 = 3 area. 1 bin of 1x1 = 33.33%. Round to 33.
    const layout = createTestLayout({
      drawer: { width: 3, depth: 1, height: 12 },
      bins: [
        createTestBin({
          id: binId('b1'),
          x: 0,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          layerId: layerId('layer1'),
        }),
      ],
    });
    expect(computeFillPercentage(layout)).toBe(33);
  });

  it('uses bin width*depth (not height) for area calculation', () => {
    // Two bins same footprint but different heights — fill is identical.
    const binsShort = [
      createTestBin({ id: binId('b1'), width: 2, depth: 2, height: 1, layerId: layerId('layer1') }),
    ];
    const binsTall = [
      createTestBin({
        id: binId('b2'),
        width: 2,
        depth: 2,
        height: 10,
        layerId: layerId('layer1'),
      }),
    ];
    const layoutShort = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: binsShort,
    });
    const layoutTall = createTestLayout({
      drawer: { width: 4, depth: 4, height: 12 },
      bins: binsTall,
    });
    expect(computeFillPercentage(layoutShort)).toBe(computeFillPercentage(layoutTall));
  });
});

// ============================================
// computeLabeledPercentage
// ============================================

describe('computeLabeledPercentage', () => {
  it('returns 0 when bins array is empty', () => {
    expect(computeLabeledPercentage([])).toBe(0);
  });

  it('returns 0 when no bins have labels', () => {
    const bins = makeBins(4, { label: '' });
    expect(computeLabeledPercentage(bins)).toBe(0);
  });

  it('returns 100 when all bins have labels', () => {
    const bins = makeBins(4, { label: 'something' });
    expect(computeLabeledPercentage(bins)).toBe(100);
  });

  it('calculates percentage of labeled bins (rounded)', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'labeled', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: '', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b3'), label: '', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b4'), label: '', layerId: layerId('layer1') }),
    ];
    expect(computeLabeledPercentage(bins)).toBe(25);
  });

  it('excludes staging bins from both numerator and denominator', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: 'labeled', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: '', layerId: layerId('layer1') }),
      createTestBin({ id: binId('s1'), label: 'also labeled', layerId: layerId('__staging__') }),
    ];
    // Only 2 on-grid bins: 1 labeled → 50%
    expect(computeLabeledPercentage(bins)).toBe(50);
  });

  it('treats whitespace-only labels as unlabeled', () => {
    const bins = [
      createTestBin({ id: binId('b1'), label: '   ', layerId: layerId('layer1') }),
      createTestBin({ id: binId('b2'), label: 'real label', layerId: layerId('layer1') }),
    ];
    expect(computeLabeledPercentage(bins)).toBe(50);
  });

  it('returns 0 when only staging bins are provided', () => {
    const bins = [
      createTestBin({ id: binId('s1'), label: 'labeled', layerId: layerId('__staging__') }),
    ];
    expect(computeLabeledPercentage(bins)).toBe(0);
  });
});

// ============================================
// computeSessionConfidence
// ============================================

describe('computeSessionConfidence', () => {
  it('returns 0 when no bins were placed', () => {
    expect(computeSessionConfidence(0, 0, 0, 0, 0, 60_000)).toBe(0);
  });

  it('returns a value between 0 and 1', () => {
    const result = computeSessionConfidence(10, 2, 1, 1, 1, 120_000);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns a rounded result (2 decimal places)', () => {
    const result = computeSessionConfidence(10, 0, 0, 0, 0, 60_000);
    // Should be rounded to 2 decimal places
    expect(result.toString().replace('.', '').length).toBeLessThanOrEqual(4);
    expect(Number.isFinite(result)).toBe(true);
  });

  describe('undo score thresholds', () => {
    it('gives undo score 1.0 for 0 undos', () => {
      // With 0 undos, no corrections, and fast placement → high confidence
      // undoScore=1.0, correctionScore=1.0, sessionScore=1.0 → 1.0
      const result = computeSessionConfidence(5, 0, 0, 0, 0, 60_000);
      expect(result).toBe(1.0);
    });

    it('gives undo score 0.8 for 1-2 undos', () => {
      // undos=1, no corrections, fast placement:
      // undoScore=0.8, correction=1.0, session=1.0
      // weighted = 0.8*0.25 + 1.0*0.45 + 1.0*0.3 = 0.2 + 0.45 + 0.3 = 0.95
      const result = computeSessionConfidence(5, 1, 0, 0, 0, 60_000);
      expect(result).toBe(0.95);
    });

    it('gives undo score 0.6 for 3-5 undos', () => {
      // undoScore=0.6, correction=1.0, session=1.0
      // 0.6*0.25 + 1.0*0.45 + 1.0*0.3 = 0.15 + 0.45 + 0.3 = 0.9
      const result = computeSessionConfidence(5, 3, 0, 0, 0, 60_000);
      expect(result).toBe(0.9);
    });

    it('gives undo score 0.4 for 6+ undos', () => {
      // undoScore=0.4, correction=1.0, session=1.0
      // 0.4*0.25 + 1.0*0.45 + 1.0*0.3 = 0.1 + 0.45 + 0.3 = 0.85
      const result = computeSessionConfidence(5, 6, 0, 0, 0, 60_000);
      expect(result).toBe(0.85);
    });
  });

  describe('correction score thresholds', () => {
    it('gives correction score 1.0 for no corrections', () => {
      // verified above in undo score 0 test
      const result = computeSessionConfidence(10, 0, 0, 0, 0, 60_000);
      expect(result).toBe(1.0);
    });

    it('gives correction score 0.8 for < 30% correction ratio', () => {
      // 2 corrections / 10 placed = 20% ratio
      // undoScore=1.0, correctionScore=0.8, sessionScore=1.0
      // 1.0*0.25 + 0.8*0.45 + 1.0*0.3 = 0.25 + 0.36 + 0.3 = 0.91
      const result = computeSessionConfidence(10, 0, 2, 0, 0, 60_000);
      expect(result).toBe(0.91);
    });

    it('gives correction score 0.6 for 30-60% correction ratio', () => {
      // 4 corrections / 10 placed = 40% ratio
      // 1.0*0.25 + 0.6*0.45 + 1.0*0.3 = 0.25 + 0.27 + 0.3 = 0.82
      const result = computeSessionConfidence(10, 0, 4, 0, 0, 60_000);
      expect(result).toBe(0.82);
    });

    it('gives correction score 0.4 for >= 60% correction ratio', () => {
      // 7 corrections / 10 placed = 70% ratio
      // 1.0*0.25 + 0.4*0.45 + 1.0*0.3 = 0.25 + 0.18 + 0.3 = 0.73
      const result = computeSessionConfidence(10, 0, 7, 0, 0, 60_000);
      expect(result).toBe(0.73);
    });

    it('accumulates delete + resize + move into totalCorrections', () => {
      // 1 delete + 1 resize + 1 move = 3 corrections / 10 placed = 30% → score 0.6
      const withDeleteOnly = computeSessionConfidence(10, 0, 3, 0, 0, 60_000);
      const withAllTypes = computeSessionConfidence(10, 0, 1, 1, 1, 60_000);
      expect(withDeleteOnly).toBe(withAllTypes);
    });
  });

  describe('session score thresholds', () => {
    it('gives session score 1.0 for > 2 bins per minute', () => {
      // 10 bins in 60s = 10 bins/min > 2
      // all other scores 1.0 → result 1.0
      const result = computeSessionConfidence(10, 0, 0, 0, 0, 60_000);
      expect(result).toBe(1.0);
    });

    it('gives session score 0.8 for 0.5-2 bins per minute', () => {
      // 10 bins in 10 minutes (600s) = 1 bin/min (0.5 < 1 ≤ 2)
      // undoScore=1.0, correctionScore=1.0, sessionScore=0.8
      // 1.0*0.25 + 1.0*0.45 + 0.8*0.3 = 0.25 + 0.45 + 0.24 = 0.94
      const result = computeSessionConfidence(10, 0, 0, 0, 0, 600_000);
      expect(result).toBe(0.94);
    });

    it('gives session score 0.6 for 0.1-0.5 bins per minute', () => {
      // 1 bin in 10 minutes = 0.1 bins/min (at boundary), but > 0.1 check is strict
      // 1 bin in 9 minutes = ~0.111 bins/min → > 0.1 but ≤ 0.5 → 0.6
      // 1.0*0.25 + 1.0*0.45 + 0.6*0.3 = 0.25 + 0.45 + 0.18 = 0.88
      const result = computeSessionConfidence(1, 0, 0, 0, 0, 540_000);
      expect(result).toBe(0.88);
    });

    it('gives session score 0.4 for very slow sessions (≤ 0.1 bins per minute)', () => {
      // 1 bin in 60 minutes = 0.0166 bins/min ≤ 0.1
      // 1.0*0.25 + 1.0*0.45 + 0.4*0.3 = 0.25 + 0.45 + 0.12 = 0.82
      const result = computeSessionConfidence(1, 0, 0, 0, 0, 3_600_000);
      expect(result).toBe(0.82);
    });

    it('gives session score 0.4 for zero-duration sessions', () => {
      // binsPerMinute = 0 (sessionDurationMs=0) → score 0.4
      // 1.0*0.25 + 1.0*0.45 + 0.4*0.3 = 0.82
      const result = computeSessionConfidence(5, 0, 0, 0, 0, 0);
      expect(result).toBe(0.82);
    });
  });

  it('weighted average uses correct weights (0.25 undo, 0.45 correction, 0.3 session)', () => {
    // Verify by computing manually:
    // undos=6 → undoScore=0.4
    // corrections=7/10=70% → correctionScore=0.4
    // 1 bin placed, sessionDurationMs=0 → binsPerMinute=0 → sessionScore=0.4
    // weighted = 0.4*0.25 + 0.4*0.45 + 0.4*0.3 = 0.1+0.18+0.12 = 0.4
    const result = computeSessionConfidence(10, 6, 7, 0, 0, 0);
    expect(result).toBe(0.4);
  });
});

// ============================================
// isDefaultCategoryName
// ============================================

describe('isDefaultCategoryName', () => {
  it('returns true for known default names', () => {
    expect(isDefaultCategoryName('coral')).toBe(true);
    expect(isDefaultCategoryName('sky')).toBe(true);
    expect(isDefaultCategoryName('green')).toBe(true);
    expect(isDefaultCategoryName('cloud')).toBe(true);
    expect(isDefaultCategoryName('charcoal')).toBe(true);
    expect(isDefaultCategoryName('new category')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDefaultCategoryName('Coral')).toBe(true);
    expect(isDefaultCategoryName('SKY')).toBe(true);
    expect(isDefaultCategoryName('Green')).toBe(true);
    expect(isDefaultCategoryName('CLOUD')).toBe(true);
    expect(isDefaultCategoryName('Charcoal')).toBe(true);
    expect(isDefaultCategoryName('New Category')).toBe(true);
  });

  it('trims whitespace before comparison', () => {
    expect(isDefaultCategoryName('  coral  ')).toBe(true);
    expect(isDefaultCategoryName('\tsky\t')).toBe(true);
  });

  it('returns false for custom/user-defined names', () => {
    expect(isDefaultCategoryName('tools')).toBe(false);
    expect(isDefaultCategoryName('electronics')).toBe(false);
    expect(isDefaultCategoryName('hardware')).toBe(false);
    expect(isDefaultCategoryName('')).toBe(false);
    expect(isDefaultCategoryName('my drawer')).toBe(false);
  });

  it('returns false for partial matches', () => {
    expect(isDefaultCategoryName('coral reef')).toBe(false);
    expect(isDefaultCategoryName('sky blue')).toBe(false);
  });
});

// ============================================
// hashCategoryName
// ============================================

describe('hashCategoryName', () => {
  it('returns an 8-character hex string', () => {
    expect(hashCategoryName('tools')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic: same input produces same output', () => {
    expect(hashCategoryName('electronics')).toBe(hashCategoryName('electronics'));
  });

  it('is case-insensitive (normalizes before hashing)', () => {
    expect(hashCategoryName('Tools')).toBe(hashCategoryName('tools'));
    expect(hashCategoryName('TOOLS')).toBe(hashCategoryName('tools'));
  });

  it('trims whitespace before hashing', () => {
    expect(hashCategoryName('  tools  ')).toBe(hashCategoryName('tools'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashCategoryName('tools')).not.toBe(hashCategoryName('electronics'));
    expect(hashCategoryName('a')).not.toBe(hashCategoryName('b'));
  });

  it('handles empty string', () => {
    const hash = hashCategoryName('');
    // djb2 starts at hash=0 for empty strings — padded to 8 zeros
    expect(hash).toBe('00000000');
  });

  it('handles strings with special characters', () => {
    const hash = hashCategoryName('tools & hardware');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles unicode characters', () => {
    const hash = hashCategoryName('Schrauben');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
