/**
 * The bin GENERATE path's settings seam for nozzle-aware label sockets (#2690).
 *
 * A label socket's pocket clearance grows with a wider nozzle
 * (`effectiveLabelSocketClearance`) so plates still click in when printed on a
 * 0.6/0.8mm nozzle. The nozzle lives in `settings.printSettings.nozzleSizeMm`,
 * NOT in the persisted design: baking it into `BinParams` would sync a
 * printer's nozzle to the user's other devices and ride along in shared /
 * exported designs. So the value is merged in transiently, at each generation
 * boundary, onto a throwaway params object — the store keeps persisting
 * nozzle-free params.
 *
 * Because the merged object also feeds `binMeshCacheKey`, the nozzle enters the
 * mesh cache key (a nozzle change is a cache miss → correct regen) without ever
 * entering persistence. Returns the input UNCHANGED — same reference — for
 * non-socket designs and at/below the 0.4mm baseline, so those hashes stay
 * byte-identical to the pre-#2690 keys and no cached mesh is needlessly evicted.
 */

import type { BinParams } from '@/shared/types/bin';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';

export function withSocketNozzle(params: BinParams, nozzleSizeMm: number): BinParams {
  if (params.label.mode !== 'socket') return params;
  if (!Number.isFinite(nozzleSizeMm) || nozzleSizeMm <= NOZZLE_BASELINE) return params;
  if (params.nozzleSizeMm === nozzleSizeMm) return params;
  return { ...params, nozzleSizeMm };
}
