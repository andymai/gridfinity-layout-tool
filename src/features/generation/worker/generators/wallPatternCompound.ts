/**
 * Per-wall hex prism compound construction + cache lookup.
 *
 * `buildWallPatternCompound` is the expensive part of wall pattern
 * construction (up to ~1000 hex prisms on tall, wide bins). It uses
 * `transformCopy` + `compound` to group elements with O(n) topology
 * grouping rather than O(n²) `fuseAll`.
 *
 * `getCachedBaseCompound` keys the result on wall geometry only so
 * cutout/handle/ramp parameter nudges don't force a rebuild (#1422).
 *
 * `buildClippedWallPattern` chains the cached base through
 * `applyWallPatternClips`.
 */

import { unwrap, clone, compound, composeTransforms, transformCopy } from 'brepjs';
import type { Shape3D, TransformOp } from 'brepjs';
import type { WallPatternDescriptor } from './wallPatterns';
import { isAbortError } from './utils/abort';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import {
  WALL_PATTERN_BASE_CACHE,
  type CutoutClipParams,
  type HandleClipParams,
  type RampZoneClipParams,
} from './wallPatternTypes';
import { applyWallPatternClips } from './wallPatternClips';

/**
 * Build a compound of positioned hex prisms for a single wall.
 *
 * Creates one transformCopy per hex center, then groups them with compound()
 * (O(n) topology grouping, not O(n²) fuseAll). Returns null if no elements.
 */
function buildWallPatternCompound(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number
): Shape3D | null {
  const elements: Shape3D[] = [];
  try {
    for (const center of wall.centers) {
      const ops: TransformOp[] = [
        { type: 'translate', v: [center.x, center.y, -halfDepth] },
        { type: 'rotate', angle: 90, axis: [1, 0, 0] },
      ];
      if (wall.zRotation !== undefined) {
        ops.push({ type: 'rotate', angle: wall.zRotation, axis: [0, 0, 1] });
      }
      ops.push({
        type: 'translate',
        v: [wall.translateX, wall.translateY, wall.translateZ],
      });
      const trsf = composeTransforms(ops);
      try {
        elements.push(transformCopy(shapeTemplate, trsf));
      } finally {
        trsf.cleanup();
      }
    }

    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0];

    const grouped = compound(elements);
    for (const el of elements) el.delete();
    return grouped;
  } catch (e: unknown) {
    for (const el of elements) el.delete();
    if (isAbortError(e)) throw e;
    return null;
  }
}

/**
 * Return the base (uncut) hex compound for a wall, cached by wall geometry.
 *
 * The caller receives an owned clone; the cache retains the original. When the
 * compound has no clips to apply, the clipped pipeline will cache this same
 * clone directly — two cache hits for the price of one.
 *
 * Kept private so the base cache is only reachable via `buildClippedWallPattern`.
 */
function getCachedBaseCompound(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  baseKey: string
): Shape3D | null {
  const cached = getFeatureCache(WALL_PATTERN_BASE_CACHE, baseKey);
  if (cached) return cached;

  const built = buildWallPatternCompound(shapeTemplate, wall, halfDepth);
  if (!built) return null;
  setFeatureCache(WALL_PATTERN_BASE_CACHE, baseKey, built);
  return unwrap(clone(built));
}

/**
 * Build a fully-clipped wall pattern by cloning the cached base compound and
 * applying cutout, handle, and ramp-zone cuts. Returns null when the base
 * compound can't be built (degenerate wall).
 */
export function buildClippedWallPattern(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  baseKey: string,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null,
  rampClip: RampZoneClipParams | null
): Shape3D | null {
  const base = getCachedBaseCompound(shapeTemplate, wall, halfDepth, baseKey);
  if (!base) return null;
  return applyWallPatternClips(base, wall, clip, handleClip, rampClip);
}
