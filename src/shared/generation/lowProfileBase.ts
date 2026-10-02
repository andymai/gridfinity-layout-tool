/**
 * The seam between a layout's low-profile setting and the designs placed in it.
 *
 * The layout decides whether its bins stand on a low-profile foot, so every
 * path that generates a design inside a layout routes its params through
 * {@link withLowProfileBase}; anything that hands a design to someone else (a
 * community publish, a design share, a JSON export) routes it through
 * {@link withoutLowProfileBase}, so it always leaves with standard feet.
 *
 * Both return the input unchanged — same reference — when there is nothing to
 * do, so a standard design keeps its existing cache keys and fingerprint.
 */

import type { BinParams } from '@/shared/types/bin';

export function withLowProfileBase(params: BinParams, lowProfile: boolean | undefined): BinParams {
  if (lowProfile !== true) return withoutLowProfileBase(params);
  if (params.base.lowProfile === true) return params;
  return { ...params, base: { ...params.base, lowProfile: true } };
}

export function withoutLowProfileBase(params: BinParams): BinParams {
  if (!('lowProfile' in params.base)) return params;
  const { lowProfile: _drop, ...base } = params.base;
  return { ...params, base };
}
