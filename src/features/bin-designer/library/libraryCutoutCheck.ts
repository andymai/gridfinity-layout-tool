/**
 * Whether a cutout from outside the app (a file, a pulled item) has the
 * geometry the editor reads. The design checks read the bin around the
 * cutouts, not each one, and a cutout with no size would reach the bounds and
 * the render as NaN.
 */

import type { CutoutShape } from '@/features/bin-designer/types';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const SHAPES: Record<CutoutShape, true> = {
  rectangle: true,
  circle: true,
  path: true,
  polygon: true,
  slot: true,
  mesh: true,
  knifeSlot: true,
  text: true,
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isPlaceableCutout(c: unknown, meshAssets: unknown): boolean {
  if (!isObject(c) || typeof c.shape !== 'string' || !(c.shape in SHAPES)) return false;
  if (![c.x, c.y, c.width, c.depth, c.cutDepth].every(finite)) return false;
  if ((c.width as number) <= 0 || (c.depth as number) <= 0) return false;
  if (c.shape === 'path') {
    const path = c.path;
    if (!Array.isArray(path) || path.length < MIN_PATH_POINTS) return false;
    if (!path.every((pt) => isObject(pt) && finite(pt.x) && finite(pt.y))) return false;
  }
  if (c.shape === 'mesh') {
    return typeof c.meshId === 'string' && isObject(meshAssets) && isObject(meshAssets[c.meshId]);
  }
  return true;
}
