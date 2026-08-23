/**
 * Outline of an arbitrary set of grid cells, for drawing a compartment the
 * Bento canvas can no longer describe with one rectangle: a merged L, S, T or
 * U, and the leftover region wrapping it.
 *
 * Reuses the bin-outline tracer rather than a second implementation — the
 * question is identical (union of cells to a polygon, holes included), only
 * the grid differs.
 */

import { MASK_CELL_SIZE, maskToPolygon } from '@/shared/utils/cellMask';

/** A corner in the compartment grid: 0..cols / 0..rows, not a cell index. */
export interface CellCorner {
  readonly col: number;
  readonly row: number;
}

/**
 * Loops bounding `indices`: the outer perimeter first, then one loop per
 * enclosed hole (leftover wrapping a drawn compartment has one). Empty when
 * `indices` is empty.
 *
 * Callers hand the loops to their own transform; nothing here knows about
 * pixels or the canvas's flipped rows.
 */
export function cellRegionLoops(
  cols: number,
  rows: number,
  indices: readonly number[]
): readonly (readonly CellCorner[])[] {
  if (indices.length === 0) return [];
  const cells = new Array<0 | 1>(cols * rows).fill(0);
  for (const idx of indices) {
    if (idx >= 0 && idx < cells.length) cells[idx] = 1;
  }
  return maskToPolygon({ cols, rows, cells }).map((loop) =>
    loop.map((p) => ({
      col: Math.round(p.x / MASK_CELL_SIZE),
      row: Math.round(p.y / MASK_CELL_SIZE),
    }))
  );
}

/**
 * SVG path for a region's loops. Holes come out of the same `d` — the caller
 * fills with `evenodd` so the leftover wrapping a compartment reads as a ring.
 */
export function regionPathD(
  loops: readonly (readonly CellCorner[])[],
  project: (corner: CellCorner) => { readonly x: number; readonly y: number }
): string {
  return loops
    .filter((loop) => loop.length > 0)
    .map((loop) => {
      const [first, ...rest] = loop.map(project);
      return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`;
    })
    .join(' ');
}

/**
 * Widest full-width run of cells in a region, as a rect one cell tall.
 *
 * Where to put a label on a shape that has no usable middle: the centre of an
 * L or U lands in its notch, over whatever the neighbour is.
 */
export function widestRunRect(
  cols: number,
  indices: readonly number[]
): { readonly col: number; readonly row: number; readonly w: number } | null {
  if (indices.length === 0) return null;
  const byRow = new Map<number, number[]>();
  for (const idx of indices) {
    const row = Math.floor(idx / cols);
    const list = byRow.get(row);
    if (list) list.push(idx % cols);
    else byRow.set(row, [idx % cols]);
  }
  let best: { col: number; row: number; w: number } | null = null;
  for (const [row, columns] of byRow) {
    columns.sort((a, b) => a - b);
    let start = columns[0];
    let run = 1;
    for (let i = 1; i <= columns.length; i++) {
      if (i < columns.length && columns[i] === columns[i - 1] + 1) {
        run += 1;
        continue;
      }
      if (!best || run > best.w) best = { col: start, row, w: run };
      if (i < columns.length) {
        start = columns[i];
        run = 1;
      }
    }
  }
  return best;
}
