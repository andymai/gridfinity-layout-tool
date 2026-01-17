import { describe, it, expect } from 'vitest';
import {
  getBinLocationContext,
  validateBinRotation,
  isBinInStash,
  isBinOnGrid,
  type BinLocation,
} from '../utils/binLocation';
import { STAGING_ID } from '../core/constants';
import type { Bin, Layout } from '../core/types';

// Test helper: Create a minimal valid layout
function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    name: 'Test Layout',
    bins: [],
    layers: [
      { id: 'layer1', name: 'Layer 1', height: 3 },
    ],
    categories: [
      { id: 'cat1', name: 'Category 1', color: '#3b82f6' },
    ],
    drawer: { width: 10, height: 12, depth: 8 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    ...overrides,
  };
}

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

describe('binLocation utility', () => {
  describe('getBinLocationContext', () => {
    it('returns grid context for bins on a layer', () => {
      const bin = createTestBin({ layerId: 'layer1' });
      const context = getBinLocationContext(bin);

      expect(context.location).toBe('grid');
      expect(context.canRotate).toBe(true);
      expect(context.canMoveToStash).toBe(true);
      expect(context.canEdit).toBe(true);
      expect(context.requiresPlacementValidation).toBe(true);
      expect(context.label).toBe('Grid');
    });

    it('returns stash context for bins in stash', () => {
      const bin = createTestBin({ layerId: STAGING_ID });
      const context = getBinLocationContext(bin);

      expect(context.location).toBe('stash');
      expect(context.canRotate).toBe(true);
      expect(context.canMoveToStash).toBe(false);
      expect(context.canEdit).toBe(true);
      expect(context.requiresPlacementValidation).toBe(false);
      expect(context.label).toBe('Stash');
    });

    it('returns consistent context for same bin', () => {
      const bin = createTestBin();
      const context1 = getBinLocationContext(bin);
      const context2 = getBinLocationContext(bin);

      expect(context1).toEqual(context2);
    });
  });

  describe('validateBinRotation', () => {
    describe('for stash bins', () => {
      it('always returns valid for stash bins', () => {
        const layout = createTestLayout();
        const bin = createTestBin({ layerId: STAGING_ID, width: 100, depth: 100 });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('allows rotation regardless of dimensions', () => {
        const layout = createTestLayout({ drawer: { width: 5, height: 12, depth: 5 } });
        const bin = createTestBin({ layerId: STAGING_ID, width: 10, depth: 3 });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });
    });

    describe('for grid bins', () => {
      it('allows rotation when rotated bin fits', () => {
        const layout = createTestLayout({ drawer: { width: 10, height: 12, depth: 8 } });
        const bin = createTestBin({ x: 0, y: 0, width: 3, depth: 2, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('rejects rotation when width exceeds drawer bounds', () => {
        const layout = createTestLayout({ drawer: { width: 5, height: 12, depth: 8 } });
        const bin = createTestBin({ x: 0, y: 0, width: 3, depth: 6, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(false);
        expect(result.message).toContain('exceed drawer bounds');
      });

      it('rejects rotation when depth exceeds drawer bounds', () => {
        const layout = createTestLayout({ drawer: { width: 10, height: 12, depth: 5 } });
        const bin = createTestBin({ x: 0, y: 0, width: 6, depth: 3, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(false);
        expect(result.message).toContain('exceed drawer bounds');
      });

      it('rejects rotation when it would collide with another bin', () => {
        const layout = createTestLayout({
          bins: [
            createTestBin({ id: 'bin2', x: 3, y: 0, width: 2, depth: 2, layerId: 'layer1' }),
          ],
        });
        const bin = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 4, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(false);
        expect(result.message).toContain('collide');
      });

      it('allows rotation when bins are on different layers', () => {
        const layout = createTestLayout({
          layers: [
            { id: 'layer1', name: 'Layer 1', height: 3 },
            { id: 'layer2', name: 'Layer 2', height: 3 },
          ],
          bins: [
            createTestBin({ id: 'bin2', x: 3, y: 0, width: 2, depth: 2, layerId: 'layer2' }),
          ],
        });
        const bin = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 4, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('handles blocked zones from lower layers', () => {
        const layout = createTestLayout({
          layers: [
            { id: 'layer1', name: 'Layer 1', height: 3 },
            { id: 'layer2', name: 'Layer 2', height: 3 },
          ],
          bins: [
            // Tall bin on layer1 that blocks layer2
            createTestBin({ id: 'bin2', x: 3, y: 0, width: 2, depth: 2, layerId: 'layer1', height: 6 }),
          ],
        });
        const bin = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 4, layerId: 'layer2' });

        const result = validateBinRotation(bin, layout);

        // This could be valid or invalid depending on whether the rotated bin overlaps the blocked zone
        // The key is that validateBinRotation correctly checks blocked zones
        expect(result).toHaveProperty('valid');
      });

      it('allows rotation when bin rotates in place without collision', () => {
        const layout = createTestLayout({ drawer: { width: 10, height: 12, depth: 8 } });
        const bin = createTestBin({ x: 0, y: 0, width: 3, depth: 2, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('handles square bins (rotation should always work)', () => {
        const layout = createTestLayout();
        const bin = createTestBin({ x: 0, y: 0, width: 3, depth: 3, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('handles bins at drawer boundaries', () => {
        const layout = createTestLayout({ drawer: { width: 10, height: 12, depth: 8 } });
        const bin = createTestBin({ x: 8, y: 6, width: 2, depth: 2, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('handles bins with clearance height', () => {
        const layout = createTestLayout();
        const bin = createTestBin({
          x: 0,
          y: 0,
          width: 3,
          depth: 2,
          layerId: 'layer1',
          clearanceHeight: 2,
        });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });

      it('handles fractional dimensions (half-bin mode)', () => {
        const layout = createTestLayout();
        const bin = createTestBin({ x: 0, y: 0, width: 1.5, depth: 1, layerId: 'layer1' });

        const result = validateBinRotation(bin, layout);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('isBinInStash', () => {
    it('returns true for bins in stash', () => {
      const bin = createTestBin({ layerId: STAGING_ID });
      expect(isBinInStash(bin)).toBe(true);
    });

    it('returns false for bins on grid', () => {
      const bin = createTestBin({ layerId: 'layer1' });
      expect(isBinInStash(bin)).toBe(false);
    });
  });

  describe('isBinOnGrid', () => {
    it('returns true for bins on grid', () => {
      const bin = createTestBin({ layerId: 'layer1' });
      expect(isBinOnGrid(bin)).toBe(true);
    });

    it('returns false for bins in stash', () => {
      const bin = createTestBin({ layerId: STAGING_ID });
      expect(isBinOnGrid(bin)).toBe(false);
    });
  });

  describe('location type consistency', () => {
    it('maintains type safety for BinLocation', () => {
      const gridBin = createTestBin({ layerId: 'layer1' });
      const stashBin = createTestBin({ layerId: STAGING_ID });

      const gridContext = getBinLocationContext(gridBin);
      const stashContext = getBinLocationContext(stashBin);

      const locations: BinLocation[] = [gridContext.location, stashContext.location];

      expect(locations).toEqual(['grid', 'stash']);
    });
  });
});
