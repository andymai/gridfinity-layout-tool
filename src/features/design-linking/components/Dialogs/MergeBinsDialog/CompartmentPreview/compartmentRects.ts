/**
 * Turn a compartment cell grid into drawable rectangles.
 *
 * Kept apart from the component so the coordinate flip is testable on its own:
 * `cells` is row-major with row 0 at the BOTTOM (matching the layout grid's
 * origin), while SVG's y axis grows downward. Getting that backwards mirrors
 * the preview vertically, which is invisible on a symmetric layout and wrong
 * on every other one.
 */

export interface CompartmentRect {
  readonly id: number;
  /** In grid units, origin top-left, ready for an SVG viewBox. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly isGap: boolean;
  readonly label: string;
}

export interface CompartmentRectsInput {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, row 0 at the bottom. */
  readonly cells: readonly number[];
  /** Footprint in grid units, so the preview keeps the real proportions. */
  readonly widthUnits: number;
  readonly depthUnits: number;
  readonly gapCompartmentIds: readonly number[];
  readonly compartmentTexts?: readonly string[];
}

export function compartmentRects(input: CompartmentRectsInput): CompartmentRect[] {
  const { cols, rows, cells, widthUnits, depthUnits, gapCompartmentIds, compartmentTexts } = input;
  if (cols <= 0 || rows <= 0 || cells.length !== cols * rows) return [];

  const cellW = widthUnits / cols;
  const cellD = depthUnits / rows;
  const gaps = new Set(gapCompartmentIds);

  const bounds = new Map<
    number,
    { minCol: number; maxCol: number; minRow: number; maxRow: number }
  >();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      const existing = bounds.get(id);
      if (existing === undefined) {
        bounds.set(id, { minCol: col, maxCol: col, minRow: row, maxRow: row });
        continue;
      }
      existing.minCol = Math.min(existing.minCol, col);
      existing.maxCol = Math.max(existing.maxCol, col);
      existing.minRow = Math.min(existing.minRow, row);
      existing.maxRow = Math.max(existing.maxRow, row);
    }
  }

  return [...bounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, b]) => ({
      id,
      x: b.minCol * cellW,
      // Flip: the compartment's TOP row is `maxRow`, and SVG measures y from
      // the top edge, so the highest row index is the smallest y.
      y: (rows - 1 - b.maxRow) * cellD,
      width: (b.maxCol - b.minCol + 1) * cellW,
      depth: (b.maxRow - b.minRow + 1) * cellD,
      isGap: gaps.has(id),
      label: compartmentTexts?.[id] ?? '',
    }));
}
