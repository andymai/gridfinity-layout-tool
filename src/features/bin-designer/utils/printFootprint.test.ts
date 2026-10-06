import { describe, it, expect } from 'vitest';
import type { CellMask } from '@/shared/utils/cellMask';
import { maskFootprint, rectFootprint, roundedRectArea } from './printFootprint';

function mask(cols: number, rows: number, empty: (col: number, row: number) => boolean): CellMask {
  const cells: (0 | 1)[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push(empty(col, row) ? 0 : 1);
  }
  return { cols, rows, cells };
}

describe('rectFootprint', () => {
  it('rounds a full-size outline to the radius it is given', () => {
    expect(rectFootprint(83.5, 83.5).section(0, 3.75)).toBeCloseTo(
      roundedRectArea(83.5, 83.5, 3.75),
      9
    );
  });

  it('caps the radius on a footprint too small for it', () => {
    const capped = rectFootprint(4.5, 4.5).section(0, 3.75);
    expect(capped).toBeCloseTo(roundedRectArea(4.5, 4.5, 0.4 * 4.5), 9);
    expect(capped).toBeGreaterThan(roundedRectArea(4.5, 4.5, 3.75));
    expect(rectFootprint(4.5, 4.5).cornerRadius).toBeCloseTo(0.4 * 4.5, 9);
  });
});

describe('maskFootprint', () => {
  const lShape = maskFootprint(
    mask(4, 4, (col, row) => col >= 2 && row >= 2),
    42,
    42
  );

  it('sections an L like the 1x3 rectangle with its area and perimeter', () => {
    const bar = rectFootprint(42 - 0.5, 126 - 0.5);
    for (const [inset, radius] of [
      [0, 3.75],
      [1.2, 2.55],
      [2, 1.75],
    ] as const) {
      expect(lShape.section(inset, radius)).toBeCloseTo(bar.section(inset, radius), 6);
    }
    expect(lShape.outerPerimeter).toBeCloseTo(bar.outerPerimeter, 9);
  });

  it('offers a rail run on every straight edge of the outline', () => {
    const runs = [...lShape.railEdges].map((e) => `${e.side}:${e.length}`).sort();
    expect(runs).toEqual(
      ['back:42', 'back:42', 'front:84', 'left:84', 'right:42', 'right:42'].sort()
    );
  });

  it('takes a hole out of the section, and rings it with the lip but not the lid', () => {
    const ring = maskFootprint(
      mask(6, 6, (col, row) => col >= 2 && col < 4 && row >= 2 && row < 4),
      42,
      42
    );
    const square = rectFootprint(126 - 0.5, 126 - 0.5);
    const hole = roundedRectArea(42 + 0.5, 42 + 0.5, 3.75);
    expect(ring.section(0, 3.75)).toBeCloseTo(square.section(0, 3.75) - hole, 6);
    expect(ring.outerSection(0, 3.75)).toBeCloseTo(square.section(0, 3.75), 6);
    expect(ring.lipPerimeter).toBeCloseTo(square.outerPerimeter + 4 * (42 + 0.5), 9);
    expect(ring.turning).toBe(0);
    expect(ring.polygon).toBe(true);
  });
});
