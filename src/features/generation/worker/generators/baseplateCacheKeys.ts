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
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import {
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  SNAP_CLIP_CLEARANCE,
  effectiveClearance,
} from './generatorConstants';

export function meshCacheKey(
  params: BaseplateParams,
  forExport: boolean,
  draft: boolean = false
): string {
  // Key on the CLAMPED effective groove clearance, not the raw fit offset, so
  // offsets that collapse to identical geometry share a cache entry (e.g. any
  // tighter-than-floor value clamps to 0). Gated on connectorNubs because the
  // offset has no geometric effect when connectors are off. `connectorStyle` is
  // already part of the key, so the per-style base clearance is disambiguated.
  const baseClearance =
    params.connectorStyle === 'dovetailKey'
      ? DOVETAIL_KEY_CLEARANCE
      : params.connectorStyle === 'snapClip'
        ? SNAP_CLIP_CLEARANCE
        : TONGUE_CLEARANCE;
  const connectorClearance = params.connectorNubs
    ? effectiveClearance(baseClearance, params.connectorFitOffset ?? 0, params.nozzleSizeMm)
    : 0;
  // Draft only changes geometry when there's a lightweight floor cut to skip
  // (magnets on AND lightweight not disabled). Otherwise the draft mesh is
  // byte-identical to the full build, so folding `draft` to false keeps both
  // sharing one LRU entry instead of fragmenting it.
  const geometryAffectingDraft = draft && params.magnetHoles && params.lightweight !== false;
  // Nozzle scales connector feature sizes (snap-clip barb/leg) independently of
  // the clearance term, so it must key the cache or wider-nozzle geometry would
  // alias onto the 0.4mm build. Only meaningful when connectors are on; folded to
  // 0 otherwise so connector-off plates keep sharing one entry across nozzles.
  const connectorNozzle = params.connectorNubs
    ? quantize(params.nozzleSizeMm ?? NOZZLE_BASELINE)
    : 0;
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
    params.overTile === true ? (params.overTileHalfGrid ?? false) : false,
    params.overTile === true && params.overTileHalfGrid === true
      ? (params.overTileHalfGridSolidLeftover ?? false)
      : false,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    params.connectorNubs ?? false,
    params.invertDovetails ?? false,
    params.preferIdenticalPieces ?? false,
    params.connectorStyle ?? 'dovetail',
    quantize(connectorClearance),
    connectorNozzle,
    params.lightweight ?? true,
    quantize(params.cornerRadius ?? -1),
    quantize(params.cornerRadii?.tl ?? -1),
    quantize(params.cornerRadii?.tr ?? -1),
    quantize(params.cornerRadii?.bl ?? -1),
    quantize(params.cornerRadii?.br ?? -1),
    forExport,
    // Draft preview skips the lightweight floor cut, so its mesh differs from
    // the full-geometry build — but only when that cut would actually run.
    geometryAffectingDraft
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
