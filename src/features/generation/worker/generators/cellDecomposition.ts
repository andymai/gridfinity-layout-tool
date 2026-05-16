/**
 * Cell decomposition utilities for Gridfinity grid iteration.
 *
 * Decomposes grid dimensions into arrays of cell sizes and provides
 * iteration helpers for traversing all cells with position tracking.
 * Used by socket builders, feature builders, and baseplate generators.
 */

import { SIZE } from './generatorConstants';
/** Cell position info for iteration */
export interface CellInfo {
  /** Cell size in grid units (1 or 0.5) */
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** Cell center position in mm (relative to bin center) */
  readonly centerX: number;
  readonly centerY: number;
}

/**
 * Decompose a grid dimension (in units) into an array of cell sizes (in units).
 * Full cells are 1.0 unit; a trailing half-cell is 0.5 unit.
 *
 * Examples:
 *   2.0 -> [1, 1]
 *   1.5 -> [1, 0.5]
 *   0.5 -> [0.5]
 *   3.0 -> [1, 1, 1]
 */
export function decomposeCells(gridUnits: number): number[] {
  const fullCells = Math.floor(gridUnits);
  const hasHalf = gridUnits - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  return cells;
}

/**
 * Decompose a grid dimension into all 0.5-unit cells (half sockets mode).
 * Each 1-unit cell becomes two 0.5-unit cells; trailing half-cells stay 0.5.
 *
 * Examples:
 *   2.0 -> [0.5, 0.5, 0.5, 0.5]
 *   1.5 -> [0.5, 0.5, 0.5]
 *   0.5 -> [0.5]
 *   1.0 -> [0.5, 0.5]
 */
export function decomposeHalfCells(gridUnits: number): number[] {
  const totalHalves = Math.round(gridUnits * 2);
  return Array<number>(totalHalves).fill(0.5);
}

/**
 * Options for {@link forEachCell}.
 */
export interface ForEachCellOptions {
  /** Decompose every cell into 0.5-unit sub-cells (bin half-sockets mode). */
  readonly halfSockets?: boolean;
  /**
   * Which side the fractional (half-unit) column sits on.
   * `'end'` (default) = right/positive-X. `'start'` = left/negative-X.
   */
  readonly fractionalEdgeX?: 'start' | 'end';
  /**
   * Which side the fractional (half-unit) row sits on.
   * `'end'` (default) = back/positive-Y. `'start'` = front/negative-Y.
   */
  readonly fractionalEdgeY?: 'start' | 'end';
  /** Grid unit size in mm. Defaults to standard Gridfinity 42mm. */
  readonly gridUnitMm?: number;
}

/**
 * Iterate over all cells in a grid, calling the callback with cell info.
 * Encapsulates the common pattern of nested cell iteration with position tracking.
 *
 * When `halfSockets` is true, every cell is decomposed into 0.5-unit sub-cells,
 * so a 1x1 bin yields a 2x2 grid of 0.5x0.5 sockets.
 *
 * `fractionalEdgeX` / `fractionalEdgeY` control which side the half-unit cell
 * appears on. Default `'end'` places the half cell at the positive coordinate
 * side; `'start'` places it at the negative side.
 */
export function forEachCell(
  gridW: number,
  gridD: number,
  callback: (cell: CellInfo) => void,
  optionsOrHalfSockets: ForEachCellOptions | boolean = false
): void {
  const opts: ForEachCellOptions =
    typeof optionsOrHalfSockets === 'boolean'
      ? { halfSockets: optionsOrHalfSockets }
      : optionsOrHalfSockets;

  const decompose = opts.halfSockets ? decomposeHalfCells : decomposeCells;
  const cellsW = decompose(gridW);
  const cellsD = decompose(gridD);

  // When fractionalEdge is 'start', reverse so the half cell is first (negative side)
  if (opts.fractionalEdgeX === 'start') cellsW.reverse();
  if (opts.fractionalEdgeY === 'start') cellsD.reverse();

  const unit = opts.gridUnitMm ?? SIZE;
  const totalW_mm = gridW * unit;
  const totalD_mm = gridD * unit;

  let xOffset = 0;
  for (const cellW_units of cellsW) {
    const centerX = xOffset + (cellW_units * unit) / 2 - totalW_mm / 2;
    let yOffset = 0;

    for (const cellD_units of cellsD) {
      const centerY = yOffset + (cellD_units * unit) / 2 - totalD_mm / 2;

      callback({
        widthUnits: cellW_units,
        depthUnits: cellD_units,
        centerX,
        centerY,
      });

      yOffset += cellD_units * unit;
    }
    xOffset += cellW_units * unit;
  }
}

/**
 * Cell-center positions along an axis, in mm relative to the piece center.
 *
 * One position per cell — including a trailing half-cell — matching upstream
 * `cutter_screw_together`'s "one fastener per cell along the seam" pattern.
 * `fractionalEdge` controls which side a half-cell appears on.
 */
export function cellCentersAlong(
  units: number,
  gridUnitMm: number,
  fractionalEdge: 'start' | 'end' = 'end'
): number[] {
  const cells = decomposeCells(units);
  if (fractionalEdge === 'start') cells.reverse();
  const total = units * gridUnitMm;
  const centers: number[] = [];
  let offset = 0;
  for (const cellUnits of cells) {
    centers.push(offset + (cellUnits * gridUnitMm) / 2 - total / 2);
    offset += cellUnits * gridUnitMm;
  }
  return centers;
}
