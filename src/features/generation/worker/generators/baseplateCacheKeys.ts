/**
 * Cache key builders for baseplate caches.
 *
 * meshCacheKey covers every param that affects final geometry — used to short-
 * circuit the entire build when params haven't changed.
 *
 * slabPocketsCacheKey covers only slab+pocket-affecting params (NOT magnet
 * holes or connectors), so toggling those reuses the cached intermediate.
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
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    params.connectorNubs ?? false,
    params.invertDovetails ?? false,
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
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    forExport
  );
}
