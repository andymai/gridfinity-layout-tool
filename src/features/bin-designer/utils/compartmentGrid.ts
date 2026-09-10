import type { CompartmentConfig } from '../types';

/** Get the compartment ID for a cell at (col, row) */
export function getCellId(config: CompartmentConfig, col: number, row: number): number {
  return config.cells[row * config.cols + col];
}

/** Get the flat index for a cell at (col, row) */
export function cellIndex(cols: number, col: number, row: number): number {
  return row * cols + col;
}

/** Get all unique compartment IDs in the grid */
export function getCompartmentIds(config: CompartmentConfig): number[] {
  return [...new Set(config.cells)].sort((a, b) => a - b);
}

/**
 * Compartment IDs in visual reading order: top-left first, then left-to-right
 * and top-to-bottom — the order a user's eye scans when labeling.
 *
 * IDs are assigned in data-row order, but the 2D grid renders `flex-col-reverse`
 * so data row 0 is the visual BOTTOM. Numeric `getCompartmentIds` therefore
 * counts up from the bottom-left, which reads backwards. Here we anchor
 * each compartment at its visual top-left cell (highest data row = `maxRow`,
 * then leftmost `minCol`) and sort by that.
 *
 * Display-only: the "Comp. N" numbering on cells, the below-grid field, and the
 * bulk list all consume this so they stay in lockstep. Validation and general
 * iteration keep the cheaper numeric `getCompartmentIds`.
 */
export function getCompartmentReadingOrder(config: CompartmentConfig): number[] {
  const entries = getCompartmentIds(config).map((id) => {
    const bounds = getCompartmentBounds(config, id);
    return { id, top: bounds ? bounds.maxRow : -1, left: bounds ? bounds.minCol : id };
  });
  entries.sort((a, b) => (a.top !== b.top ? b.top - a.top : a.left - b.left));
  return entries.map((e) => e.id);
}

/** Get all cell indices belonging to a compartment */
export function getCellsForCompartment(config: CompartmentConfig, compartmentId: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < config.cells.length; i++) {
    if (config.cells[i] === compartmentId) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Get the bounding rectangle of a compartment in grid coordinates.
 * Returns { minCol, maxCol, minRow, maxRow } (inclusive).
 */
export function getCompartmentBounds(
  config: CompartmentConfig,
  compartmentId: number
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  let minCol = config.cols;
  let maxCol = -1;
  let minRow = config.rows;
  let maxRow = -1;

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      if (getCellId(config, col, row) === compartmentId) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  if (maxCol === -1) return null;
  return { minCol, maxCol, minRow, maxRow };
}

/** Get the number of distinct compartments */
export function getCompartmentCount(config: CompartmentConfig): number {
  return new Set(config.cells).size;
}

/**
 * Check whether a set of cells forms a valid rectangle.
 * All cells must be contiguous and fill a rectangular region.
 */
export function isRectangularSelection(
  cols: number,
  cellIndices: number[] | readonly number[]
): boolean {
  if (cellIndices.length === 0) return false;
  if (cellIndices.length === 1) return true;

  // Compute bounding box
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;

  for (const idx of cellIndices) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }

  // The selection must fill the entire bounding box
  const expectedCount = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  if (cellIndices.length !== expectedCount) return false;

  // Verify all cells in the bounding box are in the selection
  const indexSet = new Set(cellIndices);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!indexSet.has(row * cols + col)) return false;
    }
  }

  return true;
}

/**
 * Whether a compartment fills its own bounding box.
 *
 * Non-rectangular compartments (an L, U or S built by merging) are valid
 * geometry — the wall builder only reads ID boundaries — but every feature
 * that positions itself from `getCompartmentBounds` would land in the notch.
 * Those features gate on this.
 */
export function isRectangularCompartment(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  return isRectangularSelection(config.cols, getCellsForCompartment(config, compartmentId));
}
