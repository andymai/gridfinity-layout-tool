import { minHeightUnits } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { isEffectiveTile } from '@/features/bin-designer/types/base';

function omitTile(base: BinParams['base']): BinParams['base'] {
  const { tile: _tile, ...rest } = base;
  return rest;
}

function omitDefaultLightweightMode(base: BinParams['base']): BinParams['base'] {
  const { lightweightMode: _mode, ...rest } = base;
  return rest;
}

function omitDefaultLipTip(base: BinParams['base']): BinParams['base'] {
  const { lipTip: _tip, ...rest } = base;
  return rest;
}

/**
 * The params every base toggle writes, after the constraint engine has run.
 *
 * Only an effective spacer may stand 1u tall, and several toggles can END one:
 * leaving spacer mode, or enabling the flat base, which auto-disables the
 * spacer. Any of those would otherwise strand the bin under the ordinary floor,
 * below what the height stepper will let the user climb back out of. The floor
 * is read off the RESOLVED params: the engine's post-check returns the params
 * untouched when an enable turns out to be blocked.
 */
export function finalizeBaseParams(resolved: BinParams): BinParams {
  if (isEffectiveTile(resolved.base)) {
    // A base-only bin's height and collar are inert (the wall is 0 and
    // `assembledHeight` supplies the real height from the slab), so they are
    // pinned rather than floored: two base-only bins that differ only in a
    // number nothing reads must not fingerprint differently and defeat the
    // community duplicate guard. The collar is explicitly `undefined`, not
    // omitted, because `setParams` merges via `Object.assign`.
    return { ...resolved, height: 1, extraWallHeightMm: undefined };
  }
  // Each default below is stripped rather than written because absent already
  // means it, and `params` is hashed wholesale for the community fingerprint: a
  // bin that visited a control and came back must fingerprint as one that never
  // did. `resolveConstraints` writes `tile: false` whenever a rule auto-disables
  // base-only mode, and every base toggle lands here, so this is the one place
  // that can strip it.
  const withoutTile =
    'tile' in resolved.base ? { ...resolved, base: omitTile(resolved.base) } : resolved;
  const withoutMode =
    withoutTile.base.lightweightMode === 'interior'
      ? { ...withoutTile, base: omitDefaultLightweightMode(withoutTile.base) }
      : withoutTile;
  const next =
    withoutMode.base.lipTip === 'sharp'
      ? { ...withoutMode, base: omitDefaultLipTip(withoutMode.base) }
      : withoutMode;
  const minHeight = minHeightUnits(next.base, next.heightUnitMm);
  return next.height < minHeight ? { ...next, height: minHeight } : next;
}
