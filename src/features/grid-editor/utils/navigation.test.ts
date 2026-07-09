import { describe, it, expect } from 'vitest';
import {
  findNearestBinInDirection,
  findNearestBin,
  type Direction,
} from '@/features/grid-editor/utils/navigation';
import { createTestBin } from '@/test/testUtils';

describe('findNearestBinInDirection', () => {
  const activeLayerId = 'layer1';

  describe('basic directional navigation', () => {
    it('finds bin to the right', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const right = createTestBin({ id: 'right', x: 3, y: 0 });
      const allBins = [current, right];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result?.id).toBe('right');
    });

    it('finds bin to the left', () => {
      const current = createTestBin({ id: 'current', x: 5, y: 0 });
      const left = createTestBin({ id: 'left', x: 2, y: 0 });
      const allBins = [current, left];

      const result = findNearestBinInDirection(current, 'left', allBins, activeLayerId);
      expect(result?.id).toBe('left');
    });

    it('finds bin above (up increases y)', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const above = createTestBin({ id: 'above', x: 0, y: 3 });
      const allBins = [current, above];

      const result = findNearestBinInDirection(current, 'up', allBins, activeLayerId);
      expect(result?.id).toBe('above');
    });

    it('finds bin below (down decreases y)', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 5 });
      const below = createTestBin({ id: 'below', x: 0, y: 2 });
      const allBins = [current, below];

      const result = findNearestBinInDirection(current, 'down', allBins, activeLayerId);
      expect(result?.id).toBe('below');
    });
  });

  describe('returns null when no bin in direction', () => {
    it('returns null when no bin to the right', () => {
      const current = createTestBin({ id: 'current', x: 5, y: 0 });
      const left = createTestBin({ id: 'left', x: 2, y: 0 });
      const allBins = [current, left];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result).toBeNull();
    });

    it('returns null when no bin to the left', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const right = createTestBin({ id: 'right', x: 3, y: 0 });
      const allBins = [current, right];

      const result = findNearestBinInDirection(current, 'left', allBins, activeLayerId);
      expect(result).toBeNull();
    });

    it('returns null when no bin above', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 5 });
      const below = createTestBin({ id: 'below', x: 0, y: 2 });
      const allBins = [current, below];

      const result = findNearestBinInDirection(current, 'up', allBins, activeLayerId);
      expect(result).toBeNull();
    });

    it('returns null when no bin below', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const above = createTestBin({ id: 'above', x: 0, y: 3 });
      const allBins = [current, above];

      const result = findNearestBinInDirection(current, 'down', allBins, activeLayerId);
      expect(result).toBeNull();
    });

    it('returns null when only current bin exists', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const allBins = [current];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result).toBeNull();
    });

    it('returns null when no bins on active layer', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const otherLayer = createTestBin({ id: 'other', x: 3, y: 0, layerId: 'layer2' });
      const allBins = [current, otherLayer];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result).toBeNull();
    });
  });

  describe('layer filtering', () => {
    it('only considers bins on the active layer', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      const sameLayer = createTestBin({ id: 'same', x: 5, y: 0 });
      const otherLayer = createTestBin({ id: 'other', x: 3, y: 0, layerId: 'layer2' });
      const allBins = [current, sameLayer, otherLayer];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      // Should find same layer bin even though other layer bin is closer
      expect(result?.id).toBe('same');
    });
  });

  describe('nearest bin selection', () => {
    it('selects closest aligned bin horizontally', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 2, width: 1, depth: 1 });
      const close = createTestBin({ id: 'close', x: 3, y: 2 }); // Same y, close
      const far = createTestBin({ id: 'far', x: 6, y: 2 }); // Same y, far
      const allBins = [current, close, far];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result?.id).toBe('close');
    });

    it('selects closest aligned bin vertically', () => {
      const current = createTestBin({ id: 'current', x: 2, y: 0 });
      const close = createTestBin({ id: 'close', x: 2, y: 3 }); // Same x, close
      const far = createTestBin({ id: 'far', x: 2, y: 6 }); // Same x, far
      const allBins = [current, close, far];

      const result = findNearestBinInDirection(current, 'up', allBins, activeLayerId);
      expect(result?.id).toBe('close');
    });

    it('prioritizes alignment over distance', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 2 });
      // Misaligned but closer
      const misaligned = createTestBin({ id: 'misaligned', x: 2, y: 5 });
      // Aligned but farther
      const aligned = createTestBin({ id: 'aligned', x: 5, y: 2 });
      const allBins = [current, misaligned, aligned];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      // Should prefer aligned bin even if farther
      expect(result?.id).toBe('aligned');
    });

    it('uses distance as tiebreaker for equally aligned bins', () => {
      const current = createTestBin({ id: 'current', x: 0, y: 0 });
      // Both slightly off-axis by same amount
      const close = createTestBin({ id: 'close', x: 3, y: 1 });
      const far = createTestBin({ id: 'far', x: 6, y: 1 });
      const allBins = [current, close, far];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result?.id).toBe('close');
    });
  });

  describe('handles bins of various sizes', () => {
    it('uses center point of larger bins', () => {
      // Current bin: center at (1, 1)
      const current = createTestBin({ id: 'current', x: 0, y: 0, width: 2, depth: 2 });
      // Large bin to right: center at (5, 1.5)
      const large = createTestBin({ id: 'large', x: 3, y: 0, width: 4, depth: 3 });
      const allBins = [current, large];

      const result = findNearestBinInDirection(current, 'right', allBins, activeLayerId);
      expect(result?.id).toBe('large');
    });

    it('navigates between differently sized bins', () => {
      const small = createTestBin({ id: 'small', x: 0, y: 0, width: 1, depth: 1 });
      const large = createTestBin({ id: 'large', x: 3, y: 0, width: 3, depth: 3 });
      const allBins = [small, large];

      const result = findNearestBinInDirection(small, 'right', allBins, activeLayerId);
      expect(result?.id).toBe('large');
    });
  });

  describe('all directions work correctly', () => {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    it.each(directions)('handles %s direction', (direction) => {
      const current = createTestBin({ id: 'current', x: 5, y: 5 });
      let target: Bin;

      switch (direction) {
        case 'up':
          target = createTestBin({ id: 'target', x: 5, y: 8 });
          break;
        case 'down':
          target = createTestBin({ id: 'target', x: 5, y: 2 });
          break;
        case 'left':
          target = createTestBin({ id: 'target', x: 2, y: 5 });
          break;
        case 'right':
          target = createTestBin({ id: 'target', x: 8, y: 5 });
          break;
      }

      const allBins = [current, target];
      const result = findNearestBinInDirection(current, direction, allBins, activeLayerId);
      expect(result?.id).toBe('target');
    });
  });
});

describe('findNearestBin', () => {
  const activeLayerId = 'layer1';

  it('returns the closest surviving bin regardless of direction', () => {
    const from = createTestBin({ id: 'from', x: 5, y: 5 });
    const near = createTestBin({ id: 'near', x: 6, y: 5 });
    const far = createTestBin({ id: 'far', x: 0, y: 0 });

    const result = findNearestBin(from, [near, far], activeLayerId);
    expect(result?.id).toBe('near');
  });

  it('excludes the reference bin itself', () => {
    const from = createTestBin({ id: 'from', x: 5, y: 5 });
    const other = createTestBin({ id: 'other', x: 8, y: 8 });

    // `from` is passed among the candidates but must never be returned.
    const result = findNearestBin(from, [from, other], activeLayerId);
    expect(result?.id).toBe('other');
  });

  it('ignores bins on other layers', () => {
    const from = createTestBin({ id: 'from', x: 5, y: 5 });
    const sameLayer = createTestBin({ id: 'same', x: 9, y: 9 });
    const otherLayer = createTestBin({ id: 'other', x: 6, y: 5, layerId: 'layer2' });

    const result = findNearestBin(from, [sameLayer, otherLayer], activeLayerId);
    expect(result?.id).toBe('same');
  });

  it('returns null when no bins remain on the active layer', () => {
    const from = createTestBin({ id: 'from', x: 5, y: 5 });
    const otherLayer = createTestBin({ id: 'other', x: 6, y: 5, layerId: 'layer2' });

    expect(findNearestBin(from, [otherLayer], activeLayerId)).toBeNull();
    expect(findNearestBin(from, [], activeLayerId)).toBeNull();
  });
});
