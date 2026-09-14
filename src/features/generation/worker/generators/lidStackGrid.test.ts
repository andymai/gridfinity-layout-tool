import { describe, it, expect } from 'vitest';
import {
  collectJunctions,
  collectTJunctions,
  isLidCellFilled,
  type LidCellGrid,
} from './lidStackGrid';
import { buildFullMask, type CellMask } from '@/shared/utils/cellMask';
import type { CellInfo } from './cellDecomposition';

const GRID = 42;

function grid(cellsX: number, cellsY: number, cellMask?: CellMask): LidCellGrid {
  return { cellsX, cellsY, gridUnitMm: GRID, gridUnitMmY: GRID, cellMask };
}

/** Cell at `leftUnit`/`bottomUnit` of a `cellsX × cellsY` footprint, origin-centred. */
function cellAt(
  leftUnit: number,
  bottomUnit: number,
  widthUnits: number,
  depthUnits: number,
  cellsX: number,
  cellsY: number
): CellInfo {
  return {
    widthUnits,
    depthUnits,
    centerX: (leftUnit + widthUnits / 2) * GRID - (cellsX * GRID) / 2,
    centerY: (bottomUnit + depthUnits / 2) * GRID - (cellsY * GRID) / 2,
  };
}

function clear(mask: CellMask, col: number, row: number): CellMask {
  const cells = [...mask.cells];
  cells[row * mask.cols + col] = 0;
  return { ...mask, cells };
}

describe('isLidCellFilled', () => {
  it('accepts every cell when the lid carries no mask', () => {
    expect(isLidCellFilled(grid(1.5, 1), cellAt(1, 0, 0.5, 1, 1.5, 1))).toBe(true);
  });

  it('accepts a filled trailing half cell (#3778)', () => {
    // Regression: a whole-cell query rounded this half cell to column index 1,
    // whose second mask column is past the 3-column mask — so a fully filled
    // fractional lid reported its own edge cell as unfilled and the pocket pass
    // left it solid.
    const mask = buildFullMask(1.5, 1);
    expect(isLidCellFilled(grid(1.5, 1, mask), cellAt(1, 0, 0.5, 1, 1.5, 1))).toBe(true);
  });

  it('rejects a half cell the mask does not cover', () => {
    const mask = clear(buildFullMask(1.5, 1), 2, 0);
    expect(isLidCellFilled(grid(1.5, 1, mask), cellAt(1, 0, 0.5, 1, 1.5, 1))).toBe(false);
  });

  it('accepts a fully covered whole cell', () => {
    const mask = buildFullMask(2, 2);
    expect(isLidCellFilled(grid(2, 2, mask), cellAt(0, 0, 1, 1, 2, 2))).toBe(true);
  });

  it('rejects a whole cell with any sub-cell clear, so nothing cuts the boundary', () => {
    const mask = clear(buildFullMask(2, 2), 1, 1);
    expect(isLidCellFilled(grid(2, 2, mask), cellAt(0, 0, 1, 1, 2, 2))).toBe(false);
    expect(isLidCellFilled(grid(2, 2, mask), cellAt(1, 1, 1, 1, 2, 2))).toBe(true);
  });
});

describe('collectJunctions', () => {
  // Cell-boundary lines for an N-cell axis centred on the origin, e.g. N=3 at
  // pitch 42 → [-63, -21, 21, 63].
  const lines = (n: number): number[] =>
    Array.from({ length: n + 1 }, (_, k) => k * GRID - (n * GRID) / 2);

  it('returns only the interior crossings, never a boundary line', () => {
    const js = collectJunctions(lines(3), lines(3));
    // 3×3 has one interior line per axis at ±21 → four interior crossings.
    expect(js).toHaveLength(4);
    expect(js).toEqual(
      expect.arrayContaining([
        [-21, -21],
        [-21, 21],
        [21, -21],
        [21, 21],
      ])
    );
    const flat = js.flat();
    // No outer boundary coordinate (±63) leaks in; that is where the ring's
    // full-height lip and its rounded corners live.
    expect(flat).not.toContain(63);
    expect(flat).not.toContain(-63);
  });

  it('drops both outer lines, so a single-column grid has no crossings', () => {
    // 1×3: the only X lines are the two outer edges, so there is no interior
    // divider to cross, so nothing to relieve, and the ring is left intact.
    expect(collectJunctions(lines(1), lines(3))).toHaveLength(0);
  });

  it('has no interior crossing on a 1×1 grid', () => {
    expect(collectJunctions(lines(1), lines(1))).toHaveLength(0);
  });

  it('deduplicates repeated corner coordinates before crossing them', () => {
    // forEachCell reports each shared boundary twice (once per adjacent cell);
    // the crossings must not multiply with the duplicates.
    const xs = [-63, -21, -21, 21, 21, 63];
    const ys = [-63, -21, -21, 21, 21, 63];
    expect(collectJunctions(xs, ys)).toHaveLength(4);
  });
});

describe('collectTJunctions', () => {
  const lines = (n: number): number[] =>
    Array.from({ length: n + 1 }, (_, k) => k * GRID - (n * GRID) / 2);

  it('returns interior-divider-meets-edge points, never a corner or crossing', () => {
    const ts = collectTJunctions(lines(3), lines(3));
    // 3×3: interior lines at ±21 meet each of the four outer edges → 8.
    expect(ts).toHaveLength(8);
    const pts = ts.map(([x, y]) => [x, y]);
    // Interior dividers meeting the front/back and left/right edges.
    expect(pts).toEqual(
      expect.arrayContaining([
        [-21, -63],
        [-21, 63],
        [21, -63],
        [21, 63],
        [-63, -21],
        [-63, 21],
        [63, -21],
        [63, 21],
      ])
    );
    // Never a ring corner (both coords on an outer line) or an interior crossing.
    for (const [x, y] of pts) {
      expect(Math.abs(x) === 63 && Math.abs(y) === 63).toBe(false);
      expect(Math.abs(x) === 21 && Math.abs(y) === 21).toBe(false);
    }
  });

  it('points the inward offset back into the grid, off the boundary line', () => {
    for (const [x, y, inX, inY] of collectTJunctions(lines(3), lines(3))) {
      // Exactly one axis carries the inward push, toward the origin.
      expect(Math.abs(inX) + Math.abs(inY)).toBe(1);
      if (inX !== 0) expect(Math.sign(inX)).toBe(x > 0 ? -1 : 1);
      if (inY !== 0) expect(Math.sign(inY)).toBe(y > 0 ? -1 : 1);
    }
  });

  it('finds the side-edge T-junctions of a single-column grid', () => {
    // 1×3: no interior X divider, but the two interior Y dividers each run into
    // both side edges → four T-junctions.
    expect(collectTJunctions(lines(1), lines(3))).toHaveLength(4);
  });

  it('has no T-junction on a 1×1 grid', () => {
    expect(collectTJunctions(lines(1), lines(1))).toHaveLength(0);
  });
});
