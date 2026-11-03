import { describe, it, expect } from 'vitest';
import { outerCornerHoleFilter } from './cornerHoles';
import { forEachCell } from './cellDecomposition';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './magnetPositions';

const PITCH = 42;
const RADIUS = 3.1;

function binHoles(
  width: number,
  depth: number,
  skip: (col: number, row: number) => boolean = () => false
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  forEachCell(
    width,
    depth,
    (cell) => {
      const col = Math.floor((cell.centerX + (width * PITCH) / 2) / PITCH);
      const row = Math.floor((cell.centerY + (depth * PITCH) / 2) / PITCH);
      if (skip(col, row)) return;
      if (!cellHostsAttachmentHoles(cell, RADIUS, PITCH, PITCH)) return;
      out.push(...magnetPositionsForCell(cell, RADIUS, PITCH, PITCH));
    },
    { gridUnitMm: PITCH }
  );
  return out;
}

function corners(holes: Array<[number, number]>): Array<[number, number]> {
  const keep = outerCornerHoleFilter(holes);
  return holes.filter(keep).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

describe('outerCornerHoleFilter', () => {
  it('keeps the four outermost holes of a rectangular bin', () => {
    const holes = binHoles(3, 2);
    expect(holes).toHaveLength(24);
    expect(corners(holes)).toEqual([
      [-55, -34],
      [-55, 34],
      [55, -34],
      [55, 34],
    ]);
  });

  it('keeps all four holes of a 1x1 bin', () => {
    const holes = binHoles(1, 1);
    expect(corners(holes)).toHaveLength(4);
  });

  it('keeps the five convex corners of an L-shaped bin', () => {
    const holes = binHoles(2, 2, (col, row) => col === 1 && row === 1);
    expect(holes).toHaveLength(12);
    expect(corners(holes)).toEqual([
      [-34, -34],
      [-34, 34],
      [-8, 34],
      [34, -34],
      [34, -8],
    ]);
  });

  it('keeps the two end holes of a strip whose holes line up', () => {
    const holes: Array<[number, number]> = [
      [0, -42],
      [0, -16],
      [0, 16],
      [0, 42],
    ];
    expect(corners(holes)).toEqual([
      [0, -42],
      [0, 42],
    ]);
  });

  it('keeps a single hole and a pair unchanged', () => {
    expect(corners([[1, 2]])).toEqual([[1, 2]]);
    expect(
      corners([
        [0, 0],
        [5, 0],
      ])
    ).toEqual([
      [0, 0],
      [5, 0],
    ]);
  });

  it('keeps the outer corners of a half-unit bin', () => {
    const holes = binHoles(1.5, 1.5);
    const kept = corners(holes);
    expect(kept).toHaveLength(4);
    const xs = holes.map(([x]) => x);
    const ys = holes.map(([, y]) => y);
    for (const [x, y] of kept) {
      expect([Math.min(...xs), Math.max(...xs)]).toContain(x);
      expect([Math.min(...ys), Math.max(...ys)]).toContain(y);
    }
  });

  it('treats a duplicated hole as one site', () => {
    const holes = binHoles(2, 1);
    expect(corners([...holes, ...holes])).toHaveLength(8);
    expect(holes.filter(outerCornerHoleFilter([...holes, ...holes]))).toHaveLength(4);
  });
});
