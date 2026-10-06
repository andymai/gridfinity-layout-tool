import type { BinParams } from '../types';
import { MAX_COMPARTMENT_FLOOR_RAISE_MM, MIN_RAISED_CAVITY_MM } from '../types';
import { GRIDFINITY } from '../constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';
import { binDimensions } from './binDimensions';
import { compartmentHasTiltedEdge } from './compartments';
import { isPartialMask } from '@/shared/utils/cellMask';

/**
 * Highest floor raise the panel offers: what leaves {@link MIN_RAISED_CAVITY_MM}
 * of pocket above it, measured from the same interior height the generator
 * clamps against (the stacking lip's taper eats into it). Rounded down so the
 * slider can never name a raise the geometry then trims.
 */
export function maxCompartmentFloorRaiseMm(params: BinParams): number {
  const { wallHeight } = binDimensions(params);
  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  const room = interiorHeight - resolveBinFloorMm(params) - MIN_RAISED_CAVITY_MM;
  return Math.max(0, Math.min(MAX_COMPARTMENT_FLOOR_RAISE_MM, Math.floor(room)));
}

/**
 * The raise the generator actually builds under one compartment, clamped the
 * way `resolveFloorRaises` clamps it (unrounded, unlike the slider's ceiling).
 * Zero for a compartment with a tilted edge, which the generator skips, and
 * on a custom shape, where the floor raise feature does not build.
 */
export function builtCompartmentFloorRaiseMm(params: BinParams, id: number): number {
  if (isPartialMask(params.cellMask)) return 0;
  const raise = params.compartments.floorRaises?.[id];
  if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return 0;
  if (compartmentHasTiltedEdge(params.compartments, id)) return 0;
  const { wallHeight } = binDimensions(params);
  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - resolveBinFloorMm(params) - MIN_RAISED_CAVITY_MM
  );
  return ceiling > 0 ? Math.min(raise, ceiling) : 0;
}
