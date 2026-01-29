import { describe, it, expect } from 'vitest';
import {
  extractBinDimensions,
  extractDesignDimensions,
  createBinSyncUpdate,
  formatDimensions,
  formatDimensionChange,
} from './syncOperations';
import type { Bin } from '@/core/types';
import type { BinParams } from '@/features/bin-designer/types';
import type { SyncableDimensions } from '../types';

// Test helpers
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 4,
    layerId: 'layer-1',
    category: 'cat-1',
    label: 'Test Bin',
    notes: 'Some notes',
    ...overrides,
  };
}

function makeDesignParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    width: 2,
    depth: 3,
    height: 4,
    style: 'standard',
    magnetHoles: false,
    screwHoles: false,
    stackable: true,
    labelTab: 'none',
    wallThickness: 'standard',
    floorStyle: 'solid',
    lipStyle: 'standard',
    compartments: [],
    ...overrides,
  };
}

describe('syncOperations', () => {
  describe('extractBinDimensions', () => {
    it('extracts dimensions from bin', () => {
      const bin = makeBin({ width: 2, depth: 3, height: 4 });
      const result = extractBinDimensions(bin);

      expect(result).toEqual({ width: 2, depth: 3, height: 4 });
    });

    it('handles fractional dimensions', () => {
      const bin = makeBin({ width: 2.5, depth: 3.5, height: 4 });
      const result = extractBinDimensions(bin);

      expect(result).toEqual({ width: 2.5, depth: 3.5, height: 4 });
    });

    it('only includes width, depth, height (not other bin properties)', () => {
      const bin = makeBin({
        id: 'bin-1',
        x: 5,
        y: 10,
        width: 2,
        depth: 3,
        height: 4,
        label: 'My Label',
      });
      const result = extractBinDimensions(bin);

      expect(result).toEqual({ width: 2, depth: 3, height: 4 });
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('x');
      expect(result).not.toHaveProperty('y');
      expect(result).not.toHaveProperty('label');
    });
  });

  describe('extractDesignDimensions', () => {
    it('extracts dimensions from design params', () => {
      const params = makeDesignParams({ width: 3, depth: 4, height: 5 });
      const result = extractDesignDimensions(params);

      expect(result).toEqual({ width: 3, depth: 4, height: 5 });
    });

    it('handles fractional dimensions', () => {
      const params = makeDesignParams({ width: 2.5, depth: 3.5, height: 4 });
      const result = extractDesignDimensions(params);

      expect(result).toEqual({ width: 2.5, depth: 3.5, height: 4 });
    });

    it('only includes dimensions (not other design properties)', () => {
      const params = makeDesignParams({
        width: 2,
        depth: 3,
        height: 4,
        style: 'solid',
        magnetHoles: true,
      });
      const result = extractDesignDimensions(params);

      expect(result).toEqual({ width: 2, depth: 3, height: 4 });
      expect(result).not.toHaveProperty('style');
      expect(result).not.toHaveProperty('magnetHoles');
    });
  });

  describe('createBinSyncUpdate', () => {
    it('creates update object with dimensions', () => {
      const dims: SyncableDimensions = { width: 3, depth: 4, height: 5 };
      const result = createBinSyncUpdate(dims);

      expect(result).toEqual({ width: 3, depth: 4, height: 5 });
    });

    it('returns Partial<Bin> type (can be spread into bin)', () => {
      const dims: SyncableDimensions = { width: 3, depth: 4, height: 5 };
      const result = createBinSyncUpdate(dims);

      const bin = makeBin();
      const updatedBin: Bin = { ...bin, ...result };

      expect(updatedBin.width).toBe(3);
      expect(updatedBin.depth).toBe(4);
      expect(updatedBin.height).toBe(5);
      // Other properties preserved
      expect(updatedBin.label).toBe('Test Bin');
    });
  });

  describe('formatDimensions', () => {
    it('formats integer dimensions', () => {
      const dims: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      expect(formatDimensions(dims)).toBe('2×3×4');
    });

    it('formats fractional dimensions with one decimal place', () => {
      const dims: SyncableDimensions = { width: 2.5, depth: 3.5, height: 4 };
      expect(formatDimensions(dims)).toBe('2.5×3.5×4');
    });

    it('formats mixed integer and fractional dimensions', () => {
      const dims: SyncableDimensions = { width: 2, depth: 3.5, height: 4 };
      expect(formatDimensions(dims)).toBe('2×3.5×4');
    });

    it('handles small dimensions', () => {
      const dims: SyncableDimensions = { width: 0.5, depth: 0.5, height: 1 };
      expect(formatDimensions(dims)).toBe('0.5×0.5×1');
    });

    it('handles large dimensions', () => {
      const dims: SyncableDimensions = { width: 10, depth: 12, height: 8 };
      expect(formatDimensions(dims)).toBe('10×12×8');
    });
  });

  describe('formatDimensionChange', () => {
    it('formats integer change', () => {
      expect(formatDimensionChange(2, 3)).toBe('2 → 3');
    });

    it('formats fractional change', () => {
      expect(formatDimensionChange(2.5, 3.5)).toBe('2.5 → 3.5');
    });

    it('formats mixed integer to fractional change', () => {
      expect(formatDimensionChange(2, 2.5)).toBe('2 → 2.5');
    });

    it('formats decrease', () => {
      expect(formatDimensionChange(5, 3)).toBe('5 → 3');
    });

    it('formats same value (no actual change)', () => {
      expect(formatDimensionChange(2, 2)).toBe('2 → 2');
    });
  });
});
