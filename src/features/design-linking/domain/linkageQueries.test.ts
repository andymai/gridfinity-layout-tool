import { describe, it, expect } from 'vitest';
import {
  getLinkedDesignId,
  isLinked,
  isLinkedTo,
  getBinsLinkedToDesign,
  getBinIdsLinkedToDesign,
  hasLinkedBins,
  countLinkedBins,
  getLinkedDesignIds,
  getLinkedBins,
  binMatchesDesign,
  getBinsWithDimensionMismatch,
  buildLinkedBinsSummary,
  resolveLinkedDesign,
  linkedDesignExists,
} from './linkageQueries';
import type { Bin } from '@/core/types';
import type { CustomBinRef } from '@/features/bin-designer/store/customBinRegistry';
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
    label: '',
    notes: '',
    ...overrides,
  };
}

function makeDesignRef(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: 'design-1',
    name: 'Test Design',
    width: 2,
    depth: 3,
    height: 4,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('linkageQueries', () => {
  describe('getLinkedDesignId', () => {
    it('returns design ID when bin is linked', () => {
      const bin = makeBin({ linkedDesignId: 'design-1' });
      expect(getLinkedDesignId(bin)).toBe('design-1');
    });

    it('returns null when bin has no linkedDesignId', () => {
      const bin = makeBin();
      expect(getLinkedDesignId(bin)).toBeNull();
    });

    it('returns null when linkedDesignId is undefined', () => {
      const bin = makeBin({ linkedDesignId: undefined });
      expect(getLinkedDesignId(bin)).toBeNull();
    });
  });

  describe('isLinked', () => {
    it('returns true when bin has a linkedDesignId', () => {
      const bin = makeBin({ linkedDesignId: 'design-1' });
      expect(isLinked(bin)).toBe(true);
    });

    it('returns false when bin has no linkedDesignId', () => {
      const bin = makeBin();
      expect(isLinked(bin)).toBe(false);
    });

    it('returns false when linkedDesignId is null', () => {
      const bin = makeBin({ linkedDesignId: undefined });
      expect(isLinked(bin)).toBe(false);
    });
  });

  describe('isLinkedTo', () => {
    it('returns true when bin is linked to specified design', () => {
      const bin = makeBin({ linkedDesignId: 'design-1' });
      expect(isLinkedTo(bin, 'design-1')).toBe(true);
    });

    it('returns false when bin is linked to different design', () => {
      const bin = makeBin({ linkedDesignId: 'design-1' });
      expect(isLinkedTo(bin, 'design-2')).toBe(false);
    });

    it('returns false when bin is not linked', () => {
      const bin = makeBin();
      expect(isLinkedTo(bin, 'design-1')).toBe(false);
    });
  });

  describe('getBinsLinkedToDesign', () => {
    it('returns bins linked to specified design', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-1' }),
      ];

      const result = getBinsLinkedToDesign(bins, 'design-1');

      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin-1', 'bin-3']);
    });

    it('returns empty array when no bins are linked to design', () => {
      const bins = [makeBin({ id: 'bin-1', linkedDesignId: 'design-2' }), makeBin({ id: 'bin-2' })];

      const result = getBinsLinkedToDesign(bins, 'design-1');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty bins list', () => {
      expect(getBinsLinkedToDesign([], 'design-1')).toEqual([]);
    });
  });

  describe('getBinIdsLinkedToDesign', () => {
    it('returns IDs of bins linked to specified design', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-1' }),
      ];

      const result = getBinIdsLinkedToDesign(bins, 'design-1');

      expect(result).toEqual(['bin-1', 'bin-3']);
    });
  });

  describe('hasLinkedBins', () => {
    it('returns true when design has linked bins', () => {
      const bins = [makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }), makeBin({ id: 'bin-2' })];

      expect(hasLinkedBins(bins, 'design-1')).toBe(true);
    });

    it('returns false when design has no linked bins', () => {
      const bins = [makeBin({ id: 'bin-1', linkedDesignId: 'design-2' }), makeBin({ id: 'bin-2' })];

      expect(hasLinkedBins(bins, 'design-1')).toBe(false);
    });
  });

  describe('countLinkedBins', () => {
    it('counts bins linked to design', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-4', linkedDesignId: 'design-1' }),
      ];

      expect(countLinkedBins(bins, 'design-1')).toBe(3);
    });

    it('returns 0 when no bins linked', () => {
      const bins = [makeBin({ id: 'bin-1' })];
      expect(countLinkedBins(bins, 'design-1')).toBe(0);
    });
  });

  describe('getLinkedDesignIds', () => {
    it('returns unique design IDs', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-4' }),
      ];

      const result = getLinkedDesignIds(bins);

      expect(result).toHaveLength(2);
      expect(result).toContain('design-1');
      expect(result).toContain('design-2');
    });

    it('returns empty array when no bins are linked', () => {
      const bins = [makeBin({ id: 'bin-1' }), makeBin({ id: 'bin-2' })];
      expect(getLinkedDesignIds(bins)).toEqual([]);
    });
  });

  describe('getLinkedBins', () => {
    it('returns all bins that have a linkedDesignId', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-2' }),
      ];

      const result = getLinkedBins(bins);

      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin-1', 'bin-3']);
    });
  });

  describe('binMatchesDesign', () => {
    it('returns true when dimensions match', () => {
      const bin = makeBin({ width: 2, depth: 3, height: 4 });
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      expect(binMatchesDesign(bin, designDims)).toBe(true);
    });

    it('returns false when dimensions differ', () => {
      const bin = makeBin({ width: 2, depth: 3, height: 4 });
      const designDims: SyncableDimensions = { width: 3, depth: 3, height: 4 };

      expect(binMatchesDesign(bin, designDims)).toBe(false);
    });
  });

  describe('getBinsWithDimensionMismatch', () => {
    it('returns bins linked to design with mismatched dimensions', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1', width: 2, depth: 3, height: 4 }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-1', width: 3, depth: 3, height: 4 }), // Mismatch
        makeBin({ id: 'bin-3', linkedDesignId: 'design-2', width: 5, depth: 5, height: 5 }),
      ];
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      const result = getBinsWithDimensionMismatch(bins, 'design-1', designDims);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('bin-2');
    });

    it('returns empty array when all dimensions match', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1', width: 2, depth: 3, height: 4 }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-1', width: 2, depth: 3, height: 4 }),
      ];
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      const result = getBinsWithDimensionMismatch(bins, 'design-1', designDims);
      expect(result).toEqual([]);
    });
  });

  describe('buildLinkedBinsSummary', () => {
    it('builds summary with linked bins', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1', width: 2, depth: 3, height: 4 }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-1', width: 2, depth: 3, height: 4 }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-2' }),
      ];
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      const result = buildLinkedBinsSummary('design-1', 'My Design', bins, designDims);

      expect(result.designId).toBe('design-1');
      expect(result.designName).toBe('My Design');
      expect(result.linkedBinCount).toBe(2);
      expect(result.linkedBinIds).toEqual(['bin-1', 'bin-2']);
      expect(result.hasDimensionMismatch).toBe(false);
    });

    it('detects dimension mismatch', () => {
      const bins = [
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1', width: 3, depth: 3, height: 4 }), // Mismatch
      ];
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      const result = buildLinkedBinsSummary('design-1', 'My Design', bins, designDims);

      expect(result.hasDimensionMismatch).toBe(true);
    });

    it('handles empty linked bins', () => {
      const bins = [makeBin({ id: 'bin-1', linkedDesignId: 'other-design' })];
      const designDims: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      const result = buildLinkedBinsSummary('design-1', 'My Design', bins, designDims);

      expect(result.linkedBinCount).toBe(0);
      expect(result.linkedBinIds).toEqual([]);
      expect(result.hasDimensionMismatch).toBe(false);
    });
  });

  describe('resolveLinkedDesign', () => {
    it('returns design ref when found in registry', () => {
      const registry = [
        makeDesignRef({ id: 'design-1', name: 'Design One' }),
        makeDesignRef({ id: 'design-2', name: 'Design Two' }),
      ];

      const result = resolveLinkedDesign('design-1', registry);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Design One');
    });

    it('returns null when design not found', () => {
      const registry = [makeDesignRef({ id: 'design-1' })];

      const result = resolveLinkedDesign('design-999', registry);
      expect(result).toBeNull();
    });

    it('returns null when linkedDesignId is undefined', () => {
      const registry = [makeDesignRef({ id: 'design-1' })];

      expect(resolveLinkedDesign(undefined, registry)).toBeNull();
    });

    it('returns null for empty registry', () => {
      expect(resolveLinkedDesign('design-1', [])).toBeNull();
    });
  });

  describe('linkedDesignExists', () => {
    it('returns true when design exists in registry', () => {
      const registry = [makeDesignRef({ id: 'design-1' })];
      expect(linkedDesignExists('design-1', registry)).toBe(true);
    });

    it('returns false when design not in registry', () => {
      const registry = [makeDesignRef({ id: 'design-1' })];
      expect(linkedDesignExists('design-999', registry)).toBe(false);
    });

    it('returns false when linkedDesignId is undefined', () => {
      const registry = [makeDesignRef({ id: 'design-1' })];
      expect(linkedDesignExists(undefined, registry)).toBe(false);
    });
  });
});
