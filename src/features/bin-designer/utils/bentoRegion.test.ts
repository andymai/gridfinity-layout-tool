import { describe, it, expect } from 'vitest';
import {
  cellRegionLoops,
  regionPathD,
  widestRunRect,
} from '@/features/bin-designer/utils/bentoRegion';

describe('cellRegionLoops', () => {
  it('returns nothing for an empty selection', () => {
    expect(cellRegionLoops(3, 3, [])).toEqual([]);
  });

  it('traces a rectangle as four corners', () => {
    // Top-left 2x1 of a 3x3 grid.
    const [outer, ...holes] = cellRegionLoops(3, 3, [0, 1]);
    expect(holes).toHaveLength(0);
    expect(outer).toHaveLength(4);
    const cols = outer.map((p) => p.col).sort((a, b) => a - b);
    const rows = outer.map((p) => p.row).sort((a, b) => a - b);
    expect(cols).toEqual([0, 0, 2, 2]);
    expect(rows).toEqual([0, 0, 1, 1]);
  });

  it('traces an L with its reflex corner', () => {
    const [outer] = cellRegionLoops(3, 3, [0, 1, 3]);
    // Six corners: a rectangle would have four.
    expect(outer).toHaveLength(6);
  });

  it('reports the hole a ring encloses', () => {
    // Every cell of a 3x3 except the middle — the leftover around a drawn
    // centre compartment.
    const ring = [0, 1, 2, 3, 5, 6, 7, 8];
    const loops = cellRegionLoops(3, 3, ring);
    expect(loops).toHaveLength(2);
    expect(loops[0]).toHaveLength(4);
    const hole = loops[1];
    expect(hole).toHaveLength(4);
    expect(hole.every((p) => (p.col === 1 || p.col === 2) && (p.row === 1 || p.row === 2))).toBe(
      true
    );
  });
});

describe('regionPathD', () => {
  it('emits one subpath per loop', () => {
    const loops = cellRegionLoops(3, 3, [0, 1, 2, 3, 5, 6, 7, 8]);
    const d = regionPathD(loops, ({ col, row }) => ({ x: col * 10, y: row * 10 }));
    expect(d.match(/M /g)).toHaveLength(2);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('is empty for an empty region', () => {
    expect(regionPathD([], (c) => ({ x: c.col, y: c.row }))).toBe('');
  });
});

describe('widestRunRect', () => {
  it('finds the long bar of a T', () => {
    // Row 0 full, plus one cell above the middle.
    expect(widestRunRect(3, [0, 1, 2, 4])).toEqual({ col: 0, row: 0, w: 3 });
  });

  it('ignores a gap in the same row', () => {
    // Row 0 has cells at col 0 and col 2 — two runs of one, not one run of two.
    expect(widestRunRect(3, [0, 2, 3, 4])).toEqual({ col: 0, row: 1, w: 2 });
  });

  it('returns null for nothing', () => {
    expect(widestRunRect(3, [])).toBeNull();
  });
});
