import { describe, it, expect } from 'vitest';
import {
  dimensionsMatch,
  compareDimensions,
  checkSyncEligibility,
  checkBatchSyncEligibility,
  generateDefaultDesignName,
} from './linkingRules';
import type { Bin, Layout } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits, mm } from '@/core/types';
import type { SyncableDimensions } from '../types';

// Test helpers
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: binId('bin-1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(2),
    depth: gridUnits(2),
    height: heightUnits(3),
    layerId: layerId('layer-1'),
    category: categoryId('cat-1'),
    label: '',
    notes: '',
    ...overrides,
  };
}

function makeLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
    layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(5) }],
    categories: [{ id: categoryId('cat-1'), name: 'Category 1', color: '#ff0000' }],
    bins: [],
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    printBedSize: mm(256),
    ...overrides,
  };
}

describe('linkingRules', () => {
  describe('dimensionsMatch', () => {
    it('returns true for identical dimensions', () => {
      const a: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      expect(dimensionsMatch(a, b)).toBe(true);
    });

    it('returns false when width differs', () => {
      const a: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 3, depth: 3, height: 4 };
      expect(dimensionsMatch(a, b)).toBe(false);
    });

    it('returns false when depth differs', () => {
      const a: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 2, depth: 4, height: 4 };
      expect(dimensionsMatch(a, b)).toBe(false);
    });

    it('returns false when height differs', () => {
      const a: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 2, depth: 3, height: 5 };
      expect(dimensionsMatch(a, b)).toBe(false);
    });

    it('handles fractional dimensions (half-bin mode)', () => {
      const a: SyncableDimensions = { width: 2.5, depth: 3.5, height: 4 };
      const b: SyncableDimensions = { width: 2.5, depth: 3.5, height: 4 };
      expect(dimensionsMatch(a, b)).toBe(true);
    });

    it('returns true within tolerance for floating point', () => {
      const a: SyncableDimensions = { width: 2.0000001, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      expect(dimensionsMatch(a, b)).toBe(true);
    });

    it('respects custom tolerance', () => {
      const a: SyncableDimensions = { width: 2.1, depth: 3, height: 4 };
      const b: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      expect(dimensionsMatch(a, b, 0.001)).toBe(false);
      expect(dimensionsMatch(a, b, 0.2)).toBe(true);
    });
  });

  describe('compareDimensions', () => {
    it('returns matched true when dimensions are equal', () => {
      const design: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const bin: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const result = compareDimensions(design, bin);

      expect(result.matched).toBe(true);
      expect(result.differences.width).toBe(false);
      expect(result.differences.depth).toBe(false);
      expect(result.differences.height).toBe(false);
    });

    it('returns matched false and identifies different width', () => {
      const design: SyncableDimensions = { width: 3, depth: 3, height: 4 };
      const bin: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const result = compareDimensions(design, bin);

      expect(result.matched).toBe(false);
      expect(result.differences.width).toBe(true);
      expect(result.differences.depth).toBe(false);
      expect(result.differences.height).toBe(false);
    });

    it('returns matched false and identifies multiple differences', () => {
      const design: SyncableDimensions = { width: 3, depth: 4, height: 5 };
      const bin: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const result = compareDimensions(design, bin);

      expect(result.matched).toBe(false);
      expect(result.differences.width).toBe(true);
      expect(result.differences.depth).toBe(true);
      expect(result.differences.height).toBe(true);
    });

    it('includes original dimensions in result', () => {
      const design: SyncableDimensions = { width: 3, depth: 4, height: 5 };
      const bin: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const result = compareDimensions(design, bin);

      expect(result.design).toEqual(design);
      expect(result.bin).toEqual(bin);
    });
  });

  describe('checkSyncEligibility', () => {
    it('allows sync when new dimensions fit within bounds', () => {
      const bin = makeBin({
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 3, depth: 3, height: 4 };

      const result = checkSyncEligibility(bin, newDimensions, layout, []);
      expect(result.canSync).toBe(true);
      expect(result.blockReason).toBeUndefined();
    });

    it('blocks sync when new width exceeds drawer bounds', () => {
      const bin = makeBin({
        x: gridUnits(8),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 4, depth: 2, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, []);
      expect(result.canSync).toBe(false);
      expect(result.blockReason).toBe('out_of_bounds');
    });

    it('blocks sync when new depth exceeds drawer bounds', () => {
      const bin = makeBin({
        x: gridUnits(0),
        y: gridUnits(8),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 2, depth: 4, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, []);
      expect(result.canSync).toBe(false);
      expect(result.blockReason).toBe('out_of_bounds');
    });

    it('blocks sync when new dimensions collide with another bin', () => {
      const bin = makeBin({
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-1'),
      });
      const otherBin = makeBin({
        id: binId('bin-2'),
        x: gridUnits(3),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-1'),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 4, depth: 2, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, [otherBin]);
      expect(result.canSync).toBe(false);
      expect(result.blockReason).toBe('collision');
    });

    it('allows sync when expanding toward empty space', () => {
      const bin = makeBin({
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-1'),
      });
      const otherBin = makeBin({
        id: binId('bin-2'),
        x: gridUnits(5),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-1'),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 4, depth: 2, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, [otherBin]);
      expect(result.canSync).toBe(true);
    });

    it('ignores bins on different layers when checking collisions', () => {
      const bin = makeBin({
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-1'),
      });
      const otherBin = makeBin({
        id: binId('bin-2'),
        x: gridUnits(1),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        layerId: layerId('layer-2'),
      });
      const layout = makeLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
      });
      const newDimensions: SyncableDimensions = { width: 4, depth: 2, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, [otherBin]);
      expect(result.canSync).toBe(true);
    });

    it('returns correct binId in result', () => {
      const bin = makeBin({ id: binId('my-bin-id') });
      const layout = makeLayout();
      const newDimensions: SyncableDimensions = { width: 2, depth: 2, height: 3 };

      const result = checkSyncEligibility(bin, newDimensions, layout, []);
      expect(result.binId).toBe('my-bin-id');
    });
  });

  describe('checkBatchSyncEligibility', () => {
    it('checks eligibility for multiple bins', () => {
      const bin1 = makeBin({ id: binId('bin-1'), x: gridUnits(0), y: gridUnits(0) });
      const bin2 = makeBin({ id: binId('bin-2'), x: gridUnits(5), y: gridUnits(0) });
      const layout = makeLayout({ bins: [bin1, bin2] });
      const newDimensions: SyncableDimensions = { width: 3, depth: 3, height: 4 };

      const results = checkBatchSyncEligibility([bin1, bin2], newDimensions, layout);

      expect(results).toHaveLength(2);
      expect(results[0].binId).toBe('bin-1');
      expect(results[1].binId).toBe('bin-2');
    });

    it('returns mixed results when some bins can sync and others cannot', () => {
      const bin1 = makeBin({ id: binId('bin-1'), x: gridUnits(0), y: gridUnits(0) });
      const bin2 = makeBin({ id: binId('bin-2'), x: gridUnits(8), y: gridUnits(0) }); // Near edge
      const layout = makeLayout({ bins: [bin1, bin2] });
      const newDimensions: SyncableDimensions = { width: 4, depth: 2, height: 3 };

      const results = checkBatchSyncEligibility([bin1, bin2], newDimensions, layout);

      expect(results[0].canSync).toBe(true);
      expect(results[1].canSync).toBe(false);
      expect(results[1].blockReason).toBe('out_of_bounds');
    });
  });

  describe('generateDefaultDesignName', () => {
    it('generates name with integer dimensions', () => {
      const dims: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      expect(generateDefaultDesignName(dims)).toBe('2×3×4 Bin');
    });

    it('generates name with fractional dimensions', () => {
      const dims: SyncableDimensions = { width: 2.5, depth: 3.5, height: 4 };
      expect(generateDefaultDesignName(dims)).toBe('2.5×3.5×4 Bin');
    });

    it('handles mixed integer and fractional dimensions', () => {
      const dims: SyncableDimensions = { width: 2, depth: 3.5, height: 4 };
      expect(generateDefaultDesignName(dims)).toBe('2×3.5×4 Bin');
    });

    it('handles 1×1×1 dimensions', () => {
      const dims: SyncableDimensions = { width: 1, depth: 1, height: 1 };
      expect(generateDefaultDesignName(dims)).toBe('1×1×1 Bin');
    });
  });
});
