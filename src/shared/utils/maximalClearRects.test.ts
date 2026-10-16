// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { maximalClearRects, type WallRect } from './maximalClearRects';

const BOX: WallRect = { minU: 0, maxU: 100, minZ: 0, maxZ: 50 };

describe('maximalClearRects', () => {
  it('returns the bounds when nothing is in the way', () => {
    expect(maximalClearRects(BOX, [])).toEqual([BOX]);
  });

  it('returns the four regions around a central obstacle, none inside another', () => {
    const rects = maximalClearRects(BOX, [{ minU: 40, maxU: 60, minZ: 20, maxZ: 30 }]);
    expect(rects).toHaveLength(4);
    expect(rects).toContainEqual({ minU: 0, maxU: 40, minZ: 0, maxZ: 50 });
    expect(rects).toContainEqual({ minU: 60, maxU: 100, minZ: 0, maxZ: 50 });
    expect(rects).toContainEqual({ minU: 0, maxU: 100, minZ: 0, maxZ: 20 });
    expect(rects).toContainEqual({ minU: 0, maxU: 100, minZ: 30, maxZ: 50 });
  });

  // A shelf across the top and a pad down each end: a union of the three
  // covers the whole wall, though the area under the shelf is clear.
  it('finds the region boxed in by separate obstacles', () => {
    const rects = maximalClearRects(BOX, [
      { minU: 0, maxU: 100, minZ: 35, maxZ: 50 },
      { minU: -Infinity, maxU: 10, minZ: -Infinity, maxZ: Infinity },
      { minU: 90, maxU: Infinity, minZ: -Infinity, maxZ: Infinity },
    ]);
    expect(rects).toEqual([{ minU: 10, maxU: 90, minZ: 0, maxZ: 35 }]);
  });

  it('ignores obstacles outside the bounds', () => {
    expect(maximalClearRects(BOX, [{ minU: 120, maxU: 130, minZ: 0, maxZ: 50 }])).toEqual([BOX]);
  });
});
