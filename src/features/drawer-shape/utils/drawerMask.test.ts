import { describe, expect, it } from 'vitest';
import { gridUnits, heightUnits } from '@/core/types';
import type { Drawer } from '@/core/types';
import {
  buildFullDrawerMask,
  drawerMaskToOutline,
  editorAxisCells,
  outlineToDrawerMask,
} from './drawerMask';

const U = 42;

function drawer(width: number, depth: number, overrides: Partial<Drawer> = {}): Drawer {
  return { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(6), ...overrides };
}

function setCell(grid: ReturnType<typeof buildFullDrawerMask>, c: number, r: number, v: 0 | 1) {
  grid.cells[r * grid.cols.length + c] = v;
}

describe('editorAxisCells', () => {
  it('emits whole cells plus the fractional edge cell', () => {
    expect(editorAxisCells(3, 'end')).toHaveLength(3);
    const frac = editorAxisCells(3.5, 'end');
    expect(frac).toHaveLength(4);
    expect(frac[3]).toEqual({ start: 3, size: 0.5 });
    const fracStart = editorAxisCells(3.5, 'start');
    expect(fracStart[0]).toEqual({ start: 0, size: 0.5 });
    expect(fracStart[1]).toEqual({ start: 0.5, size: 1 });
  });
});

describe('drawerMaskToOutline', () => {
  it('converts an L-shaped grid to a drawer-local mm outline', () => {
    const grid = buildFullDrawerMask(drawer(4, 4));
    // Notch out the top-right 2×2 cells.
    setCell(grid, 2, 2, 0);
    setCell(grid, 3, 2, 0);
    setCell(grid, 2, 3, 0);
    setCell(grid, 3, 3, 0);
    const result = drawerMaskToOutline(grid, U);
    expect('outline' in result).toBe(true);
    if (!('outline' in result)) return;
    const xs = result.outline.vertices.map((v) => `${v.x},${v.y}`);
    expect(xs).toContain(`${2 * U},${2 * U}`);
    expect(result.outline.authoring).toEqual({ kind: 'cells' });
    // 6 corners for an L.
    expect(result.outline.vertices).toHaveLength(6);
  });

  it('fills enclosed holes (single-loop model)', () => {
    const grid = buildFullDrawerMask(drawer(4, 4));
    setCell(grid, 1, 1, 0);
    const result = drawerMaskToOutline(grid, U);
    expect('outline' in result).toBe(true);
    if (!('outline' in result)) return;
    // The hole vanished: outline is the plain rectangle.
    expect(result.outline.vertices).toHaveLength(4);
  });

  it('rejects empty and disconnected grids', () => {
    const empty = buildFullDrawerMask(drawer(2, 2));
    empty.cells.fill(0);
    expect(drawerMaskToOutline(empty, U)).toEqual({ error: 'empty' });

    const diag = buildFullDrawerMask(drawer(2, 2));
    diag.cells.fill(0);
    setCell(diag, 0, 0, 1);
    setCell(diag, 1, 1, 1);
    expect(drawerMaskToOutline(diag, U)).toEqual({ error: 'disconnected' });
  });

  it('handles fractional edge cells at mm precision', () => {
    const grid = buildFullDrawerMask(drawer(3.5, 2));
    // Drop the fractional edge column entirely.
    setCell(grid, 3, 0, 0);
    setCell(grid, 3, 1, 0);
    const result = drawerMaskToOutline(grid, U);
    expect('outline' in result).toBe(true);
    if (!('outline' in result)) return;
    // The outline stops at 3 units, not 3.5.
    const maxX = Math.max(...result.outline.vertices.map((v) => v.x));
    expect(maxX).toBe(3 * U);
  });
});

describe('outlineToDrawerMask round-trip', () => {
  it('rasterizes an outline back to the editor grid', () => {
    const grid = buildFullDrawerMask(drawer(4, 4));
    setCell(grid, 2, 2, 0);
    setCell(grid, 3, 2, 0);
    setCell(grid, 2, 3, 0);
    setCell(grid, 3, 3, 0);
    const result = drawerMaskToOutline(grid, U);
    if (!('outline' in result)) throw new Error('expected outline');

    const d = drawer(4, 4);
    const back = outlineToDrawerMask(result.outline, d, U);
    expect(Array.from(back.cells)).toEqual(Array.from(grid.cells));
  });
});

describe('drawer-scale masks (beyond the bin designer cap)', () => {
  it('converts a 16×16 drawer (32×32 half-cells) correctly', () => {
    const grid = buildFullDrawerMask(drawer(16, 16));
    // Notch the top-right 8×8 quadrant.
    for (let r = 8; r < 16; r++) {
      for (let c = 8; c < 16; c++) {
        setCell(grid, c, r, 0);
      }
    }
    const result = drawerMaskToOutline(grid, U);
    expect('outline' in result).toBe(true);
    if (!('outline' in result)) return;
    expect(result.outline.vertices).toHaveLength(6);
    const maxX = Math.max(...result.outline.vertices.map((v) => v.x));
    expect(maxX).toBe(16 * U);
    expect(result.outline.vertices.map((v) => `${v.x},${v.y}`)).toContain(`${8 * U},${8 * U}`);
  });
});
