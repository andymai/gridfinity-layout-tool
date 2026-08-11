/**
 * Cache key builder for the baseplate slab+pockets cache.
 *
 * slabPocketsCacheKey covers slab+pocket-affecting params. It still includes
 * `magnetHoles` and `magnetDepth` because they affect slab height and whether
 * pockets are through-cut or floored. What it omits is the magnet-hole cutter
 * geometry (diameter/offsets) and all connector params — those are applied
 * after the cached intermediate, so toggling them reuses this cache.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { pitchKeySegments } from './gridPitch';
import { baseplateFloorDepth } from './generatorConstants';

/**
 * @param pocketMaskHash - For shaped plates: hash of which cells are pocketed
 * (computed by the generator from the same classification the pocket loop
 * uses). Deliberately NOT the outline curve — the outline intersect runs
 * post-cache, so outlines that pocket the same cells share one slab entry.
 */
export function slabPocketsCacheKey(
  params: ResolvedBaseplateParams,
  forExport: boolean,
  pocketMaskHash?: string
): string {
  return buildCacheKey(
    'v2',
    pocketMaskHash !== undefined ? `pm:${pocketMaskHash}` : '',
    quantize(params.width),
    quantize(params.depth),
    quantize(params.gridUnitMm),
    ...pitchKeySegments(
      { x: params.gridUnitMm, y: params.gridUnitMmY ?? params.gridUnitMm },
      quantize
    ),
    params.magnetHoles,
    quantize(params.magnetDepth),
    // The resolved floor depth sets the slab height + whether pockets are
    // through-cut (0 = through). Captures the solidFloor thickness and the
    // mount-down screw pad too.
    quantize(baseplateFloorDepth(params)),
    // Screw holes decide PER CELL which pockets keep a floor, so they change the
    // cached slab-with-pockets itself, not just a later cut. Head geometry is
    // included because it moves that per-cell decision via the placement.
    params.screwHoles?.enabled === true,
    quantize(params.screwHoles?.diameter ?? 0),
    params.screwHoles?.headStyle ?? '',
    quantize(params.screwHoles?.headDiameter ?? 0),
    quantize(params.screwHoles?.counterboreDepth ?? 0),
    params.screwHoles?.screwsPerPiece ?? 0,
    quantize(params.paddingLeft),
    quantize(params.paddingRight),
    quantize(params.paddingFront),
    quantize(params.paddingBack),
    // Widens the cached slab the pockets are cut into (#3169) — without it a
    // grid-shifted plate reuses the unshifted slab and prints truncated.
    quantize(params.outlineOverhang?.left ?? 0),
    quantize(params.outlineOverhang?.right ?? 0),
    quantize(params.outlineOverhang?.front ?? 0),
    quantize(params.outlineOverhang?.back ?? 0),
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.overTile ?? false,
    params.overTile === true ? (params.overTileHalfGrid ?? false) : false,
    params.overTile === true && params.overTileHalfGrid === true
      ? (params.overTileHalfGridSolidLeftover ?? false)
      : false,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    forExport
  );
}
