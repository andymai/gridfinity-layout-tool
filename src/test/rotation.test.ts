import { describe, it, expect } from 'vitest';
import { validateRotation } from '@/utils/rotation';
import type { Bin, Layout } from '@/core/types';

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

  describe('rotation exceeds bounds with smart repositioning', () => {
    it('finds nearby position when rotation would exceed drawer width', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 1x3 bin at column 8 - rotating to 3x1 would need columns 8-10, exceeding width
      // Smart rotation moves it left to column 7 where 3x1 fits (columns 7-9)
      const bin = createTestBin({ x: 8, y: 0, width: 1, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
      if (result.valid && result.movedTo) {
        expect(result.movedTo.x).toBe(7); // Moved left by 1 to fit
        expect(result.movedTo.y).toBe(0); // Y unchanged
      }
    });

    it('finds nearby position when rotation would exceed drawer depth', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 3x1 bin at row 6 - rotating to 1x3 would need rows 6-8, exceeding depth (8)
      // Smart rotation moves it to row 5 where 1x3 fits (rows 5-7)
      const bin = createTestBin({ x: 0, y: 6, width: 3, depth: 1 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
      if (result.valid && result.movedTo) {
        expect(result.movedTo.x).toBe(0); // X unchanged
        expect(result.movedTo.y).toBe(5); // Moved down by 1 to fit
      }
    });

    it('allows rotation that stays within bounds (no move needed)', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });
      // 1x3 bin at column 7 - rotating to 3x1 uses columns 7-9 (within 10)
      const bin = createTestBin({ x: 7, y: 0, width: 1, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
      expect(result.movedTo).toBeUndefined(); // No move needed
    });

    it('allows rotation when bin fits at original position in small drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 3, depth: 3, height: 12 }, // Very small drawer
      });
      // 1x3 bin - rotating to 3x1 in a 3x3 drawer
      // A 3x1 rotated bin CAN fit at (0,0), (0,1), or (0,2)
      const bin = createTestBin({ x: 0, y: 0, width: 1, depth: 3 });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true); // Fits at original position
    });
  });

  describe('rotation causes collision with smart repositioning', () => {
    it('finds nearby position when bin would collide with another bin', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy column 2
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 2 - would collide with rotated bin1 at original position
      // Smart rotation searches nearby and can move the bin to avoid collision
      const bin2 = createTestBin({ id: 'bin2', x: 2, y: 0, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      // Should find a valid position (e.g., moving up where there's no collision)
      expect(result.valid).toBe(true);
      if (result.valid) {
        // The bin was moved to avoid collision
        expect(result.movedTo).toBeDefined();
      }
    });

    it('allows rotation when adjacent bin does not overlap (no move needed)', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 3 - no collision after rotation
      const bin2 = createTestBin({ id: 'bin2', x: 3, y: 0, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
      expect(result.movedTo).toBeUndefined(); // No move needed
    });

    it('allows rotation when adjacent bin is in different row (no move needed)', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 3 });
      // 1x1 bin at column 2, row 2 - no collision since rotated bin only uses rows 0-1
      const bin2 = createTestBin({ id: 'bin2', x: 2, y: 2, width: 1, depth: 1 });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
      expect(result.movedTo).toBeUndefined(); // No move needed
    });

    it('fails rotation when completely surrounded by other bins', () => {
      const layout = createTestLayout({
        drawer: { width: 4, depth: 4, height: 12 },
      });
      // 1x2 bin at (1,1) - rotating to 2x1 would need (1,1) to (2,1)
      // Surround with bins to block all nearby positions
      const bin1 = createTestBin({ id: 'bin1', x: 1, y: 1, width: 1, depth: 2 });
      const blockers = [
        createTestBin({ id: 'block1', x: 0, y: 0, width: 1, depth: 4 }), // Left column
        createTestBin({ id: 'block2', x: 2, y: 0, width: 2, depth: 4 }), // Right side
      ];
      layout.bins = [bin1, ...blockers];

      const result = validateRotation(bin1, layout);

      // Should fail as there's no space for the rotated 2x1 bin
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toBeDefined();
      }
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
