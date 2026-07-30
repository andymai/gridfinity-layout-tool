import { describe, it, expect } from 'vitest';
import { areSizeCompatible, canSwapBins, findBinAtPosition } from '@/shared/utils/position';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';

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
      const binA = createTestBin({
        id: binId('binA'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const binB = createTestBin({
        id: binId('binB'),
        x: gridUnits(4),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const layout = createTestLayout({
        layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
      expect(result.requiresRotation).toBe(false);
    });

    it('allows swap of rotated-match bins (2x3 with 3x2)', () => {
      const binA = createTestBin({
        id: binId('binA'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
      });
      const binB = createTestBin({
        id: binId('binB'),
        x: gridUnits(4),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(2),
      });
      const layout = createTestLayout({
        layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
      expect(result.requiresRotation).toBe(true);
    });

    it('allows swap when there is enough space', () => {
      const binA = createTestBin({
        id: binId('binA'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      const binB = createTestBin({
        id: binId('binB'),
        x: gridUnits(5),
        y: gridUnits(5),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      const layout = createTestLayout({
        layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(true);
    });
  });

  describe('incompatible swaps', () => {
    it('rejects swap of different-sized bins', () => {
      const binA = createTestBin({
        id: binId('binA'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const binB = createTestBin({
        id: binId('binB'),
        x: gridUnits(4),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      const layout = createTestLayout({
        layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
        bins: [binA, binB],
      });

      const result = canSwapBins(binA, binB, layout);

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('size_mismatch');
    });

    it('rejects swap of bins on different layers', () => {
      const binA = createTestBin({
        id: binId('binA'),
        x: gridUnits(0),
        y: gridUnits(0),
        layerId: layerId('layer1'),
      });
      const binB = createTestBin({
        id: binId('binB'),
        x: gridUnits(4),
        y: gridUnits(0),
        layerId: layerId('layer2'),
      });
      const layout = createTestLayout({
        layers: [
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
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
    const bin = createTestBin({
      id: binId('bin1'),
      x: gridUnits(2),
      y: gridUnits(3),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
      bins: [bin],
    });

    const result = findBinAtPosition(
      { x: gridUnits(2), y: gridUnits(3) },
      'layer1',
      layout,
      new Set()
    );

    expect(result).toBe(bin);
  });

  it('finds bin when coordinate is inside bin bounds', () => {
    const bin = createTestBin({
      id: binId('bin1'),
      x: gridUnits(2),
      y: gridUnits(3),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
      bins: [bin],
    });

    // Coordinate at center of bin
    const result = findBinAtPosition(
      { x: gridUnits(3), y: gridUnits(4) },
      'layer1',
      layout,
      new Set()
    );

    expect(result).toBe(bin);
  });

  it('returns null when coordinate is outside all bins', () => {
    const bin = createTestBin({
      id: binId('bin1'),
      x: gridUnits(2),
      y: gridUnits(3),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
      bins: [bin],
    });

    const result = findBinAtPosition(
      { x: gridUnits(0), y: gridUnits(0) },
      'layer1',
      layout,
      new Set()
    );

    expect(result).toBeNull();
  });

  it('excludes bins in the exclude set', () => {
    const bin = createTestBin({
      id: binId('bin1'),
      x: gridUnits(2),
      y: gridUnits(3),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
      bins: [bin],
    });

    const result = findBinAtPosition(
      { x: gridUnits(3), y: gridUnits(4) },
      'layer1',
      layout,
      new Set(['bin1'])
    );

    expect(result).toBeNull();
  });

  it('only finds bins on the specified layer', () => {
    const bin = createTestBin({
      id: binId('bin1'),
      x: gridUnits(2),
      y: gridUnits(3),
      layerId: layerId('layer2'),
    });
    const layout = createTestLayout({
      layers: [
        { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
        { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
      ],
      bins: [bin],
    });

    const result = findBinAtPosition(
      { x: gridUnits(2), y: gridUnits(3) },
      'layer1',
      layout,
      new Set()
    );

    expect(result).toBeNull();
  });

  it('returns correct bin when multiple bins exist', () => {
    const bin1 = createTestBin({
      id: binId('bin1'),
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const bin2 = createTestBin({
      id: binId('bin2'),
      x: gridUnits(4),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
    });
    const layout = createTestLayout({
      layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
      bins: [bin1, bin2],
    });

    const result = findBinAtPosition(
      { x: gridUnits(4), y: gridUnits(0) },
      'layer1',
      layout,
      new Set()
    );

    expect(result).toBe(bin2);
  });
});
