import { describe, it, expect } from 'vitest';
import { compartmentRects } from './compartmentRects';

const base = {
  widthUnits: 2,
  depthUnits: 2,
  gapCompartmentIds: [],
} as const;

describe('compartmentRects', () => {
  it('returns nothing when cells do not match the grid', () => {
    expect(compartmentRects({ ...base, cols: 2, rows: 2, cells: [0, 1, 2] })).toEqual([]);
  });

  it('maps a uniform grid to one rect per cell', () => {
    const rects = compartmentRects({ ...base, cols: 2, rows: 2, cells: [0, 1, 2, 3] });

    expect(rects).toHaveLength(4);
    expect(rects.every((r) => r.width === 1 && r.depth === 1)).toBe(true);
  });

  it('flips the vertical axis, because cells row 0 is the BOTTOM but SVG y grows down', () => {
    // Compartment 0 occupies the bottom row, 1 the top row.
    const rects = compartmentRects({ ...base, cols: 1, rows: 2, cells: [0, 1] });
    const bottom = rects.find((r) => r.id === 0);
    const top = rects.find((r) => r.id === 1);

    // Larger y means further down the screen, so the BOTTOM compartment must
    // have the larger y. Dropping the flip swaps these and the test fails.
    expect(bottom?.y).toBe(1);
    expect(top?.y).toBe(0);
  });

  it('spans a merged compartment across the cells it owns', () => {
    // Top row merged into one compartment, bottom row split in two.
    const rects = compartmentRects({ ...base, cols: 2, rows: 2, cells: [0, 1, 2, 2] });
    const merged = rects.find((r) => r.id === 2);

    expect(merged).toMatchObject({ x: 0, y: 0, width: 2, depth: 1 });
  });

  it('keeps the real footprint proportions rather than assuming square cells', () => {
    const rects = compartmentRects({
      ...base,
      widthUnits: 4,
      depthUnits: 1,
      cols: 2,
      rows: 1,
      cells: [0, 1],
    });

    expect(rects[0]).toMatchObject({ x: 0, width: 2, depth: 1 });
    expect(rects[1]).toMatchObject({ x: 2, width: 2, depth: 1 });
  });

  it('marks the compartments that came from empty space', () => {
    const rects = compartmentRects({
      ...base,
      cols: 2,
      rows: 2,
      cells: [0, 1, 2, 3],
      gapCompartmentIds: [1, 3],
    });

    expect(rects.filter((r) => r.isGap).map((r) => r.id)).toEqual([1, 3]);
  });

  it('carries each compartment its own label, indexed by id', () => {
    const rects = compartmentRects({
      ...base,
      cols: 2,
      rows: 1,
      depthUnits: 1,
      cells: [0, 1],
      compartmentTexts: ['Screws', 'Nuts'],
    });

    expect(rects.map((r) => r.label)).toEqual(['Screws', 'Nuts']);
  });

  it('leaves the label empty when there are no texts', () => {
    const rects = compartmentRects({ ...base, cols: 1, rows: 1, cells: [0] });

    expect(rects[0].label).toBe('');
  });
});
