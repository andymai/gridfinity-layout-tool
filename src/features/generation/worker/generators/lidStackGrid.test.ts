import { describe, it, expect } from 'vitest';
import { isLidCellFilled, type LidCellGrid } from './lidStackGrid';
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
