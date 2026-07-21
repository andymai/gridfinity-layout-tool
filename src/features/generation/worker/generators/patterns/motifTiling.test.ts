import { describe, it, expect } from 'vitest';
import { tileMotifCells } from './motifTiling';
import { createGridMotif } from './gridMotif';

describe('tileMotifCells', () => {
  it('tiles a centered grid within the panel bounds', () => {
    const cell = createGridMotif({ cellSize: 10, strutWidth: 1, mode: 'lattice' });
    const tiles = tileMotifCells(cell, 45, 25);
    // maxX = 45/2 - 5 = 17.5 → x ∈ {-10, 0, 10}; maxY = 25/2 - 5 = 7.5 → y = 0.
    expect(tiles.map((t) => t.x).sort((a, b) => a - b)).toEqual([-10, 0, 10]);
    expect(new Set(tiles.map((t) => t.y))).toEqual(new Set([0]));
  });

  it('returns [] when a single cell does not fit', () => {
    const cell = createGridMotif({ cellSize: 30, strutWidth: 2, mode: 'lattice' });
    expect(tileMotifCells(cell, 20, 20)).toEqual([]);
  });

  it('staggers odd rows by rowOffset', () => {
    const cell = {
      ...createGridMotif({ cellSize: 10, strutWidth: 1, mode: 'holes' }),
      rowOffset: 5,
    };
    const tiles = tileMotifCells(cell, 60, 60);
    const rows = new Map<number, number[]>();
    for (const t of tiles) rows.set(t.y, [...(rows.get(t.y) ?? []), t.x]);
    const ys = [...rows.keys()].sort((a, b) => a - b);
    // Adjacent rows should not share identical x-sets (they are staggered).
    expect(rows.get(ys[0])).not.toEqual(rows.get(ys[1]));
  });
});
