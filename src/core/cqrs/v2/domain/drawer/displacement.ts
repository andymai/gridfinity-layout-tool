/**
 * Shared displacement rule for drawer-boundary changes: a bin is displaced to
 * staging when its footprint no longer fits the drawer — out of the W×D
 * bounds, or outside the outline when one is set. Used by `drawer.update`
 * (resize) and `drawer.setOutline` so the two commands can never disagree,
 * and mirrored by the legacy store action.
 */

import type { Bin, BinId, Drawer } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { isFootprintInsideOutline } from '@/shared/utils/drawerOutlineGeometry';

export function computeDisplacedBins(
  bins: readonly Bin[],
  drawer: Pick<Drawer, 'width' | 'depth' | 'outline'>,
  gridUnitMm: number
): BinId[] {
  const width = drawer.width as number;
  const depth = drawer.depth as number;
  return bins
    .filter((bin) => {
      if (bin.layerId === STAGING_ID) return false;
      if (
        (bin.x as number) < 0 ||
        (bin.y as number) < 0 ||
        (bin.x as number) + (bin.width as number) > width ||
        (bin.y as number) + (bin.depth as number) > depth
      ) {
        return true;
      }
      return (
        drawer.outline !== undefined &&
        !isFootprintInsideOutline(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth },
          drawer.outline,
          gridUnitMm
        )
      );
    })
    .map((b) => b.id);
}
