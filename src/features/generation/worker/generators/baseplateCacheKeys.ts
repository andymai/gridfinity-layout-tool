/**
 * Cache key builders for baseplate caches.
 *
 * meshCacheKey covers every param that affects final geometry — used to short-
 * circuit the entire build when params haven't changed.
 *
 * slabPocketsCacheKey covers slab+pocket-affecting params. It still includes
 * `magnetHoles` and `magnetDepth` because they affect slab height and whether
 * pockets are through-cut or floored. What it omits is the magnet-hole cutter
 * geometry (diameter/offsets) and all connector params — those are applied
 * after the cached intermediate, so toggling them reuses this cache.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import { buildCacheKey, quantize } from './cacheKeyUtils';

export function meshCacheKey(params: BaseplateParams, forExport: boolean): string {
  return buildCacheKey(
    'v1',
    quantize(params.width),
    quantize(params.depth),
    quantize(params.gridUnitMm),
    params.magnetHoles,
    quantize(params.magnetDiameter),
    quantize(params.magnetDepth),
    quantize(params.paddingLeft),
    quantize(params.paddingRight),
    quantize(params.paddingFront),
    quantize(params.paddingBack),
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.overTile ?? false,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    params.connectorNubs ?? false,
    params.invertDovetails ?? false,
    params.connectorStyle ?? 'dovetail',
    params.lightweight ?? true,
    quantize(params.cornerRadius ?? -1),
    quantize(params.cornerRadii?.tl ?? -1),
    quantize(params.cornerRadii?.tr ?? -1),
    quantize(params.cornerRadii?.bl ?? -1),
    quantize(params.cornerRadii?.br ?? -1),
    forExport
  );
}

export function slabPocketsCacheKey(params: BaseplateParams, forExport: boolean): string {
  return buildCacheKey(
    'v1',
    quantize(params.width),
    quantize(params.depth),
    quantize(params.gridUnitMm),
    params.magnetHoles,
    quantize(params.magnetDepth),
    quantize(params.paddingLeft),
    quantize(params.paddingRight),
    quantize(params.paddingFront),
    quantize(params.paddingBack),
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.overTile ?? false,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    forExport
  );
}
