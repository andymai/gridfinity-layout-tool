import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { contentBounds } from './libraryContent';
import { ghostOf, placementCentre } from './libraryPlacement';

const rect = (id: string, x: number, y: number): Cutout => ({
  id,
  shape: 'rectangle',
  x,
  y,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

describe('ghostOf', () => {
  it('centres the item on the origin and gives its size', () => {
    const ghost = ghostOf({ params: { cutouts: [rect('a', 0, 0), rect('b', 30, 20)] } });
    expect(ghost?.width).toBe(50);
    expect(ghost?.depth).toBe(30);
    expect(contentBounds(ghost?.cutouts ?? [])).toEqual({
      minX: -25,
      minY: -15,
      maxX: 25,
      maxY: 15,
    });
  });

  it('is null for an empty item', () => {
    expect(ghostOf({ params: { cutouts: [] } })).toBeNull();
  });
});

describe('placementCentre', () => {
  const board = { width: 100, depth: 80 };
  const ghost = { width: 20, depth: 10 };

  it('follows the cursor freely without a grid', () => {
    expect(placementCentre({ x: 33.3, y: 40 }, ghost, board, null)).toEqual({ x: 33.3, y: 40 });
  });

  it('puts the corner on the grid when snapping', () => {
    const at = placementCentre({ x: 33.3, y: 40.2 }, ghost, board, 5);
    expect(at.x - ghost.width / 2).toBe(25);
    expect(at.y - ghost.depth / 2).toBe(35);
  });

  it('keeps an item that fits on the board', () => {
    expect(placementCentre({ x: -50, y: 500 }, ghost, board, null)).toEqual({ x: 10, y: 75 });
  });

  it('puts an item larger than the board in its middle', () => {
    expect(placementCentre({ x: 5, y: 5 }, { width: 120, depth: 10 }, board, null).x).toBe(50);
  });
});
