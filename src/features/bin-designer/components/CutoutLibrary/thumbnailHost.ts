/**
 * The bin a library thumbnail shows: the smallest custom-cutouts bin that holds
 * the item with a little room round it, the item in its middle. A pocket reads
 * as a pocket only when there is plastic round it.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { withResolvedCutoutDepths } from '@/shared/utils/cutoutDepth';
import type { CutoutLibraryContent } from '@/features/bin-designer/library/libraryTypes';
import { contentBounds, placeLibraryContent } from './libraryContent';

const MARGIN_MM = 4;
/** Room for the walls and the fit tolerance, on top of the interior. */
const WALL_ALLOWANCE_MM = 8;
/** Plastic under the deepest pocket, plus the base below it. */
const FLOOR_ALLOWANCE_MM = 12;
const MIN_HEIGHT_UNITS = 3;

export function thumbnailHost(content: CutoutLibraryContent): BinParams | null {
  const box = contentBounds(content.params.cutouts);
  if (!box) return null;
  const units = (mm: number) =>
    Math.max(
      1,
      Math.ceil((mm + 2 * MARGIN_MM + WALL_ALLOWANCE_MM) / DEFAULT_BIN_PARAMS.gridUnitMm)
    );
  const deepest = Math.max(...content.params.cutouts.map((c) => c.cutDepth));
  const sized: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    width: units(box.maxX - box.minX),
    depth: units(box.maxY - box.minY),
    height: Math.max(
      MIN_HEIGHT_UNITS,
      Math.ceil((deepest + FLOOR_ALLOWANCE_MM) / DEFAULT_BIN_PARAMS.heightUnitMm)
    ),
  };
  const { innerW, innerD } = cutoutInterior(sized);
  let next = 0;
  const id = () => `thumb-${++next}`;
  const placed = placeLibraryContent(content, {
    itemId: 'thumbnail',
    at: { x: innerW / 2, y: innerD / 2 },
    newCutoutId: id,
    newGroupId: id,
  });
  return withResolvedCutoutDepths({
    ...sized,
    cutouts: placed.cutouts,
    ...(Object.keys(placed.meshAssets).length > 0 ? { meshAssets: placed.meshAssets } : {}),
    ...(Object.keys(placed.groupNames).length > 0 ? { cutoutGroupNames: placed.groupNames } : {}),
  });
}
