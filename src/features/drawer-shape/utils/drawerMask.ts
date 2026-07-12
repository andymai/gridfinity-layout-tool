/**
 * Editor-side mask model for drawer shapes (issue #2528).
 *
 * The editor paints whole drawer cells (including the narrow fractional-edge
 * cell of an x.5 drawer), but the underlying mask reuses the half-resolution
 * `CellMask` from the bin designer so `maskToPolygon` can trace the boundary:
 * one drawer cell = a 2×2 block of mask cells (1×2 for a fractional edge
 * cell). Polygon coordinates come back in grid units and scale by
 * `gridUnitMm` into the drawer-local mm the outline model expects.
 */

import type { Drawer, DrawerOutline, FractionalEdge } from '@/core/types';
import { MASK_CELLS_PER_UNIT, maskToPolygon, type CellMask } from '@/shared/utils/cellMask';
import { getOutsideCellSet } from '@/shared/utils/drawerOutlineCells';

/** One paintable editor cell (whole drawer cell or the fractional edge cell). */
export interface EditorCell {
  /** Grid-unit start along the axis. */
  readonly start: number;
  /** Grid-unit size (1, or the fractional remainder). */
  readonly size: number;
}

/** Decompose an axis into editor cells honoring the fractional edge side. */
export function editorAxisCells(units: number, fractionalEdge: FractionalEdge): EditorCell[] {
  const cells: EditorCell[] = [];
  const fullCount = Math.floor(units + 1e-9);
  const remainder = units - fullCount;
  const hasRemainder = remainder > 1e-9;
  let pos = 0;
  if (hasRemainder && fractionalEdge === 'start') {
    cells.push({ start: 0, size: remainder });
    pos = remainder;
  }
  for (let i = 0; i < fullCount; i++) {
    cells.push({ start: pos, size: 1 });
    pos += 1;
  }
  if (hasRemainder && fractionalEdge === 'end') {
    cells.push({ start: pos, size: remainder });
  }
  return cells;
}

export interface DrawerMaskGrid {
  readonly cols: EditorCell[];
  readonly rows: EditorCell[];
  /** Row-major editor-cell occupancy, origin bottom-left (row 0 = front). */
  readonly cells: Uint8Array;
}

export function buildFullDrawerMask(drawer: Drawer): DrawerMaskGrid {
  const cols = editorAxisCells(drawer.width, drawer.fractionalEdgeX ?? 'end');
  const rows = editorAxisCells(drawer.depth, drawer.fractionalEdgeY ?? 'end');
  return { cols, rows, cells: new Uint8Array(cols.length * rows.length).fill(1) };
}

/**
 * Rasterize an existing outline back into the editor grid so the dialog
 * reopens showing the current shape: an editor cell is filled iff it is fully
 * inside the outline (the same predicate placement and hatching use).
 */
export function outlineToDrawerMask(
  outline: DrawerOutline,
  drawer: Drawer,
  gridUnitMm: number
): DrawerMaskGrid {
  const grid = buildFullDrawerMask(drawer);
  const outside = getOutsideCellSet(outline, drawer, gridUnitMm, 1);
  for (let r = 0; r < grid.rows.length; r++) {
    for (let c = 0; c < grid.cols.length; c++) {
      if (outside.has(`${grid.cols[c].start},${grid.rows[r].start}`)) {
        grid.cells[r * grid.cols.length + c] = 0;
      }
    }
  }
  return grid;
}

export type DrawerMaskError = 'empty' | 'disconnected';

/**
 * Convert the editor grid to a `DrawerOutline` (drawer-local mm). Enclosed
 * empty regions are filled — a plate with interior holes is unrepresentable
 * by design (single loop), and the editor communicates this by refilling
 * them. Returns an error for empty or 4-connected-disconnected shapes.
 */
export function drawerMaskToOutline(
  grid: DrawerMaskGrid,
  gridUnitMm: number
): { outline: DrawerOutline } | { error: DrawerMaskError } {
  // maskToPolygon's real preconditions (0/1 values, non-empty, single
  // 4-connected region) are enforced here; the bin designer's validateMask
  // adds a 10-unit dimension cap that is an authoring constraint, not an
  // algorithmic one — drawer masks legitimately reach 50 units.
  const filledCount = grid.cells.reduce<number>((sum, v) => sum + v, 0);
  if (filledCount === 0) return { error: 'empty' };
  if (!isFourConnected(grid)) return { error: 'disconnected' };

  // Editor cells → half-resolution CellMask (grid-unit coords × 2).
  const totalWidthUnits = grid.cols.reduce((sum, c) => sum + c.size, 0);
  const totalDepthUnits = grid.rows.reduce((sum, r) => sum + r.size, 0);
  const cols = Math.round(totalWidthUnits * MASK_CELLS_PER_UNIT);
  const rows = Math.round(totalDepthUnits * MASK_CELLS_PER_UNIT);
  const cells: (0 | 1)[] = new Array<0 | 1>(cols * rows).fill(0);
  for (let r = 0; r < grid.rows.length; r++) {
    for (let c = 0; c < grid.cols.length; c++) {
      if (grid.cells[r * grid.cols.length + c] !== 1) continue;
      const c0 = Math.round(grid.cols[c].start * MASK_CELLS_PER_UNIT);
      const c1 = Math.round((grid.cols[c].start + grid.cols[c].size) * MASK_CELLS_PER_UNIT);
      const r0 = Math.round(grid.rows[r].start * MASK_CELLS_PER_UNIT);
      const r1 = Math.round((grid.rows[r].start + grid.rows[r].size) * MASK_CELLS_PER_UNIT);
      for (let mr = r0; mr < r1; mr++) {
        for (let mc = c0; mc < c1; mc++) {
          cells[mr * cols + mc] = 1;
        }
      }
    }
  }
  const mask: CellMask = { cols, rows, cells };
  // First loop is the outer CCW perimeter; hole loops (if any) are ignored —
  // that IS the hole-filling behavior. Loop points are already in grid units
  // (maskToPolygon applies MASK_CELL_SIZE), so only the mm scale remains.
  const [outer] = maskToPolygon(mask);
  const scale = gridUnitMm;
  return {
    outline: {
      vertices: outer.map((p) => ({ x: p.x * scale, y: p.y * scale })),
      authoring: { kind: 'cells' },
    },
  };
}

function isFourConnected(grid: DrawerMaskGrid): boolean {
  const w = grid.cols.length;
  const h = grid.rows.length;
  const seen = new Uint8Array(w * h);
  let start = -1;
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] === 1) {
      start = i;
      break;
    }
  }
  if (start === -1) return false;
  const stack = [start];
  seen[start] = 1;
  let visited = 0;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    visited++;
    const c = i % w;
    const r = (i - c) / w;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= w || nr < 0 || nr >= h) continue;
      const ni = nr * w + nc;
      if (seen[ni] === 0 && grid.cells[ni] === 1) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  const filled = grid.cells.reduce<number>((sum, v) => sum + v, 0);
  return visited === filled;
}
