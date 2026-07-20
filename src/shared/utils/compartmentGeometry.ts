/**
 * Pure geometry for compartment grids, shared between bin-designer (authoring,
 * previews) and generation (BREP). No brepjs/Three.js dependencies.
 *
 * A grid is a cols×rows lattice of cell IDs (row-major). Cells sharing an ID
 * form a compartment; wall segments run along cell boundaries where adjacent
 * cells differ. This lives in `shared` so the generation worker can derive
 * segments without importing across feature boundaries.
 */

/** Minimal grid shape needed to derive walls (a superset of CompartmentConfig). */
export interface CompartmentGrid {
  readonly cols: number;
  readonly rows: number;
  /** Row-major cell → compartment ID, length = cols × rows. */
  readonly cells: number[];
}

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

function cellId(grid: CompartmentGrid, col: number, row: number): number {
  return grid.cells[row * grid.cols + col];
}

/**
 * Derive divider wall segments from a compartment grid.
 *
 * Scans adjacent cells and places wall segments at boundaries where neighboring
 * cells have different compartment IDs, merging consecutive segments along the
 * same grid line into longer walls. Positions are in mm over the given interior
 * (which callers pass as the overhang-expanded interior when overhang exists).
 *
 * @param grid  Compartment grid (cols, rows, cells)
 * @param innerW Interior width in mm the grid maps across
 * @param innerD Interior depth in mm the grid maps across
 */
export function deriveWallSegments(
  grid: CompartmentGrid,
  innerW: number,
  innerD: number
): WallSegment[] {
  const { cols, rows } = grid;
  // Guard malformed grids (slot configs aren't deep-validated server-side): a
  // corrupted persisted customGrid would otherwise divide by <1 or index past
  // the cells array, producing NaN/Infinity coordinates.
  if (cols < 1 || rows < 1 || grid.cells.length !== cols * rows) return [];
  if (cols <= 1 && rows <= 1) return [];

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const segments: WallSegment[] = [];

  // Vertical walls: scan each column boundary (between col i and col i+1).
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const x = colBoundary * cellW;
    let segStart: number | null = null;
    for (let row = 0; row < rows; row++) {
      const different = cellId(grid, colBoundary - 1, row) !== cellId(grid, colBoundary, row);
      if (different) {
        if (segStart === null) segStart = row;
      } else if (segStart !== null) {
        segments.push({
          x,
          y: segStart * cellD,
          length: (row - segStart) * cellD,
          orientation: 'vertical',
        });
        segStart = null;
      }
    }
    if (segStart !== null) {
      segments.push({
        x,
        y: segStart * cellD,
        length: (rows - segStart) * cellD,
        orientation: 'vertical',
      });
    }
  }

  // Horizontal walls: scan each row boundary (between row i and row i+1).
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const y = rowBoundary * cellD;
    let segStart: number | null = null;
    for (let col = 0; col < cols; col++) {
      const different = cellId(grid, col, rowBoundary - 1) !== cellId(grid, col, rowBoundary);
      if (different) {
        if (segStart === null) segStart = col;
      } else if (segStart !== null) {
        segments.push({
          x: segStart * cellW,
          y,
          length: (col - segStart) * cellW,
          orientation: 'horizontal',
        });
        segStart = null;
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
