import {
  lidTopAboveRimMm,
  type AssembledHeightSource,
} from '@/shared/printSettings/assembledHeight';
import {
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_HEIGHT_UNITS_MAX,
  LID_HEIGHT_UNITS_MIN,
} from '@/features/bin-designer/types/lid';

export interface LidUnitRange {
  readonly min: number;
  readonly max: number;
}

export interface SyncedLidHeight {
  readonly heightUnits: number;
  readonly extraHeightMm: number;
}

const EPS = 1e-6;

function topAtMm(params: AssembledHeightSource, extraHeightMm: number): number {
  return lidTopAboveRimMm({ ...params, lid: { ...params.lid, extraHeightMm } });
}

/**
 * The whole-unit lid heights the extra-height knob can reach, or null when no
 * lid seats on the rim. The low end is the stock lid rounded up: a hinged lid
 * with a stack grid already stands more than one unit tall.
 */
export function lidHeightUnitRange(params: AssembledHeightSource): LidUnitRange | null {
  const unit = params.heightUnitMm;
  const lowest = topAtMm(params, LID_EXTRA_HEIGHT_MIN_MM);
  if (!(unit > 0) || lowest <= 0) return null;
  const min = Math.max(LID_HEIGHT_UNITS_MIN, Math.ceil(lowest / unit - EPS));
  const max = Math.min(
    LID_HEIGHT_UNITS_MAX,
    Math.floor(topAtMm(params, LID_EXTRA_HEIGHT_MAX_MM) / unit + EPS)
  );
  return min <= max ? { min, max } : null;
}

/**
 * The smallest `extraHeightMm` that lifts the lid's top `units` height units
 * above the rim. The top climbs one-for-one with the knob, except on a hinged
 * lid under a height unit shorter than 7 mm, where the plate floor thickens in
 * steps as the knob rises. No knob value lands exactly across a step, so this
 * takes the one just over it.
 */
export function extraHeightForLidUnits(params: AssembledHeightSource, units: number): number {
  const target = units * params.heightUnitMm;
  const guess = Math.min(target - topAtMm(params, 0), LID_EXTRA_HEIGHT_MAX_MM);
  if (guess <= LID_EXTRA_HEIGHT_MIN_MM) return LID_EXTRA_HEIGHT_MIN_MM;
  if (Math.abs(topAtMm(params, guess) - target) < EPS) return guess;
  let lo = LID_EXTRA_HEIGHT_MIN_MM;
  let hi = LID_EXTRA_HEIGHT_MAX_MM;
  if (topAtMm(params, hi) < target) return hi;
  while (hi - lo > 1e-9) {
    const mid = (lo + hi) / 2;
    if (topAtMm(params, mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The stored `heightUnits` pulled into reach, and the `extraHeightMm` it
 * implies. Null when units are off, or when no lid seats on the rim: the knob is
 * then left alone and the units apply again once a lid seats.
 */
export function syncedLidHeight(params: AssembledHeightSource): SyncedLidHeight | null {
  const units = params.lid.heightUnits;
  if (units === undefined) return null;
  const range = lidHeightUnitRange(params);
  if (!range) return null;
  const heightUnits = Math.min(Math.max(Math.round(units), range.min), range.max);
  return { heightUnits, extraHeightMm: extraHeightForLidUnits(params, heightUnits) };
}

/**
 * The smallest whole-unit height at or above the lid as it stands, so
 * switching a lid to units never shrinks the space it encloses.
 */
export function lidUnitsCovering(params: AssembledHeightSource): number | null {
  const range = lidHeightUnitRange(params);
  if (!range) return null;
  const units = Math.ceil(lidTopAboveRimMm(params) / params.heightUnitMm - EPS);
  return Math.min(Math.max(units, range.min), range.max);
}

/**
 * `params` with its lid height re-derived, or the same object when nothing
 * moved. For writers that bypass the designer store's `set`, which syncs on
 * its own.
 */
export function withSyncedLidHeight<P extends AssembledHeightSource>(params: P): P {
  const synced = syncedLidHeight(params);
  if (
    !synced ||
    (synced.heightUnits === params.lid.heightUnits &&
      synced.extraHeightMm === params.lid.extraHeightMm)
  ) {
    return params;
  }
  return { ...params, lid: { ...params.lid, ...synced } };
}
