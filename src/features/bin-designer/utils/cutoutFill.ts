/**
 * The solid fill level of a cutout bin, in both directions.
 *
 * `cutoutConfig.topOffset` is the only value stored, and every consumer reads
 * it: the generator's `solidSurfaceZ`, the shape cache key, the print estimate,
 * the knife-depth clamp and the server payload. So the "from the floor" the
 * user asked for (#3697) is a VIEW of that number plus a rule about what to
 * hold fixed when the bin resizes, never a second stored geometry value that
 * could disagree with it.
 *
 * The rule is `fillReference`. Against the rim, `topOffset` is what stays put
 * and the fill grows with the bin. Against the floor, the fill height stays put
 * and `topOffset` absorbs the change, which is what makes a CR2025 pocket depth
 * survive a bump from 3 to 4 height units.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { baseWallHeight } from './binDimensions';

/**
 * Thinnest fill the generator can be asked for.
 *
 * `buildCutoutCuts` drops every cutout once `solidSurfaceZ <= 0`, so the slider
 * has to stop short of the wall height rather than reach it. Half a millimetre
 * is the step the control already used.
 */
export const MIN_CUTOUT_FILL_MM = 0.5;

/** Interior wall height (mm) the fill level is measured within. */
export function cutoutWallHeightMm(
  params: Pick<BinParams, 'base' | 'height' | 'heightUnitMm'>
): number {
  return baseWallHeight(params.base, params.height * params.heightUnitMm);
}

/** Largest offset that still leaves a fill for cutouts to cut into. */
export function maxCutoutTopOffsetMm(wallHeightMm: number): number {
  return Math.max(0, wallHeightMm - MIN_CUTOUT_FILL_MM);
}

/** Height (mm) of the solid fill above the interior floor. */
export function cutoutFillHeightMm(wallHeightMm: number, topOffsetMm: number): number {
  return clampFillHeight(wallHeightMm, wallHeightMm - topOffsetMm);
}

/** The offset that puts the fill surface at `fillHeightMm` above the floor. */
export function topOffsetForFillHeight(wallHeightMm: number, fillHeightMm: number): number {
  return wallHeightMm - clampFillHeight(wallHeightMm, fillHeightMm);
}

function clampFillHeight(wallHeightMm: number, fillHeightMm: number): number {
  if (!Number.isFinite(fillHeightMm)) return wallHeightMm;
  return Math.min(wallHeightMm, Math.max(MIN_CUTOUT_FILL_MM, fillHeightMm));
}

/**
 * The `topOffset` a param change should land on, or `undefined` to leave it be.
 *
 * Compares the wall height BEFORE and AFTER rather than watching a list of
 * fields, because the wall height is a function of the height, the height unit
 * and the base style at once, and a list would silently miss whichever one was
 * added next. `baseWallHeight` is pure arithmetic, so asking it twice is
 * cheaper than remembering its dependencies.
 *
 * Returns `undefined` for a rim-anchored design so the caller writes nothing at
 * all: rim anchoring IS "leave `topOffset` alone", and that is the default.
 */
export function reanchorCutoutFill(prev: BinParams, next: BinParams): number | undefined {
  if (next.cutoutConfig.fillReference !== 'floor') return undefined;

  const before = cutoutWallHeightMm(prev);
  const after = cutoutWallHeightMm(next);
  if (before === after) return undefined;

  const held = cutoutFillHeightMm(before, prev.cutoutConfig.topOffset);
  return topOffsetForFillHeight(after, held);
}
