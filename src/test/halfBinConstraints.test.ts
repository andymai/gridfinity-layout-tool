import { describe, it, expect } from 'vitest';
import {
  hasFractionalBins,
  getFractionalBinIds,
  validateHalfBinModeToggle,
} from '@/utils/halfBinConstraints';
import type { Bin, Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

// Helper to create a minimal bin
const createBin = (overrides: Partial<Bin> & { id: string; layerId: string }): Bin => ({
  x: 0,
  y: 0,
  width: 1,
  depth: 1,
  height: 3,
  category: 'cat1',
  label: '',
  notes: '',
  ...overrides,
});

// Helper to create a minimal layout
const createLayout = (bins: Bin[]): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 10, depth: 10, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Test', color: '#000' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins,
});

describe('hasFractionalBins', () => {
  it('returns false for empty bins array', () => {
    expect(hasFractionalBins([])).toBe(false);
  });

  it('returns false when all bins have integer dimensions', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
      createBin({ id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 3, depth: 3 }),
    ];
    expect(hasFractionalBins(bins)).toBe(false);
  });

  it('returns true when a bin has fractional x position', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', x: 0.5, y: 0 }),
    ];
    expect(hasFractionalBins(bins)).toBe(true);
  });

  it('returns true when a bin has fractional y position', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', x: 0, y: 1.5 }),
    ];
    expect(hasFractionalBins(bins)).toBe(true);
  });

  it('returns true when a bin has fractional width', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', width: 1.5 }),
    ];
    expect(hasFractionalBins(bins)).toBe(true);
  });

  it('returns true when a bin has fractional depth', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', depth: 2.5 }),
    ];
    expect(hasFractionalBins(bins)).toBe(true);
  });

  it('ignores bins in staging area', () => {
    const bins: Bin[] = [
      // Fractional bin in staging - should be ignored
      createBin({ id: 'bin1', layerId: STAGING_ID, x: 0.5, y: 0.5, width: 1.5, depth: 1.5 }),
      // Integer bin on grid
      createBin({ id: 'bin2', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
    ];
    expect(hasFractionalBins(bins)).toBe(false);
  });

  it('returns true when only grid bins have fractional dimensions (staging excluded)', () => {
    const bins: Bin[] = [
      // Integer bin in staging
      createBin({ id: 'bin1', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 2 }),
      // Fractional bin on grid
      createBin({ id: 'bin2', layerId: 'layer1', x: 0.5, y: 0, width: 2, depth: 2 }),
    ];
    expect(hasFractionalBins(bins)).toBe(true);
  });
});

describe('getFractionalBinIds', () => {
  it('returns empty array for no bins', () => {
    expect(getFractionalBinIds([])).toEqual([]);
  });

  it('returns empty array when all bins are integer', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
      createBin({ id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 3, depth: 3 }),
    ];
    expect(getFractionalBinIds(bins)).toEqual([]);
  });

  it('returns IDs of bins with fractional positions', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', x: 0.5, y: 0 }),
      createBin({ id: 'bin2', layerId: 'layer1', x: 0, y: 0 }),
      createBin({ id: 'bin3', layerId: 'layer1', x: 0, y: 1.5 }),
    ];
    expect(getFractionalBinIds(bins)).toEqual(['bin1', 'bin3']);
  });

  it('returns IDs of bins with fractional dimensions', () => {
    const bins: Bin[] = [
      createBin({ id: 'bin1', layerId: 'layer1', width: 1.5 }),
      createBin({ id: 'bin2', layerId: 'layer1', depth: 2.5 }),
      createBin({ id: 'bin3', layerId: 'layer1', width: 2, depth: 2 }),
    ];
    expect(getFractionalBinIds(bins)).toEqual(['bin1', 'bin2']);
  });

  it('excludes staging bins from results', () => {
    const bins: Bin[] = [
      createBin({ id: 'staging-bin', layerId: STAGING_ID, x: 0.5, y: 0.5 }),
      createBin({ id: 'grid-bin', layerId: 'layer1', x: 0.5, y: 0 }),
    ];
    expect(getFractionalBinIds(bins)).toEqual(['grid-bin']);
  });
});

describe('validateHalfBinModeToggle', () => {
  describe('enabling half-bin mode (targetState: true)', () => {
    it('always allows enabling half-bin mode', () => {
      const layout = createLayout([]);
      const result = validateHalfBinModeToggle(layout, true);
      expect(result).toEqual({ canDisable: true });
    });

    it('allows enabling even when fractional bins exist', () => {
      const layout = createLayout([
        createBin({ id: 'bin1', layerId: 'layer1', x: 0.5, y: 0.5 }),
      ]);
      const result = validateHalfBinModeToggle(layout, true);
      expect(result).toEqual({ canDisable: true });
    });
  });

  describe('disabling half-bin mode (targetState: false)', () => {
    it('allows disabling when no bins exist', () => {
      const layout = createLayout([]);
      const result = validateHalfBinModeToggle(layout, false);
      expect(result).toEqual({ canDisable: true });
    });

    it('allows disabling when all bins have integer dimensions', () => {
      const layout = createLayout([
        createBin({ id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
        createBin({ id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 3, depth: 3 }),
      ]);
      const result = validateHalfBinModeToggle(layout, false);
      expect(result).toEqual({ canDisable: true });
    });

    it('prevents disabling when fractional bins exist', () => {
      const layout = createLayout([
        createBin({ id: 'bin1', layerId: 'layer1', x: 0.5, y: 0 }),
        createBin({ id: 'bin2', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
      ]);
      const result = validateHalfBinModeToggle(layout, false);

      expect(result.canDisable).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe('fractional_bins_exist');
      expect(result.violation?.binIds).toEqual(['bin1']);
      expect(result.violation?.count).toBe(1);
    });

    it('reports all fractional bin IDs in violation', () => {
      const layout = createLayout([
        createBin({ id: 'bin1', layerId: 'layer1', x: 0.5, y: 0 }),
        createBin({ id: 'bin2', layerId: 'layer1', width: 1.5 }),
        createBin({ id: 'bin3', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
      ]);
      const result = validateHalfBinModeToggle(layout, false);

      expect(result.canDisable).toBe(false);
      expect(result.violation?.binIds).toContain('bin1');
      expect(result.violation?.binIds).toContain('bin2');
      expect(result.violation?.count).toBe(2);
    });

    it('ignores fractional bins in staging when validating', () => {
      const layout = createLayout([
        createBin({ id: 'staging-bin', layerId: STAGING_ID, x: 0.5, y: 0.5, width: 1.5, depth: 1.5 }),
        createBin({ id: 'grid-bin', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2 }),
      ]);
      const result = validateHalfBinModeToggle(layout, false);

      expect(result).toEqual({ canDisable: true });
    });
  });
});
