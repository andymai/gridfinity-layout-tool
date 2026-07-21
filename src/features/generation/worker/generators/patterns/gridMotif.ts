/**
 * Square-grid motif primitive.
 *
 * A reusable {@link MotifCell} whose unit cell is a crossing pair of struts
 * (a plus). Tiled across a panel it forms a continuous square lattice. Serves
 * as the worked example for the motif seam and as a building block future
 * complex patterns (kumiko-style lattices) can compose. Pure-math module — no
 * brepjs imports.
 */

import type { MotifCell, MotifMode, MotifPath } from './types';

/** Closed rectangle outline centered at the cell origin. */
function rectPath(width: number, height: number): MotifPath {
  const hw = width / 2;
  const hh = height / 2;
  return {
    start: [-hw, -hh],
    segments: [
      { kind: 'line', to: [hw, -hh] },
      { kind: 'line', to: [hw, hh] },
      { kind: 'line', to: [-hw, hh] },
    ],
    closed: true,
  };
}

export interface GridMotifOptions {
  /** Cell pitch (mm). */
  readonly cellSize: number;
  /** Strut thickness (mm). */
  readonly strutWidth: number;
  /**
   * `lattice` keeps the struts and opens the rest (kumiko look); `holes` cuts
   * the plus shape out of solid wall.
   */
  readonly mode: MotifMode;
}

/** Build a square-grid motif cell. */
export function createGridMotif({ cellSize, strutWidth, mode }: GridMotifOptions): MotifCell {
  if (cellSize <= 0) throw new Error('cellSize must be positive');
  if (strutWidth <= 0 || strutWidth >= cellSize) {
    throw new Error('strutWidth must be positive and smaller than cellSize');
  }
  return {
    cellW: cellSize,
    cellH: cellSize,
    rowOffset: 0,
    mode,
    boundingRadius: cellSize / 2,
    buildCellPaths: () => [rectPath(strutWidth, cellSize), rectPath(cellSize, strutWidth)],
  };
}
