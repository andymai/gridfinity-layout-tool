/**
 * "Trace bin layout": derive the drawer shape from the bins the user drew —
 * the reporter's original ask in issue #2528. The footprint is the union of
 * every non-staged bin across all layers; gaps between bins that end up
 * enclosed are filled by the outline conversion (single-loop model).
 */

import type { Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { buildFullDrawerMask, type DrawerMaskGrid } from './drawerMask';

/** Editor grid with exactly the cells any bin touches filled. */
export function traceBinFootprint(layout: Layout): DrawerMaskGrid {
  const grid = buildFullDrawerMask(layout.drawer);
  grid.cells.fill(0);

  for (const bin of layout.bins) {
    if (bin.layerId === STAGING_ID) continue;
    for (let c = 0; c < grid.cols.length; c++) {
      const col = grid.cols[c];
      const overlapsX = col.start < bin.x + bin.width && col.start + col.size > bin.x;
      if (!overlapsX) continue;
      for (let r = 0; r < grid.rows.length; r++) {
        const row = grid.rows[r];
        if (row.start < bin.y + bin.depth && row.start + row.size > bin.y) {
          grid.cells[r * grid.cols.length + c] = 1;
        }
      }
    }
  }
  return grid;
}
