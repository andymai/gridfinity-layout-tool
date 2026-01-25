import { describe, it, expect } from 'vitest';
import { areSizeCompatible, canSwapBins, findBinAtPosition } from '@/shared/utils/position';
import { createTestLayout } from '@/test/testUtils';
import type { Bin } from '@/core/types';

// Test helper: Create a test bin
function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin1',
    layerId: 'layer1',
    x: 0,
    y: 0,
    width: 2,
    depth: 2,
    height: 3,
    category: 'cat1',
    label: '',
    notes: '',
    ...overrides,
  };
}

describe('areSizeCompatible', () => {
  it('returns compatible for exact size match', () => {
    const binA = { width: 2, depth: 3 };
    const binB = { width: 2, depth: 3 };

    const result = areSizeCompatible(binA, binB);

    expect(result.compatible).toBe(true);
    expect(result.requiresRotation).toBe(false);
  });

  it('returns compatible with rotation for rotated match', () => {
    const binA = { width: 2, depth: 3 };
    const binB = { width: 3, depth: 2 }; // Swapped dimensions

    const result = areSizeCompatible(binA, binB);

    expect(result.compatible).toBe(true);
    expect(result.requiresRotation).toBe(true);
  });

  it('returns incompatible for different sizes', () => {
    const binA = { width: 2, depth: 3 };
    const binB = { width: 2, depth: 2 }; // Different depth

    const result = areSizeCompatible(binA, binB);

    expect(result.compatible).toBe(false);
  });

  it('handles square bins (no rotation needed)', () => {
    const binA = { width: 2, depth: 2 };
    const binB = { width: 2, depth: 2 };

    const result = areSizeCompatible(binA, binB);

    expect(result.compatible).toBe(true);
    expect(result.requiresRotation).toBe(false);
  });

  it('handles 1x1 bins', () => {
    const binA = { width: 1, depth: 1 };
    const binB = { width: 1, depth: 1 };

    const result = areSizeCompatible(binA, binB);

    expect(result.compatible).toBe(true);
  });
});

describe('canSwapBins', () => {
  describe('compatible swaps', () => {
    it('allows swap of same-sized bins on same layer', () => {
      const binA = createTestBin({ id: 'binA', x: 0, y: 0, width: 2, depth: 2 });
      const binB = createTestBin({ id: 'binB', x: 4, y: 0, width: 2, depth: 2 });
      const layout = createTestLayout({
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
      expect(result.requiresRotation).toBe(false);
    });

    it('allows swap of rotated-match bins (2x3 with 3x2)', () => {
      const binA = createTestBin({ id: 'binA', x: 0, y: 0, width: 2, depth: 3 });
      const binB = createTestBin({ id: 'binB', x: 4, y: 0, width: 3, depth: 2 });
      const layout = createTestLayout({
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
      expect(result.requiresRotation).toBe(true);
    });

    it('allows swap when there is enough space', () => {
      const binA = createTestBin({ id: 'binA', x: 0, y: 0, width: 1, depth: 1 });
      const binB = createTestBin({ id: 'binB', x: 5, y: 5, width: 1, depth: 1 });
      const layout = createTestLayout({
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
    });
  });

  describe('incompatible swaps', () => {
    it('rejects swap of different-sized bins', () => {
      const binA = createTestBin({ id: 'binA', x: 0, y: 0, width: 2, depth: 2 });
      const binB = createTestBin({ id: 'binB', x: 4, y: 0, width: 1, depth: 1 });
      const layout = createTestLayout({
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('size_mismatch');
    });

    it('rejects swap of bins on different layers', () => {
      const binA = createTestBin({ id: 'binA', x: 0, y: 0, layerId: 'layer1' });
      const binB = createTestBin({ id: 'binB', x: 4, y: 0, layerId: 'layer2' });
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('layer_mismatch');
    });
  });
});

describe('findBinAtPosition', () => {
  it('finds bin at exact grid position', () => {
    const bin = createTestBin({ id: 'bin1', x: 2, y: 3, width: 2, depth: 2 });
    const layout = createTestLayout({
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [bin],
    });

    const result = findBinAtPosition({ x: 2, y: 3 }, 'layer1', layout, new Set());

    expect(result).toBe(bin);
  });

  it('finds bin when coordinate is inside bin bounds', () => {
    const bin = createTestBin({ id: 'bin1', x: 2, y: 3, width: 2, depth: 2 });
    const layout = createTestLayout({
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [bin],
    });

    // Coordinate at center of bin
    const result = findBinAtPosition({ x: 3, y: 4 }, 'layer1', layout, new Set());

    expect(result).toBe(bin);
  });

  it('returns null when coordinate is outside all bins', () => {
    const bin = createTestBin({ id: 'bin1', x: 2, y: 3, width: 2, depth: 2 });
    const layout = createTestLayout({
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [bin],
    });

    const result = findBinAtPosition({ x: 0, y: 0 }, 'layer1', layout, new Set());

    expect(result).toBeNull();
  });

  it('excludes bins in the exclude set', () => {
    const bin = createTestBin({ id: 'bin1', x: 2, y: 3, width: 2, depth: 2 });
    const layout = createTestLayout({
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [bin],
    });

    const result = findBinAtPosition({ x: 3, y: 4 }, 'layer1', layout, new Set(['bin1']));

    expect(result).toBeNull();
  });

  it('only finds bins on the specified layer', () => {
    const bin = createTestBin({ id: 'bin1', x: 2, y: 3, layerId: 'layer2' });
    const layout = createTestLayout({
      layers: [
        { id: 'layer1', name: 'Layer 1', height: 3 },
        { id: 'layer2', name: 'Layer 2', height: 3 },
      ],
      bins: [bin],
    });

    const result = findBinAtPosition({ x: 2, y: 3 }, 'layer1', layout, new Set());

    expect(result).toBeNull();
  });

  it('returns correct bin when multiple bins exist', () => {
    const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2 });
    const bin2 = createTestBin({ id: 'bin2', x: 4, y: 0, width: 2, depth: 2 });
    const layout = createTestLayout({
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [bin1, bin2],
    });

    const result = findBinAtPosition({ x: 4, y: 0 }, 'layer1', layout, new Set());

    expect(result).toBe(bin2);
  });
});
