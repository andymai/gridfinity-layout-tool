import type { Cutout } from '@/features/bin-designer/types';
import { resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { mergeCutoutUpdate } from '@/features/bin-designer/store/slices/cutoutSliceHelpers';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { getCutoutOutline } from './cutoutOutline';
import { getPathBounds } from './pathGeometry';
import { rotatePoint } from './geometryCore';
import type { PreviewMap } from './cutoutInteractionTypes';

interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * The hole a leaned pocket leaves in the surface, in board coordinates.
 *
 * The worker turns the pocket about its mouth, so the surface cuts the tilted
 * prism at a slant: the drawn shape stretched by 1/cos across the lean (its
 * local depth axis), about the same centre the shape turns on. The board draws
 * the shape as entered, so without this the opening on the bin is invisible
 * until the preview catches up, and at steep leans it is several times longer.
 */
export function leanedOpeningRing(cutout: Cutout): Point2D[] | null {
  const lean = resolveCutoutLeanDeg(cutout);
  if (lean === 0) return null;
  const ring = getCutoutOutline({ ...cutout, rotation: 0 })?.[0];
  if (!ring) return null;

  const pathBounds =
    cutout.shape === 'path' && cutout.path ? getPathBounds(cutout.path) : undefined;
  const cx = pathBounds ? (pathBounds.minX + pathBounds.maxX) / 2 : cutout.x + cutout.width / 2;
  const cy = pathBounds ? (pathBounds.minY + pathBounds.maxY) / 2 : cutout.y + cutout.depth / 2;
  const stretch = 1 / Math.cos((lean * Math.PI) / 180);
  return ring.map((p) => rotatePoint(p.x, cy + (p.y - cy) * stretch, cx, cy, -cutout.rotation));
}

export interface PlacedLeanOpening {
  readonly key: string;
  readonly ring: readonly Point2D[];
}

/** The opening of every leaned pocket on the board, one per repeat copy. */
export function placeLeanOpenings(
  cutouts: readonly Cutout[],
  preview: PreviewMap
): PlacedLeanOpening[] {
  return cutouts.flatMap((stored) => {
    const live = preview.get(stored.id);
    const c = live ? mergeCutoutUpdate(stored, live) : stored;
    if (c.hidden === true) return [];
    return (c.array ? expandCutoutArray(c) : [c]).flatMap((copy) => {
      const ring = leanedOpeningRing(copy);
      return ring ? [{ key: copy.id, ring }] : [];
    });
  });
}
