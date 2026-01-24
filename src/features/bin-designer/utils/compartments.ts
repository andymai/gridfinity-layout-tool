/**
 * Compartment grid utilities.
 *
 * Provides functions for manipulating the grid-based cell ownership model:
 * - Creating uniform grids
 * - Merging/splitting cells
 * - Validating rectangular compartment constraints
 * - Deriving divider wall segments from the cell map
 */

import type { CompartmentConfig } from '../types';

// =============================================================================
// Grid Creation
// =============================================================================

/**
 * Create a uniform compartment grid where each cell is its own compartment.
 * This is the equivalent of the old dividers system with (cols-1) x dividers
 * and (rows-1) y dividers.
 */
export function createUniformGrid(
  cols: number,
  rows: number,
  thickness: number
): CompartmentConfig {
  const cells: number[] = [];
  for (let i = 0; i < rows * cols; i++) {
    cells.push(i);
  }
  return { cols, rows, thickness, cells };
}

/**
 * Create a single-cell grid (no compartments / no dividers).
 */
export function createSingleCell(thickness: number): CompartmentConfig {
  return { cols: 1, rows: 1, thickness, cells: [0] };
}

// =============================================================================
// Cell Access Helpers
// =============================================================================

/** Get the compartment ID for a cell at (col, row) */
export function getCellId(config: CompartmentConfig, col: number, row: number): number {
  return config.cells[row * config.cols + col];
}

/** Get the flat index for a cell at (col, row) */
export function cellIndex(cols: number, col: number, row: number): number {
  return row * cols + col;
}

// =============================================================================
// Compartment Queries
// =============================================================================

/** Get all unique compartment IDs in the grid */
export function getCompartmentIds(config: CompartmentConfig): number[] {
  return [...new Set(config.cells)].sort((a, b) => a - b);
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

// =============================================================================
// Validation
// =============================================================================

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
 * Validate that all compartments in the grid form valid rectangles.
 * Returns the IDs of any invalid compartments, or empty array if all valid.
 */
export function validateCompartmentGrid(config: CompartmentConfig): number[] {
  const invalid: number[] = [];
  const ids = getCompartmentIds(config);

  for (const id of ids) {
    const cells = getCellsForCompartment(config, id);
    if (!isRectangularSelection(config.cols, cells)) {
      invalid.push(id);
    }
  }

  return invalid;
}

// =============================================================================
// Merge / Split Operations
// =============================================================================

/**
 * Merge a set of cells into a single compartment.
 * The cells must form a valid rectangle. Returns null if invalid.
 * Uses the lowest existing compartment ID from the merged cells, or
 * assigns the next available ID.
 */
export function mergeCells(
  config: CompartmentConfig,
  cellIndices: number[] | readonly number[]
): CompartmentConfig | null {
  if (!isRectangularSelection(config.cols, cellIndices)) return null;

  // Find the target compartment ID (lowest existing in selection)
  const existingIds = cellIndices.map((i) => config.cells[i]);
  const targetId = Math.min(...existingIds);

  const newCells = [...config.cells];
  for (const idx of cellIndices) {
    newCells[idx] = targetId;
  }

  return { ...config, cells: normalizeIds(newCells) };
}

/**
 * Split a compartment back into individual cells.
 * Each cell in the compartment gets its own unique ID.
 */
export function splitCompartment(
  config: CompartmentConfig,
  compartmentId: number
): CompartmentConfig {
  const newCells = [...config.cells];
  let nextId = Math.max(...newCells) + 1;

  let first = true;
  for (let i = 0; i < newCells.length; i++) {
    if (newCells[i] === compartmentId) {
      if (first) {
        // Keep the first cell with the original ID
        first = false;
      } else {
        newCells[i] = nextId++;
      }
    }
  }

  return { ...config, cells: normalizeIds(newCells) };
}

/**
 * Normalize compartment IDs to be contiguous starting from 0.
 * Preserves spatial ordering (top-left to bottom-right first occurrence).
 */
export function normalizeIds(cells: number[]): number[] {
  const idMap = new Map<number, number>();
  let nextId = 0;

  const normalized = cells.map((id) => {
    let normalizedId = idMap.get(id);
    if (normalizedId === undefined) {
      normalizedId = nextId++;
      idMap.set(id, normalizedId);
    }
    return normalizedId;
  });

  return normalized;
}

// =============================================================================
// Wall Segment Derivation
// =============================================================================

/** A horizontal or vertical wall segment in bin-interior coordinates (mm) */
export interface WallSegment {
  /** Start X position in mm from bin interior left edge */
  readonly x: number;
  /** Start Y position in mm from bin interior front edge */
  readonly y: number;
  /** Length in mm */
  readonly length: number;
  /** Wall orientation */
  readonly orientation: 'horizontal' | 'vertical';
}

/**
 * Derive divider wall segments from the compartment grid.
 *
 * Scans adjacent cells and places wall segments at boundaries where
 * neighboring cells have different compartment IDs. Merges consecutive
 * segments along the same grid line into longer walls.
 *
 * @param config - The compartment configuration
 * @param innerW - Interior width of the bin in mm
 * @param innerD - Interior depth of the bin in mm
 * @returns Array of wall segments with positions in mm
 */
export function deriveWallSegments(
  config: CompartmentConfig,
  innerW: number,
  innerD: number
): WallSegment[] {
  const { cols, rows } = config;
  if (cols <= 1 && rows <= 1) return [];

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const segments: WallSegment[] = [];

  // Vertical walls: scan each column boundary (between col i and col i+1)
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const x = colBoundary * cellW;
    // Find consecutive runs of boundaries (rows where left != right)
    let segStart: number | null = null;

    for (let row = 0; row < rows; row++) {
      const leftId = getCellId(config, colBoundary - 1, row);
      const rightId = getCellId(config, colBoundary, row);

      if (leftId !== rightId) {
        if (segStart === null) segStart = row;
      } else {
        if (segStart !== null) {
          segments.push({
            x,
            y: segStart * cellD,
            length: (row - segStart) * cellD,
            orientation: 'vertical',
          });
          segStart = null;
        }
      }
    }
    // Close any trailing segment
    if (segStart !== null) {
      segments.push({
        x,
        y: segStart * cellD,
        length: (rows - segStart) * cellD,
        orientation: 'vertical',
      });
    }
  }

  // Horizontal walls: scan each row boundary (between row i and row i+1)
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const y = rowBoundary * cellD;
    let segStart: number | null = null;

    for (let col = 0; col < cols; col++) {
      const topId = getCellId(config, col, rowBoundary - 1);
      const bottomId = getCellId(config, col, rowBoundary);

      if (topId !== bottomId) {
        if (segStart === null) segStart = col;
      } else {
        if (segStart !== null) {
          segments.push({
            x: segStart * cellW,
            y,
            length: (col - segStart) * cellW,
            orientation: 'horizontal',
          });
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push({
        x: segStart * cellW,
        y,
        length: (cols - segStart) * cellW,
        orientation: 'horizontal',
      });
    }
  }

  return segments;
}

// =============================================================================
// Migration from Legacy DividerConfig
// =============================================================================

/**
 * Convert a legacy DividerConfig (uniform X×Y grid) to CompartmentConfig.
 * A divider config with x=2, y=1 becomes a 3×2 uniform grid.
 */
export function fromDividerConfig(dividers: {
  x: number;
  y: number;
  thickness: number;
}): CompartmentConfig {
  const cols = dividers.x + 1;
  const rows = dividers.y + 1;
  return createUniformGrid(cols, rows, dividers.thickness);
}
