import { describe, it, expect } from 'vitest';
import {
  decomposeCells,
  decomposeHalfCells,
  forEachCell,
  computeCellBoundariesMm,
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
