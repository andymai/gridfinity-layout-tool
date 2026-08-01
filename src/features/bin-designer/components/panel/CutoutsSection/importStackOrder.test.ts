import { describe, it, expect } from 'vitest';
import { byDescendingArea } from './importStackOrder';

const spec = (id: string, width: number, depth: number) => ({ id, width, depth });

describe('byDescendingArea', () => {
  it('puts the largest shape first so it lands at the bottom of the stack', () => {
    // An SVG that draws its enclosing outline last: document order would give
    // that outline the top layer and bury everything it encloses (#3073).
    const order = byDescendingArea([
      spec('small', 5, 5),
      spec('medium', 20, 10),
      spec('outline', 100, 80),
    ]);
    expect(order.map((s) => s.id)).toEqual(['outline', 'medium', 'small']);
  });

  it('compares bounding-box area, matching the renderer stacking key', () => {
    // A 10x1 sliver (area 10) outranks a 3x3 square (area 9) and so is added
    // first — area decides, not the longest axis.
    const order = byDescendingArea([spec('square', 3, 3), spec('sliver', 10, 1)]);
    expect(order.map((s) => s.id)).toEqual(['sliver', 'square']);
  });

  it('keeps document order among equal areas', () => {
    const order = byDescendingArea([spec('a', 4, 4), spec('b', 2, 8), spec('c', 8, 2)]);
    expect(order.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const specs = [spec('small', 1, 1), spec('big', 9, 9)];
    byDescendingArea(specs);
    expect(specs.map((s) => s.id)).toEqual(['small', 'big']);
  });

  it('handles an empty import', () => {
    expect(byDescendingArea([])).toEqual([]);
  });
});
