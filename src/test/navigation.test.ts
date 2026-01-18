import { describe, it, expect } from 'vitest';
import {
  findNearestBinInDirection,
  doesBinOverlap,
  getOverlappingBins,
  type Direction,
} from '@/utils/navigation';
import type { Bin } from '@/core/types';

// Helper to create a test bin
function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'test-bin',
    layerId: 'layer1',
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    category: 'cat1',
    label: '',
    notes: '',
    ...overrides,
  };
}

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

describe('doesBinOverlap', () => {
  describe('detects overlapping bins', () => {
    it('detects full overlap', () => {
      const bin1 = { x: 0, y: 0, width: 3, depth: 3 };
      const bin2 = { x: 1, y: 1, width: 1, depth: 1 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
      expect(doesBinOverlap(bin2, bin1)).toBe(true);
    });

    it('detects partial overlap', () => {
      const bin1 = { x: 0, y: 0, width: 3, depth: 3 };
      const bin2 = { x: 2, y: 2, width: 3, depth: 3 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
    });

    it('detects identical positions', () => {
      const bin1 = { x: 2, y: 2, width: 2, depth: 2 };
      const bin2 = { x: 2, y: 2, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
    });

    it('detects overlap at edges', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 1, y: 0, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
    });
  });

  describe('detects non-overlapping bins', () => {
    it('no overlap when bins are separated horizontally', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 5, y: 0, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(false);
    });

    it('no overlap when bins are separated vertically', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 0, y: 5, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(false);
    });

    it('no overlap when bins touch at edge (not overlapping)', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 2, y: 0, width: 2, depth: 2 }; // Starts exactly where bin1 ends

      expect(doesBinOverlap(bin1, bin2)).toBe(false);
    });

    it('no overlap when bins touch at corner', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 2, y: 2, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(false);
    });

    it('no overlap when bins are diagonal', () => {
      const bin1 = { x: 0, y: 0, width: 2, depth: 2 };
      const bin2 = { x: 5, y: 5, width: 2, depth: 2 };

      expect(doesBinOverlap(bin1, bin2)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles 1x1 bins', () => {
      const bin1 = { x: 0, y: 0, width: 1, depth: 1 };
      const bin2 = { x: 0, y: 0, width: 1, depth: 1 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
    });

    it('handles large bins', () => {
      const bin1 = { x: 0, y: 0, width: 50, depth: 50 };
      const bin2 = { x: 25, y: 25, width: 10, depth: 10 };

      expect(doesBinOverlap(bin1, bin2)).toBe(true);
    });
  });
});

describe('getOverlappingBins', () => {
  describe('finds overlapping bins', () => {
    it('returns all overlapping bins', () => {
      const position = { x: 2, y: 2, width: 3, depth: 3 };
      const overlapping1 = createTestBin({ id: 'overlap1', x: 1, y: 1, width: 2, depth: 2 });
      const overlapping2 = createTestBin({ id: 'overlap2', x: 4, y: 4, width: 2, depth: 2 });
      const notOverlapping = createTestBin({ id: 'no-overlap', x: 10, y: 10, width: 2, depth: 2 });
      const allBins = [overlapping1, overlapping2, notOverlapping];

      const result = getOverlappingBins(position, allBins);

      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toContain('overlap1');
      expect(result.map(b => b.id)).toContain('overlap2');
    });

    it('returns empty array when no overlaps', () => {
      const position = { x: 0, y: 0, width: 2, depth: 2 };
      const far1 = createTestBin({ id: 'far1', x: 5, y: 0, width: 2, depth: 2 });
      const far2 = createTestBin({ id: 'far2', x: 0, y: 5, width: 2, depth: 2 });
      const allBins = [far1, far2];

      const result = getOverlappingBins(position, allBins);

      expect(result).toHaveLength(0);
    });

    it('returns empty array when bins array is empty', () => {
      const position = { x: 0, y: 0, width: 2, depth: 2 };

      const result = getOverlappingBins(position, []);

      expect(result).toHaveLength(0);
    });
  });

  describe('excludeBinId parameter', () => {
    it('excludes specified bin from results', () => {
      const position = { x: 0, y: 0, width: 3, depth: 3 };
      const toExclude = createTestBin({ id: 'exclude-me', x: 0, y: 0, width: 2, depth: 2 });
      const included = createTestBin({ id: 'include-me', x: 1, y: 1, width: 2, depth: 2 });
      const allBins = [toExclude, included];

      const result = getOverlappingBins(position, allBins, 'exclude-me');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('include-me');
    });

    it('works when excludeBinId does not match any bin', () => {
      const position = { x: 0, y: 0, width: 3, depth: 3 };
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2 });
      const bin2 = createTestBin({ id: 'bin2', x: 1, y: 1, width: 2, depth: 2 });
      const allBins = [bin1, bin2];

      const result = getOverlappingBins(position, allBins, 'non-existent');

      expect(result).toHaveLength(2);
    });

    it('works without excludeBinId (undefined)', () => {
      const position = { x: 0, y: 0, width: 3, depth: 3 };
      const bin1 = createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2 });
      const allBins = [bin1];

      const result = getOverlappingBins(position, allBins);

      expect(result).toHaveLength(1);
    });
  });

  describe('typical use cases', () => {
    it('validates keyboard drag move', () => {
      // Current bin at (2, 2), want to move to (3, 2)
      const currentBin = createTestBin({ id: 'moving', x: 2, y: 2, width: 2, depth: 2 });
      const newPosition = { x: 3, y: 2, width: 2, depth: 2 };
      const obstacle = createTestBin({ id: 'obstacle', x: 4, y: 2, width: 2, depth: 2 });
      const allBins = [currentBin, obstacle];

      // Exclude current bin since we're checking where it would move TO
      const overlaps = getOverlappingBins(newPosition, allBins, 'moving');

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].id).toBe('obstacle');
    });

    it('validates keyboard resize', () => {
      // Current bin (2x2), want to resize to (3x2)
      const currentBin = createTestBin({ id: 'resizing', x: 0, y: 0, width: 2, depth: 2 });
      const newSize = { x: 0, y: 0, width: 3, depth: 2 };
      const adjacent = createTestBin({ id: 'adjacent', x: 2, y: 0, width: 2, depth: 2 });
      const allBins = [currentBin, adjacent];

      const overlaps = getOverlappingBins(newSize, allBins, 'resizing');

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].id).toBe('adjacent');
    });
  });
});
