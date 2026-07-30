import { describe, it, expect } from 'vitest';
import { validateRotation, type RotationResult } from '@/shared/utils/rotation';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';

function expectRotationValid(result: RotationResult): Extract<RotationResult, { valid: true }> {
  expect(result.valid).toBe(true);
  if (!result.valid) throw new Error(`Expected a valid rotation: ${result.message}`);
  return result;
}

describe('validateRotation', () => {
  describe('valid rotations', () => {
    it('allows rotation when there is enough space', () => {
      const layout = createTestLayout();
      const bin = createTestBin({
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
    });

    it('allows rotation of a square bin (no-op)', () => {
      const layout = createTestLayout();
      const bin = createTestBin({
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true);
    });
  });

  describe('rotation exceeds bounds with smart repositioning', () => {
    it('finds nearby position when rotation would exceed drawer width', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
      });
      // 1x3 bin at column 8 - rotating to 3x1 would need columns 8-10, exceeding width
      // Smart rotation moves it left to column 7 where 3x1 fits (columns 7-9)
      const bin = createTestBin({
        x: gridUnits(8),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(3),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      const { movedTo } = expectRotationValid(result);
      expect(movedTo).toBeDefined();
      expect(movedTo?.x).toBe(7); // Moved left by 1 to fit
      expect(movedTo?.y).toBe(0); // Y unchanged
    });

    it('finds nearby position when rotation would exceed drawer depth', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
      });
      // 3x1 bin at row 6 - rotating to 1x3 would need rows 6-8, exceeding depth (8)
      // Smart rotation moves it to row 5 where 1x3 fits (rows 5-7)
      const bin = createTestBin({
        x: gridUnits(0),
        y: gridUnits(6),
        width: gridUnits(3),
        depth: gridUnits(1),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      const { movedTo } = expectRotationValid(result);
      expect(movedTo).toBeDefined();
      expect(movedTo?.x).toBe(0); // X unchanged
      expect(movedTo?.y).toBe(5); // Moved down by 1 to fit
    });

    it('allows rotation that stays within bounds (no move needed)', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
      });
      // 1x3 bin at column 7 - rotating to 3x1 uses columns 7-9 (within 10)
      const bin = createTestBin({
        x: gridUnits(7),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(3),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(expectRotationValid(result).movedTo).toBeUndefined(); // No move needed
    });

    it('allows rotation when bin fits at original position in small drawer', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(3), depth: gridUnits(3), height: heightUnits(12) }, // Very small drawer
      });
      // 1x3 bin - rotating to 3x1 in a 3x3 drawer
      // A 3x1 rotated bin CAN fit at (0,0), (0,1), or (0,2)
      const bin = createTestBin({
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(3),
      });
      layout.bins = [bin];

      const result = validateRotation(bin, layout);

      expect(result.valid).toBe(true); // Fits at original position
    });
  });

  describe('rotation causes collision with smart repositioning', () => {
    it('finds nearby position when bin would collide with another bin', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy column 2
      const bin1 = createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
      });
      // 1x1 bin at column 2 - would collide with rotated bin1 at original position
      // Smart rotation searches nearby and can move the bin to avoid collision
      const bin2 = createTestBin({
        id: binId('bin2'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      // Should find a valid position (e.g., moving up where there's no collision)
      expect(expectRotationValid(result).movedTo).toBeDefined();
    });

    it('allows rotation when adjacent bin does not overlap (no move needed)', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
      });
      // 1x1 bin at column 3 - no collision after rotation
      const bin2 = createTestBin({
        id: binId('bin2'),
        x: gridUnits(3),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(expectRotationValid(result).movedTo).toBeUndefined(); // No move needed
    });

    it('allows rotation when adjacent bin is in different row (no move needed)', () => {
      const layout = createTestLayout();
      // 2x3 bin at (0,0) - rotating to 3x2 would occupy columns 0-2, rows 0-1
      const bin1 = createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
      });
      // 1x1 bin at column 2, row 2 - no collision since rotated bin only uses rows 0-1
      const bin2 = createTestBin({
        id: binId('bin2'),
        x: gridUnits(2),
        y: gridUnits(2),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(expectRotationValid(result).movedTo).toBeUndefined(); // No move needed
    });

    it('fails rotation when completely surrounded by other bins', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(4), depth: gridUnits(4), height: heightUnits(12) },
      });
      // 1x2 bin at (1,1) - rotating to 2x1 would need (1,1) to (2,1)
      // Surround with bins to block all nearby positions
      const bin1 = createTestBin({
        id: binId('bin1'),
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(1),
        depth: gridUnits(2),
      });
      const blockers = [
        createTestBin({
          id: binId('block1'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(4),
        }), // Left column
        createTestBin({
          id: binId('block2'),
          x: gridUnits(2),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(4),
        }), // Right side
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
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
        ],
      });
      // 2x3 bin at (0,0) on layer 1
      const bin1 = createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(3),
        layerId: layerId('layer1'),
      });
      // 1x1 bin at column 2 on layer 2 - no collision since different layers
      const bin2 = createTestBin({
        id: binId('bin2'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
        layerId: layerId('layer2'),
      });
      layout.bins = [bin1, bin2];

      const result = validateRotation(bin1, layout);

      expect(result.valid).toBe(true);
    });
  });
});
