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

/**
 * Ceiling a stored offset is clamped to on load.
 *
 * Not a wall height: the migration that applies it has no base style to derive
 * one from, and the control clamps against the real height anyway. This only
 * has to stop a value that could never describe a bin from reaching the
 * generator. Mirrors `CONSTRAINTS.MAX_TOP_OFFSET_MM` on the server, which is
 * `MAX_HEIGHT` height units at the default 7mm.
 */
export const MAX_CUTOUT_TOP_OFFSET_MM = 350;

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
 * Fill height (mm) to hold across a param change, or null when nothing is held.
 *
 * Captured as a NUMBER before the change, never as a reference into the params:
 * `updateBase` mutates `params.base` in place, so a snapshot holding that
 * object would read the new style back and conclude nothing moved.
 */
export function heldCutoutFillMm(params: BinParams): number | null {
  if (params.cutoutConfig.fillReference !== 'floor') return null;
  return cutoutFillHeightMm(cutoutWallHeightMm(params), params.cutoutConfig.topOffset);
}

/**
 * The `topOffset` that restores `heldMm` at the new wall height, or `undefined`
 * to leave it alone.
 *
 * Takes the held height rather than the previous params so it cannot be fooled
 * by an in-place mutation, and so a rim-anchored design (the default) costs one
 * property read instead of a snapshot of the whole param tree.
 */
export function reanchorCutoutFill(next: BinParams, heldMm: number | null): number | undefined {
  if (heldMm === null) return undefined;
  const topOffset = topOffsetForFillHeight(cutoutWallHeightMm(next), heldMm);
  return topOffset === next.cutoutConfig.topOffset ? undefined : topOffset;
}
