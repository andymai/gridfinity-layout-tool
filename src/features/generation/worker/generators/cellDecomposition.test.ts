import { describe, it, expect } from 'vitest';
import {
  decomposeCells,
  decomposeHalfCells,
  forEachCell,
  frameCells,
  computeCellBoundariesMm,
  marginPocketDepthMm,
} from './cellDecomposition';
import type { CellInfo } from './cellDecomposition';
import { SIZE } from './generatorConstants';

describe('decomposeCells', () => {
  it('decomposes 2.0 into [1, 1]', () => {
    expect(decomposeCells(2.0)).toEqual([1, 1]);
  });

  it('decomposes 1.5 into [1, 0.5]', () => {
    expect(decomposeCells(1.5)).toEqual([1, 0.5]);
  });

  it('decomposes 0.5 into [0.5]', () => {
    expect(decomposeCells(0.5)).toEqual([0.5]);
  });

  it('decomposes 3.0 into [1, 1, 1]', () => {
    expect(decomposeCells(3.0)).toEqual([1, 1, 1]);
  });

  it('decomposes 1.0 into [1]', () => {
    expect(decomposeCells(1.0)).toEqual([1]);
  });

  it('snaps fractional remainders to 0.5 by default (legacy behavior)', () => {
    expect(decomposeCells(1.7)).toEqual([1, 0.5]);
    expect(decomposeCells(4.3)).toEqual([1, 1, 1, 1]);
  });
});

describe('decomposeCells (fractional mode)', () => {
  it('emits the exact trailing remainder instead of snapping to 0.5', () => {
    expect(decomposeCells(1.7, { fractional: true })).toEqual([1, 0.7]);
    const [a, b, c, d, frac] = decomposeCells(4.3, { fractional: true });
    expect([a, b, c, d]).toEqual([1, 1, 1, 1]);
    expect(frac).toBeCloseTo(0.3, 10);
  });

  it('emits only full cells for an integer dimension', () => {
    expect(decomposeCells(3.0, { fractional: true })).toEqual([1, 1, 1]);
  });

  it('emits a sub-half remainder as its own cell', () => {
    // 2.2 -> [1, 1, 0.2]
    const cells = decomposeCells(2.2, { fractional: true });
    expect(cells).toHaveLength(3);
    expect(cells[0]).toBe(1);
    expect(cells[1]).toBe(1);
    expect(cells[2]).toBeCloseTo(0.2, 10);
  });

  it('drops a remainder below minFractionUnits (flat-strip / padding-fallback rule)', () => {
    // 2.05 with a 0.2u floor -> the 0.05 sliver is dropped
    expect(decomposeCells(2.05, { fractional: true, minFractionUnits: 0.2 })).toEqual([1, 1]);
    // a remainder at or above the floor is kept
    expect(decomposeCells(2.3, { fractional: true, minFractionUnits: 0.2 })[2]).toBeCloseTo(
      0.3,
      10
    );
  });

  it('drops a near-zero floating remainder', () => {
    expect(decomposeCells(3 + 1e-12, { fractional: true })).toEqual([1, 1, 1]);
  });
});

describe('decomposeHalfCells', () => {
  it('decomposes 2.0 into [0.5, 0.5, 0.5, 0.5]', () => {
    expect(decomposeHalfCells(2.0)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('decomposes 1.5 into [0.5, 0.5, 0.5]', () => {
    expect(decomposeHalfCells(1.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('decomposes 0.5 into [0.5]', () => {
    expect(decomposeHalfCells(0.5)).toEqual([0.5]);
  });

  it('decomposes 1.0 into [0.5, 0.5]', () => {
    expect(decomposeHalfCells(1.0)).toEqual([0.5, 0.5]);
  });
});

describe('forEachCell', () => {
  it('iterates over a 2x2 grid with 4 full cells', () => {
    const cells: CellInfo[] = [];
    forEachCell(2, 2, (cell) => cells.push(cell));

    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.widthUnits).toBe(1);
      expect(cell.depthUnits).toBe(1);
    }
  });

  it('iterates over a 1.5x1 grid with 2 cells (1 full + 1 half)', () => {
    const cells: CellInfo[] = [];
    forEachCell(1.5, 1, (cell) => cells.push(cell));

    expect(cells).toHaveLength(2);
    expect(cells[0].widthUnits).toBe(1);
    expect(cells[1].widthUnits).toBe(0.5);
  });

  it('iterates over a 1x1 grid in half-sockets mode with 4 cells', () => {
    const cells: CellInfo[] = [];
    forEachCell(1, 1, (cell) => cells.push(cell), true);

    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.widthUnits).toBe(0.5);
      expect(cell.depthUnits).toBe(0.5);
    }
  });

  it('computes cell centers relative to bin center', () => {
    const cells: CellInfo[] = [];
    forEachCell(2, 1, (cell) => cells.push(cell));

    // 2x1 grid: two full cells side by side
    // Total width = 2 * 42 = 84mm, each cell center offset from bin center
    expect(cells).toHaveLength(2);
    expect(cells[0].centerX).toBe(-SIZE / 2);
    expect(cells[1].centerX).toBe(SIZE / 2);
    expect(cells[0].centerY).toBe(0);
    expect(cells[1].centerY).toBe(0);
  });

  it('handles 0.5x0.5 grid with single half-cell', () => {
    const cells: CellInfo[] = [];
    forEachCell(0.5, 0.5, (cell) => cells.push(cell));

    expect(cells).toHaveLength(1);
    expect(cells[0].widthUnits).toBe(0.5);
    expect(cells[0].depthUnits).toBe(0.5);
    expect(cells[0].centerX).toBe(0);
    expect(cells[0].centerY).toBe(0);
  });

  it('uses custom gridUnitMm for position calculations', () => {
    const cells: CellInfo[] = [];
    forEachCell(2, 1, (cell) => cells.push(cell), { gridUnitMm: 50 });

    expect(cells).toHaveLength(2);
    // 2 cells x 50mm = 100mm total width, centers at +/-25mm
    expect(cells[0].centerX).toBe(-25);
    expect(cells[1].centerX).toBe(25);
    expect(cells[0].centerY).toBe(0);
  });

  it('emits an exact fractional edge cell in fractional mode', () => {
    const cells: CellInfo[] = [];
    forEachCell(2.3, 1, (cell) => cells.push(cell), { fractional: true });

    // 2.3u -> [1, 1, 0.3]
    expect(cells).toHaveLength(3);
    expect(cells[0].widthUnits).toBe(1);
    expect(cells[1].widthUnits).toBe(1);
    expect(cells[2].widthUnits).toBeCloseTo(0.3, 10);
    // Fractional cell sits on the positive-X edge by default
    const totalW = 2.3 * SIZE;
    expect(cells[2].centerX).toBeCloseTo(totalW / 2 - (0.3 * SIZE) / 2, 6);
  });

  it('places the fractional edge cell on the negative side with fractionalEdgeX=start', () => {
    const cells: CellInfo[] = [];
    forEachCell(2.3, 1, (cell) => cells.push(cell), {
      fractional: true,
      fractionalEdgeX: 'start',
    });

    expect(cells).toHaveLength(3);
    expect(cells[0].widthUnits).toBeCloseTo(0.3, 10);
    const totalW = 2.3 * SIZE;
    expect(cells[0].centerX).toBeCloseTo(-totalW / 2 + (0.3 * SIZE) / 2, 6);
  });

  it('drops a sub-threshold fractional edge cell', () => {
    const cells: CellInfo[] = [];
    forEachCell(2.05, 1, (cell) => cells.push(cell), {
      fractional: true,
      minFractionUnits: 0.2,
    });

    // 0.05 sliver dropped -> only the two full cells remain
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c.widthUnits === 1)).toBe(true);
  });
});

describe('computeCellBoundariesMm', () => {
  it('returns empty array for a single-cell axis', () => {
    expect(computeCellBoundariesMm(1, 42)).toEqual([]);
    expect(computeCellBoundariesMm(0.5, 42)).toEqual([]);
  });

  it('integer axis: boundaries are evenly spaced regardless of fractional edge', () => {
    // depth=5 → cells [1,1,1,1,1]. Boundaries at 42, 84, 126, 168 (mm from start).
    // Centered at totalMm/2 = 105 → -63, -21, 21, 63.
    expect(computeCellBoundariesMm(5, 42, 'end')).toEqual([-63, -21, 21, 63]);
    expect(computeCellBoundariesMm(5, 42, 'start')).toEqual([-63, -21, 21, 63]);
  });

  it('fractional axis, end-side: full cells precede half cell', () => {
    // depth=4.5 → cells [1,1,1,1,0.5]. Boundaries at 42, 84, 126, 168 (mm from start).
    // Centered at totalMm/2 = 94.5 → -52.5, -10.5, 31.5, 73.5.
    expect(computeCellBoundariesMm(4.5, 42, 'end')).toEqual([-52.5, -10.5, 31.5, 73.5]);
  });

  it('fractional axis, start-side: half cell precedes full cells, shifts boundaries by -gridUnit/2', () => {
    // depth=4.5 → cells reversed to [0.5,1,1,1,1]. Boundaries at 21, 63, 105, 147.
    // Centered at 94.5 → -73.5, -31.5, 10.5, 52.5.
    expect(computeCellBoundariesMm(4.5, 42, 'start')).toEqual([-73.5, -31.5, 10.5, 52.5]);
  });

  it('honors custom gridUnitMm', () => {
    // depth=2.5, grid=50 → cells [1,1,0.5] frac=end. Boundaries at 50, 100.
    // Centered at 62.5 → -12.5, 37.5.
    expect(computeCellBoundariesMm(2.5, 50, 'end')).toEqual([-12.5, 37.5]);
  });
});

describe('frameCells', () => {
  const NONE = { left: 0, right: 0, front: 0, back: 0 };

  it('returns no cells when there are no margins', () => {
    expect(frameCells(3, 2, NONE, 42, 8)).toEqual([]);
  });

  it('builds a full frame around the grid when all margins clear the threshold', () => {
    // 2×2 grid, 12mm margins all sides: axes are [margin,1,1,margin] each →
    // 4×4 product minus the 2×2 nominal interior = 12 frame cells.
    const cells = frameCells(2, 2, { left: 12, right: 12, front: 12, back: 12 }, 42, 8);
    expect(cells).toHaveLength(12);
    // Margin strip cell width = 12/42 units; left strip sits beyond the grid
    // edge at -(2*42)/2 = -42.
    const left = cells.find((c) => c.centerX < -42);
    expect(left?.widthUnits).toBeCloseTo(12 / 42, 6);
  });

  it('drops a sub-threshold margin (per-side)', () => {
    // Left 12mm (kept), right 3mm (dropped) → only the left strip + its corners.
    const cells = frameCells(2, 2, { left: 12, right: 3, front: 0, back: 0 }, 42, 8);
    // Only the left strip subdivided per nominal row (2 cells), no right/corners.
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c.centerX < 0)).toBe(true);
  });

  it('places margin strips outboard of the nominal grid', () => {
    const cells = frameCells(2, 2, { left: 0, right: 0, front: 0, back: 12 }, 42, 8);
    // Back (+Y) strip only: 2 cells (one per nominal column), beyond +Y grid edge.
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c.centerY > 42)).toBe(true);
  });
});

describe('frameCells half-grid', () => {
  const ONLY_LEFT = (mm: number) => ({ left: mm, right: 0, front: 0, back: 0 });

  it('packs a true 0.5-unit half-cell then the sub-half remainder', () => {
    // 30mm left margin on a 2×2 grid: 21mm half-cell + 9mm leftover, each
    // subdivided per nominal row → 2 half-cells + 2 remainder strips.
    const cells = frameCells(2, 2, ONLY_LEFT(30), 42, 8, true);
    expect(cells).toHaveLength(4);
    const halves = cells.filter((c) => Math.abs(c.widthUnits - 0.5) < 1e-9);
    const remainders = cells.filter((c) => Math.abs(c.widthUnits - 9 / 42) < 1e-9);
    expect(halves).toHaveLength(2);
    expect(remainders).toHaveLength(2);
    // Half-cells hug the grid edge (-42); the remainder sits further out.
    expect(halves.every((h) => h.centerX > remainders[0].centerX)).toBe(true);
    expect(halves.every((h) => h.centerX < -42)).toBe(true);
  });

  it('emits a clean half-cell with no remainder at exactly half a unit', () => {
    const cells = frameCells(1, 1, ONLY_LEFT(21), 42, 8, true);
    expect(cells).toHaveLength(1);
    expect(cells[0].widthUnits).toBeCloseTo(0.5, 9);
  });

  it('stacks multiple half-cells across a wide margin', () => {
    // 50mm: two 21mm half-cells + an 8mm remainder.
    const cells = frameCells(1, 1, ONLY_LEFT(50), 42, 8, true);
    expect(cells.filter((c) => Math.abs(c.widthUnits - 0.5) < 1e-9)).toHaveLength(2);
    expect(cells.filter((c) => Math.abs(c.widthUnits - 8 / 42) < 1e-9)).toHaveLength(1);
  });

  it('falls back to a single clip when the margin is under half a unit', () => {
    // 15mm < 21mm: no half-cell fits, so it degrades to the over-tile clip.
    const half = frameCells(1, 1, ONLY_LEFT(15), 42, 8, true);
    const over = frameCells(1, 1, ONLY_LEFT(15), 42, 8, false);
    expect(half).toEqual(over);
    expect(half[0].widthUnits).toBeCloseTo(15 / 42, 9);
  });

  it('places a 0.5×0.5 corner cell when both axes have a half-cell', () => {
    const cells = frameCells(2, 2, { left: 21, right: 0, front: 21, back: 0 }, 42, 8, true);
    const corner = cells.filter(
      (c) => Math.abs(c.widthUnits - 0.5) < 1e-9 && Math.abs(c.depthUnits - 0.5) < 1e-9
    );
    expect(corner).toHaveLength(1);
    expect(corner[0].centerX).toBeLessThan(-42);
    expect(corner[0].centerY).toBeLessThan(-42);
  });
});

describe('marginPocketDepthMm', () => {
  it('over-tile: whole margin is pocketed once it clears the threshold, else solid', () => {
    expect(marginPocketDepthMm(12, 42, 8, false)).toBeCloseTo(12, 9);
    expect(marginPocketDepthMm(5, 42, 8, false)).toBe(0);
    expect(marginPocketDepthMm(0, 42, 8, false)).toBe(0);
  });

  it('half-grid: packs 21mm cells, drops a sub-threshold sliver', () => {
    // 25mm -> one 21mm cell pocketed, 4mm sliver solid.
    expect(marginPocketDepthMm(25, 42, 8, true)).toBeCloseTo(21, 9);
    // 30mm -> 21mm cell + printable 9mm clip, fully pocketed.
    expect(marginPocketDepthMm(30, 42, 8, true)).toBeCloseTo(30, 9);
    // Exactly 21mm -> one clean half-cell, no sliver.
    expect(marginPocketDepthMm(21, 42, 8, true)).toBeCloseTo(21, 9);
    // 50mm -> two 21mm cells + 8mm clip, fully pocketed.
    expect(marginPocketDepthMm(50, 42, 8, true)).toBeCloseTo(50, 9);
    // 15mm (< 21) -> degrades to a single printable clip, fully pocketed.
    expect(marginPocketDepthMm(15, 42, 8, true)).toBeCloseTo(15, 9);
  });

  it('agrees with frameCells on which margins leave a solid sliver', () => {
    // Pocket depth < padding exactly when frameCells leaves a dropped sliver.
    for (const p of [5, 12, 21, 25, 30, 46, 50]) {
      const depth = marginPocketDepthMm(p, 42, 8, true);
      const cells = frameCells(1, 1, { left: p, right: 0, front: 0, back: 0 }, 42, 8, true);
      const pocketedMm = cells.reduce((sum, c) => sum + c.widthUnits * 42, 0);
      expect(depth).toBeCloseTo(pocketedMm, 6);
    }
  });
});
