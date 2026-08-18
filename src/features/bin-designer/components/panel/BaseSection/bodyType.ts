/**
 * The base's four archetype flags, read and written as ONE exclusive choice.
 *
 * `base.flat`, `base.spacer`, `base.tile` and `base.lid` are already mutually
 * exclusive: every constraint rule that disables one of them names another as
 * its source (`rules.ts`), so no two can be on at once. They were four
 * independent toggles only in the UI, which is why turning one on meant reading
 * a "cannot combine X with Y" explanation off the others.
 *
 * Deriving the choice here rather than in the component keeps three consumers
 * honest (the picker, the applicability of the sections below it, and the
 * group summary) and means adding a sixth archetype is a new entry in
 * {@link BODY_TYPES} plus a card, not another round of pairwise rules.
 */

import { resolveConstraints } from '@/shared/constraints';
import type { FeatureKey } from '@/shared/constraints';
import { DEFAULT_TRAY_BOTTOM } from '@/features/bin-designer/types';
import type { BinParams } from '@/features/bin-designer/types';
import { isEffectiveTile } from '@/features/bin-designer/types/base';

export const BODY_TYPES = ['standard', 'flat', 'spacer', 'tile', 'tray'] as const;

export type BodyType = (typeof BODY_TYPES)[number];

/**
 * The constraint feature each archetype is stored as. `standard` is absent by
 * design: it is the state of having none of them on, not a flag of its own.
 */
const FEATURE_BY_BODY_TYPE: Record<Exclude<BodyType, 'standard'>, FeatureKey> = {
  flat: 'base.flat',
  spacer: 'base.spacer',
  tile: 'base.tile',
  tray: 'base.lid',
};

/**
 * Which archetype a base is currently in.
 *
 * Ordered rather than exclusive-by-construction so a hand-crafted or legacy
 * payload with two flags set still resolves to exactly one card. `tile` is
 * tested through {@link isEffectiveTile}, which already refuses a socketless
 * base. A `{ style: 'flat', tile: true }` payload is a flat base with an inert
 * flag, and reading it as base-only would show a card the geometry ignores.
 */
export function deriveBodyType(base: BinParams['base']): BodyType {
  if (base.spacer) return 'spacer';
  if (isEffectiveTile(base)) return 'tile';
  if (base.style === 'lid') return 'tray';
  if (base.style === 'flat') return 'flat';
  return 'standard';
}

/**
 * Materialise the tray mating config on the way in and STRIP it on the way out.
 *
 * It is absent by default (see `DEFAULT_BIN_PARAMS`), and `params` is hashed
 * wholesale for the community fingerprint, so a bin that once visited the tray
 * body type must fingerprint identically to one that never did.
 */
function withTrayConfig(params: BinParams): BinParams {
  if (params.base.style === 'lid') {
    return {
      ...params,
      base: { ...params.base, trayBottom: params.base.trayBottom ?? DEFAULT_TRAY_BOTTOM },
    };
  }
  const { trayBottom: _dropped, ...base } = params.base;
  return { ...params, base };
}

/**
 * Params for switching to `next`.
 *
 * The outgoing archetype is cleared BEFORE the incoming one is enabled, which
 * is what makes every card reachable from every other: each blocking rule has
 * another archetype as its source, so once the current one is off nothing in
 * this set blocks anything else. Enabling alone would work for most pairs and
 * silently fail for the rest (leaving `standard` needs an explicit disable and
 * has nothing to enable).
 *
 * The result still has to go through `useBaseSection`'s `commit`, which is what
 * enforces the height floor and strips the `tile: false` residue.
 */
export function bodyTypeParams(params: BinParams, next: BodyType): BinParams {
  const current = deriveBodyType(params.base);
  if (current === next) return params;

  let resolved = params;
  if (current !== 'standard') {
    resolved = resolveConstraints(resolved, {
      feature: FEATURE_BY_BODY_TYPE[current],
      enabled: false,
    }).params;
  }
  if (next !== 'standard') {
    resolved = resolveConstraints(resolved, {
      feature: FEATURE_BY_BODY_TYPE[next],
      enabled: true,
    }).params;
  }
  return withTrayConfig(resolved);
}
