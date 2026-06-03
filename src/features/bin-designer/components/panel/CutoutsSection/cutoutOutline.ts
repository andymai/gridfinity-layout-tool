/**
 * Absolute-mm outline points for non-SDF cutout shapes (currently polygon).
 *
 * The renderer and 2D math share this so the editor preview matches the BREP
 * mesh. Points are returned in the cutout's unrotated frame (offset by the
 * cutout's bottom-left x/y); callers apply `cutout.rotation` around the center,
 * exactly as the path renderer does.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES } from '@/features/bin-designer/types';
import {
  regularPolygonPoints,
  clampPolygonSides,
  type PolygonPoint,
} from '@/shared/utils/cutoutPolygon';

/** Absolute (bin-interior frame) polygon vertices for a polygon cutout. */
export function polygonOutlinePoints(cutout: Cutout): PolygonPoint[] {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return regularPolygonPoints(
    clampPolygonSides(cutout.sides ?? DEFAULT_POLYGON_SIDES),
    cutout.width,
    cutout.depth
  ).map((p) => ({ x: cx + p.x, y: cy + p.y }));
}
