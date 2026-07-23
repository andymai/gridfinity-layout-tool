import { describe, it, expect } from 'vitest';
import { SQUARE_SIZES, RECTANGLE_SIZES } from './paintSizes';

describe('paintSizes', () => {
  it('square sizes are ascending 1..6', () => {
    expect(SQUARE_SIZES).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rectangles keep width < depth within the square range', () => {
    for (const { w, d } of RECTANGLE_SIZES) {
      expect(w).toBeLessThan(d);
      expect(SQUARE_SIZES).toContain(w);
      expect(SQUARE_SIZES).toContain(d);
    }
  });

  it('covers every width<depth pair of the square range exactly once', () => {
    const seen = new Set(RECTANGLE_SIZES.map(({ w, d }) => `${w}x${d}`));
    expect(seen.size).toBe(RECTANGLE_SIZES.length);
    const expected = SQUARE_SIZES.flatMap((w) =>
      SQUARE_SIZES.filter((d) => d > w).map((d) => `${w}x${d}`)
    );
    expect([...seen].sort()).toEqual(expected.sort());
  });
});
