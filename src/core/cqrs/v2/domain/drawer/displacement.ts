/**
 * Shared displacement rule for drawer-boundary changes: a bin is displaced to
 * staging when its footprint no longer fits the drawer — out of the W×D
 * bounds, or outside the outline when one is set. Used by `drawer.update`
 * (resize) and `drawer.setOutline` so the two commands can never disagree,
 * and mirrored by the legacy store action.
 *
 * The outline is read through the shared grid↔perimeter frame, so
 * any frame-affecting edit — outline, fractional edge, manual grid shift,
 * baseplate padding — displaces exactly the bins whose sockets the printed
 * plate loses.
 */

import type { Bin, BinId, Drawer, StoredBaseplateParams } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { isFootprintInsideOutline } from '@/shared/utils/drawerOutlineGeometry';
import { drawerFrameOutline } from '@/shared/utils/outlineFrame';

export function computeDisplacedBins(
  bins: readonly Bin[],
  drawer: Pick<
    Drawer,
    | 'width'
    | 'depth'
    | 'outline'
    | 'fractionalEdgeX'
    | 'fractionalEdgeY'
    | 'gridShiftX'
    | 'gridShiftY'
  >,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  // Depth-axis pitch for a non-square grid; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
): BinId[] {
  const width = drawer.width as number;
  const depth = drawer.depth as number;
  const frameOutline = drawerFrameOutline(drawer, baseplateParams, gridUnitMm, gridUnitMmY);
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
        frameOutline !== undefined &&
        !isFootprintInsideOutline(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth },
          frameOutline,
          gridUnitMm,
          gridUnitMmY
        )
      );
    })
    .map((b) => b.id);
}
