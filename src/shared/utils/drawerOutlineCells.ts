/**
 * Cell-level view of a `DrawerOutline` for the grid editor: which cells are
 * NOT fully inside the shape. Rendering (hatching) and fill tools consume the
 * cell set; exact placement validation uses `isFootprintInsideOutline` — both
 * derive from the same `classifyRect` predicate, so a hatched cell is exactly
 * a cell placement would reject.
 */

import type { Drawer, DrawerOutline, FractionalEdge } from '@/core/types';
import { classifyRect } from './drawerOutlineGeometry';

/** One cell along an axis: start coordinate and size, both in grid units. */
interface AxisCell {
  readonly start: number;
  readonly size: number;
}

/**
 * Decompose an axis into cells of `step` grid units, with any fractional
 * remainder placed per the drawer's fractional edge ('start' = leading).
 */
function axisCells(units: number, step: number, fractionalEdge: FractionalEdge): AxisCell[] {
  const cells: AxisCell[] = [];
  const fullCount = Math.floor(units / step + 1e-9);
  const remainder = units - fullCount * step;
  const hasRemainder = remainder > 1e-9;
  let pos = 0;
  if (hasRemainder && fractionalEdge === 'start') {
    cells.push({ start: 0, size: remainder });
    pos = remainder;
  }
  for (let i = 0; i < fullCount; i++) {
    cells.push({ start: pos, size: step });
    pos += step;
  }
  if (hasRemainder && fractionalEdge === 'end') {
    cells.push({ start: pos, size: remainder });
  }
  return cells;
}

const cellSetCache = new WeakMap<DrawerOutline, Map<string, ReadonlySet<string>>>();

/**
 * Keys (`"x,y"`, grid units, matching the fill/occupancy convention) of every
 * cell not fully inside the outline. Memoized per outline reference.
 *
 * @param step - 1 for whole cells, 0.5 for half-grid mode.
 */
export function getOutsideCellSet(
  outline: DrawerOutline,
  drawer: Pick<Drawer, 'width' | 'depth' | 'fractionalEdgeX' | 'fractionalEdgeY'>,
  gridUnitMm: number,
  step: 0.5 | 1
): ReadonlySet<string> {
  const width = drawer.width as number;
  const depth = drawer.depth as number;
  const fx = drawer.fractionalEdgeX ?? 'end';
  const fy = drawer.fractionalEdgeY ?? 'end';
  const cacheKey = `${width},${depth},${gridUnitMm},${step},${fx},${fy}`;

  let byParams = cellSetCache.get(outline);
  if (byParams === undefined) {
    byParams = new Map();
    cellSetCache.set(outline, byParams);
  }
  const cached = byParams.get(cacheKey);
  if (cached !== undefined) return cached;

  const outside = new Set<string>();
  for (const cx of axisCells(width, step, fx)) {
    for (const cy of axisCells(depth, step, fy)) {
      const cls = classifyRect(
        outline,
        cx.start * gridUnitMm,
        cy.start * gridUnitMm,
        (cx.start + cx.size) * gridUnitMm,
        (cy.start + cy.size) * gridUnitMm
      );
      if (cls !== 'inside') outside.add(`${cx.start},${cy.start}`);
    }
  }
  byParams.set(cacheKey, outside);
  return outside;
}
