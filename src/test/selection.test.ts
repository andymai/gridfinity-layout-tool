import { describe, it, expect } from 'vitest';
import { getSelectionBounds, constrainGroupDelta, applyGroupDelta } from '../utils/selection';
import type { Bin } from '../core/types';

// Helper to create test bins
function createBin(overrides: Partial<Bin>): Bin {
  return {
    id: 'test-bin',
    layerId: 'layer-1',
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    category: '',
    label: '',
    notes: '',
    ...overrides,
  };
}

describe('getSelectionBounds', () => {
  it('returns zero rect for empty array', () => {
    const bounds = getSelectionBounds([]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, depth: 0 });
  });

  it('returns bin dimensions for single bin', () => {
    const bin = createBin({ x: 2, y: 3, width: 4, depth: 5 });
    const bounds = getSelectionBounds([bin]);
    expect(bounds).toEqual({ x: 2, y: 3, width: 4, depth: 5 });
  });

  it('calculates bounding box for multiple bins', () => {
    const bins = [
      createBin({ id: 'a', x: 0, y: 0, width: 2, depth: 2 }),
      createBin({ id: 'b', x: 5, y: 3, width: 3, depth: 2 }),
    ];
    const bounds = getSelectionBounds(bins);
    // minX=0, minY=0, maxX=5+3=8, maxY=3+2=5
    expect(bounds).toEqual({ x: 0, y: 0, width: 8, depth: 5 });
  });

  it('handles bins in a row (same y)', () => {
    const bins = [
      createBin({ id: 'a', x: 0, y: 2, width: 1, depth: 1 }),
      createBin({ id: 'b', x: 3, y: 2, width: 1, depth: 1 }),
      createBin({ id: 'c', x: 6, y: 2, width: 1, depth: 1 }),
    ];
    const bounds = getSelectionBounds(bins);
    expect(bounds).toEqual({ x: 0, y: 2, width: 7, depth: 1 });
  });

  it('handles overlapping bins', () => {
    const bins = [
      createBin({ id: 'a', x: 0, y: 0, width: 3, depth: 3 }),
      createBin({ id: 'b', x: 1, y: 1, width: 3, depth: 3 }),
    ];
    const bounds = getSelectionBounds(bins);
    // minX=0, minY=0, maxX=1+3=4, maxY=1+3=4
    expect(bounds).toEqual({ x: 0, y: 0, width: 4, depth: 4 });
  });
});

describe('constrainGroupDelta', () => {
  const drawer = { width: 10, depth: 10 };

  it('returns zero delta for empty bins', () => {
    const result = constrainGroupDelta([], 5, 5, drawer);
    expect(result).toEqual({ deltaX: 0, deltaY: 0 });
  });

  it('allows movement within bounds', () => {
    const bins = [createBin({ x: 2, y: 2, width: 2, depth: 2 })];
    const result = constrainGroupDelta(bins, 3, 3, drawer);
    expect(result).toEqual({ deltaX: 3, deltaY: 3 });
  });

  it('constrains movement to right edge', () => {
    // Bin at x=7, width=2, maxX=9, drawer.width=10
    // Can only move right by 1 (10-9=1)
    const bins = [createBin({ x: 7, y: 0, width: 2, depth: 1 })];
    const result = constrainGroupDelta(bins, 5, 0, drawer);
    expect(result).toEqual({ deltaX: 1, deltaY: 0 });
  });

  it('constrains movement to left edge', () => {
    // Bin at x=2, can only move left by 2
    const bins = [createBin({ x: 2, y: 0, width: 1, depth: 1 })];
    const result = constrainGroupDelta(bins, -5, 0, drawer);
    expect(result).toEqual({ deltaX: -2, deltaY: 0 });
  });

  it('constrains movement to top edge', () => {
    // Bin at y=6, depth=3, maxY=9, drawer.depth=10
    // Can only move up by 1
    const bins = [createBin({ x: 0, y: 6, width: 1, depth: 3 })];
    const result = constrainGroupDelta(bins, 0, 5, drawer);
    expect(result).toEqual({ deltaX: 0, deltaY: 1 });
  });

  it('constrains movement to bottom edge', () => {
    // Bin at y=3, can only move down by 3
    const bins = [createBin({ x: 0, y: 3, width: 1, depth: 1 })];
    const result = constrainGroupDelta(bins, 0, -5, drawer);
    expect(result).toEqual({ deltaX: 0, deltaY: -3 });
  });

  it('constrains group based on bounding box, not individual bins', () => {
    // Two bins: one at x=0, one at x=7 (width 2)
    // Group spans x=0 to x=9, can only move right by 1
    const bins = [
      createBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 }),
      createBin({ id: 'b', x: 7, y: 0, width: 2, depth: 1 }),
    ];
    const result = constrainGroupDelta(bins, 5, 0, drawer);
    expect(result).toEqual({ deltaX: 1, deltaY: 0 });
  });

  it('constrains diagonally', () => {
    // Bin at (7, 7), size 2x2, in 10x10 drawer
    // Can move right by 1, up by 1
    const bins = [createBin({ x: 7, y: 7, width: 2, depth: 2 })];
    const result = constrainGroupDelta(bins, 5, 5, drawer);
    expect(result).toEqual({ deltaX: 1, deltaY: 1 });
  });

  it('preserves arrangement when group hits edge', () => {
    // Two bins 3 units apart horizontally
    // After constraint, they should still be 3 units apart
    const bins = [
      createBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 }),
      createBin({ id: 'b', x: 3, y: 0, width: 1, depth: 1 }),
    ];
    // Try to move right by 10 (way past edge)
    const result = constrainGroupDelta(bins, 10, 0, drawer);
    // Max right movement: drawer.width(10) - maxX(4) = 6
    expect(result).toEqual({ deltaX: 6, deltaY: 0 });

    // Verify both bins would maintain relative position
    const newPositions = applyGroupDelta(bins, result.deltaX, result.deltaY);
    const posA = newPositions.get('a')!;
    const posB = newPositions.get('b')!;
    expect(posB.x - posA.x).toBe(3); // Still 3 apart
  });
});

describe('applyGroupDelta', () => {
  it('returns empty map for empty bins', () => {
    const result = applyGroupDelta([], 5, 5);
    expect(result.size).toBe(0);
  });

  it('applies delta to single bin', () => {
    const bins = [createBin({ id: 'a', x: 2, y: 3 })];
    const result = applyGroupDelta(bins, 5, -2);
    expect(result.get('a')).toEqual({ x: 7, y: 1 });
  });

  it('applies uniform delta to all bins', () => {
    const bins = [
      createBin({ id: 'a', x: 0, y: 0 }),
      createBin({ id: 'b', x: 5, y: 3 }),
      createBin({ id: 'c', x: 2, y: 7 }),
    ];
    const result = applyGroupDelta(bins, 2, 1);

    expect(result.get('a')).toEqual({ x: 2, y: 1 });
    expect(result.get('b')).toEqual({ x: 7, y: 4 });
    expect(result.get('c')).toEqual({ x: 4, y: 8 });
  });

  it('preserves relative positions', () => {
    const bins = [
      createBin({ id: 'a', x: 1, y: 2 }),
      createBin({ id: 'b', x: 4, y: 5 }),
    ];
    const result = applyGroupDelta(bins, 3, 2);

    const posA = result.get('a')!;
    const posB = result.get('b')!;

    // Original relative position: b is 3 right and 3 up from a
    // After move, should still be 3 right and 3 up
    expect(posB.x - posA.x).toBe(3);
    expect(posB.y - posA.y).toBe(3);
  });

  it('handles negative deltas', () => {
    const bins = [createBin({ id: 'a', x: 5, y: 5 })];
    const result = applyGroupDelta(bins, -3, -2);
    expect(result.get('a')).toEqual({ x: 2, y: 3 });
  });

  it('handles zero delta', () => {
    const bins = [createBin({ id: 'a', x: 5, y: 5 })];
    const result = applyGroupDelta(bins, 0, 0);
    expect(result.get('a')).toEqual({ x: 5, y: 5 });
  });
});

describe('integration: constrainGroupDelta + applyGroupDelta', () => {
  const drawer = { width: 10, depth: 10 };

  it('preserves arrangement when dragging group to edge', () => {
    // L-shaped group of bins
    const bins = [
      createBin({ id: 'a', x: 0, y: 0, width: 2, depth: 2 }),
      createBin({ id: 'b', x: 2, y: 0, width: 2, depth: 1 }),
      createBin({ id: 'c', x: 0, y: 2, width: 1, depth: 2 }),
    ];

    // Try to move far right and up
    const { deltaX, deltaY } = constrainGroupDelta(bins, 100, 100, drawer);
    const positions = applyGroupDelta(bins, deltaX, deltaY);

    // Calculate expected final positions
    // Group bounds: x=0..4, y=0..4, so can move right by 6 and up by 6
    expect(deltaX).toBe(6);
    expect(deltaY).toBe(6);

    // Verify all bins moved by same amount
    expect(positions.get('a')).toEqual({ x: 6, y: 6 });
    expect(positions.get('b')).toEqual({ x: 8, y: 6 });
    expect(positions.get('c')).toEqual({ x: 6, y: 8 });

    // Verify relative positions preserved
    const posA = positions.get('a')!;
    const posB = positions.get('b')!;
    const posC = positions.get('c')!;

    // b should still be 2 right of a
    expect(posB.x - posA.x).toBe(2);
    expect(posB.y - posA.y).toBe(0);

    // c should still be 2 above a
    expect(posC.x - posA.x).toBe(0);
    expect(posC.y - posA.y).toBe(2);
  });

  it('no bins can go out of bounds', () => {
    // Bins at various positions
    const bins = [
      createBin({ id: 'a', x: 1, y: 1, width: 2, depth: 2 }),
      createBin({ id: 'b', x: 5, y: 0, width: 3, depth: 3 }),
    ];

    // Try to move in each direction
    const directions = [
      { dx: 100, dy: 0 },   // right
      { dx: -100, dy: 0 },  // left
      { dx: 0, dy: 100 },   // up
      { dx: 0, dy: -100 },  // down
      { dx: 100, dy: 100 }, // diagonal
    ];

    for (const { dx, dy } of directions) {
      const { deltaX, deltaY } = constrainGroupDelta(bins, dx, dy, drawer);
      const positions = applyGroupDelta(bins, deltaX, deltaY);

      // Check all bins are within bounds
      for (const bin of bins) {
        const pos = positions.get(bin.id)!;
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.x + bin.width).toBeLessThanOrEqual(drawer.width);
        expect(pos.y + bin.depth).toBeLessThanOrEqual(drawer.depth);
      }
    }
  });
});
