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

const FRACTION_EPS = 1e-9;

/**
 * Options for {@link decomposeCells}.
 */
export interface DecomposeOptions {
  /**
   * Emit the trailing remainder at its exact fractional size instead of
   * snapping it to a 0.5 half-cell. Used by over-tile baseplates and
   * fractional-foot bins, where the edge cell fills an arbitrary leftover
   * (e.g. a 1.7u axis decomposes to `[1, 0.7]` rather than `[1, 0.5]`).
   */
  readonly fractional?: boolean;
  /**
   * Minimum trailing-cell size, in grid units. In `fractional` mode a
   * remainder smaller than this is dropped (no cell emitted) so the caller
   * can leave that edge strip flat — the "drop foot / fall back to padding"
   * sliver rule. Defaults to emitting any positive remainder.
   */
  readonly minFractionUnits?: number;
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
 *
 * With `fractional: true` the trailing remainder is emitted at its exact size
 * (subject to `minFractionUnits`) instead of snapping to 0.5:
 *   1.7 -> [1, 0.7]
 *   4.3 -> [1, 1, 1, 1, 0.3]
 *   2.05 with minFractionUnits 0.2 -> [1, 1]   (0.05 sliver dropped)
 */
export function decomposeCells(gridUnits: number, options: DecomposeOptions = {}): number[] {
  if (options.fractional) {
    const fullCells = Math.floor(gridUnits + FRACTION_EPS);
    const remainder = gridUnits - fullCells;
    const cells: number[] = Array<number>(fullCells).fill(1);
    const minFraction = options.minFractionUnits ?? FRACTION_EPS;
    if (remainder > FRACTION_EPS && remainder >= minFraction - FRACTION_EPS) {
      cells.push(remainder);
    }
    return cells;
  }
  const fullCells = Math.floor(gridUnits);
  const hasHalf = gridUnits - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  return cells;
}

/**
 * Compute the mm-positions of inter-cell boundaries along an axis, relative to
 * the piece center (axis spans `[-axisUnits*gridUnitMm/2, +axisUnits*gridUnitMm/2]`).
 *
 * When the fractional half-cell sits at the start, every full-cell boundary
 * shifts by half a grid unit in the negative direction.
 *
 * Returns an empty array when the axis has only one cell (no interior boundaries).
 */
export function computeCellBoundariesMm(
  axisUnits: number,
  gridUnitMm: number,
  fractionalEdge: 'start' | 'end' = 'end'
): number[] {
  const cells = decomposeCells(axisUnits);
  if (fractionalEdge === 'start') cells.reverse();
  const totalMm = axisUnits * gridUnitMm;
  const offsets: number[] = [];
  let pos = 0;
  for (let i = 0; i < cells.length - 1; i++) {
    pos += cells[i] * gridUnitMm;
    offsets.push(pos - totalMm / 2);
  }
  return offsets;
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
  /**
   * Emit exact fractional trailing cells instead of snapping to 0.5
   * (over-tile baseplates, fractional-foot bins). Ignored when
   * `halfSockets` is set. See {@link DecomposeOptions.fractional}.
   */
  readonly fractional?: boolean;
  /**
   * Minimum trailing-cell size in units; smaller remainders are dropped.
   * Only consulted in `fractional` mode. See
   * {@link DecomposeOptions.minFractionUnits}.
   */
  readonly minFractionUnits?: number;
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

  const decompose = opts.halfSockets
    ? decomposeHalfCells
    : (units: number): number[] =>
        decomposeCells(units, {
          fractional: opts.fractional,
          minFractionUnits: opts.minFractionUnits,
        });
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

/** Per-side margin widths in mm around a grid (left/right = X, front/back = Y). */
export interface SideMargins {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

interface MarginAxisEntry {
  readonly units: number;
  /** Cell center in mm, origin-centered to match {@link forEachCell}. */
  readonly center: number;
  readonly margin: boolean;
}

/**
 * Decompose one margin strip into edge cells, packed from the grid-adjacent edge
 * outward. `innerEdge` is the mm-position of the strip's grid-adjacent edge and
 * `dir` is the outward direction (-1 toward negative coords, +1 toward positive).
 *
 * Default (over-tile): the whole strip is one clipped cell at its exact size.
 * `halfGrid`: pack true 0.5-unit functional half-cells from the grid edge first,
 * then a sub-half-unit remainder as a clipped cell at the outer edge (subject to
 * `minMm`). A strip narrower than `minMm` is dropped entirely (stays solid).
 */
function marginStripEntries(
  innerEdge: number,
  sizeMm: number,
  dir: -1 | 1,
  unit: number,
  minMm: number,
  halfGrid: boolean
): MarginAxisEntry[] {
  if (sizeMm < minMm) return [];
  if (!halfGrid) {
    return [{ units: sizeMm / unit, center: innerEdge + (dir * sizeMm) / 2, margin: true }];
  }
  const halfMm = unit / 2;
  const halfCount = Math.floor((sizeMm + FRACTION_EPS) / halfMm);
  const entries: MarginAxisEntry[] = [];
  for (let k = 0; k < halfCount; k++) {
    entries.push({ units: 0.5, center: innerEdge + dir * (k + 0.5) * halfMm, margin: true });
  }
  const remainder = sizeMm - halfCount * halfMm;
  if (remainder >= minMm - FRACTION_EPS) {
    const center = innerEdge + dir * (halfCount * halfMm + remainder / 2);
    entries.push({ units: remainder / unit, center, margin: true });
  }
  return entries;
}

function marginAxisEntries(
  grid: number,
  startMm: number,
  endMm: number,
  unit: number,
  minMm: number,
  halfGrid: boolean
): MarginAxisEntry[] {
  const totalNom = grid * unit;
  const entries: MarginAxisEntry[] = [];
  entries.push(...marginStripEntries(-totalNom / 2, startMm, -1, unit, minMm, halfGrid));
  let offset = 0;
  for (const s of decomposeCells(grid)) {
    entries.push({ units: s, center: offset + (s * unit) / 2 - totalNom / 2, margin: false });
    offset += s * unit;
  }
  entries.push(...marginStripEntries(totalNom / 2, endMm, 1, unit, minMm, halfGrid));
  return entries;
}

/**
 * Build the "frame" of clipped cells around a nominal grid — used to fill a
 * margin (bin overhang region, or baseplate drawer-fit padding) with
 * grid-aligned cells. Returns the 2D product of per-axis entries where at least
 * one axis is a margin strip (edge strips subdivided per nominal cell, plus
 * corners). Nominal×nominal cells are NOT included — the caller already has
 * those. A margin narrower than `minStripMm` is dropped (left flat/solid).
 *
 * Cell centers are origin-centered to match {@link forEachCell}, so frame cells
 * compose directly with the nominal grid.
 *
 * With `halfGrid`, each margin packs true 0.5-unit functional half-cells from the
 * grid edge outward before the leftover (< half a unit) falls back to a clipped
 * strip — so a wide margin reads as a half-grid border rather than one big clip.
 */
export function frameCells(
  gridW: number,
  gridD: number,
  margins: SideMargins,
  gridUnitMm: number,
  minStripMm: number,
  halfGrid = false
): CellInfo[] {
  const xs = marginAxisEntries(
    gridW,
    margins.left,
    margins.right,
    gridUnitMm,
    minStripMm,
    halfGrid
  );
  const ys = marginAxisEntries(
    gridD,
    margins.front,
    margins.back,
    gridUnitMm,
    minStripMm,
    halfGrid
  );
  const cells: CellInfo[] = [];
  for (const x of xs) {
    for (const y of ys) {
      if (!x.margin && !y.margin) continue;
      cells.push({
        widthUnits: x.units,
        depthUnits: y.units,
        centerX: x.center,
        centerY: y.center,
      });
    }
  }
  return cells;
}
