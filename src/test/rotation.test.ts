import { describe, it, expect } from 'vitest';
import { validateRotation } from '../utils/rotation';
import type { Bin, Layout } from '../types';

function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'cat1', name: 'Test', color: '#ff0000' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [],
    ...overrides,
  };
}

function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 3,
    layerId: 'layer1',
    category: 'cat1',
    ...overrides,
  };
}

describe('validateRotation', () => {
  describe('valid rotations', () => {
    it('allows rotation when there is enough space', () => {
      const layout = createTestLayout();
      const bin = createTestBin({ x: 0, y: 0, width: 2, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
    });

    it('allows rotation of a square bin (no-op)', () => {
      const layout = createTestLayout();
      const bin = createTestBin({ x: 0, y: 0, width: 2, depth: 2 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
    });
  });

  describe('rotation exceeds bounds', () => {
    it('rejects rotation when bin would exceed drawer width', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 1x3 bin at column 8 - rotating to 3x1 would need columns 8-10, exceeding width
      const bin = createTestBin({ x: 8, y: 0, width: 1, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toContain('exceed drawer bounds');
      }
    });

    it('rejects rotation when bin would exceed drawer depth', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 3x1 bin at row 6 - rotating to 1x3 would need rows 6-8, exceeding depth
      const bin = createTestBin({ x: 0, y: 6, width: 3, depth: 1 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toContain('exceed drawer bounds');
      }
    });

    it('allows rotation that stays within bounds', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 1x3 bin at column 7 - rotating to 3x1 uses columns 7-9 (within 10)
      const bin = createTestBin({ x: 7, y: 0, width: 1, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
    });
  });

  describe('rotation causes collision', () => {
    it('rejects rotation when bin would collide with another bin', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy column 2
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 2 - would collide with rotated bin1
      const bin2 = createTestBin({ id: 'bin2', x: 2, y: 0, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toContain('collide');
      }
    });

    it('allows rotation when adjacent bin does not overlap', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 3 - no collision after rotation
      const bin2 = createTestBin({ id: 'bin2', x: 3, y: 0, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
    });

    it('allows rotation when adjacent bin is in different row', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 2, row 2 - no collision since rotated bin only uses rows 0-1
      const bin2 = createTestBin({ id: 'bin2', x: 2, y: 2, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
    });
  });

  describe('bins on different layers', () => {
    it('ignores collision with bins on other layers', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
      });
      // 2x3 bin at (0,0) on layer 1
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3, layerId: 'layer1' });
      // 1x1 bin at column 2 on layer 2 - no collision since different layers
      const bin2 = createTestBin({ id: 'bin2', x: 2, y: 0, width: 1, depth: 1, layerId: 'layer2' });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
    });
  });
});
