import type { BinParams } from '../types';
import { MAX_COMPARTMENT_FLOOR_RAISE_MM, MIN_RAISED_CAVITY_MM } from '../types';
import { binFloorMm } from '../types/base';
import { GRIDFINITY } from '../constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { binDimensions } from './binDimensions';

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
  const room = interiorHeight - binFloorMm(params.wallThickness) - MIN_RAISED_CAVITY_MM;
  return Math.max(0, Math.min(MAX_COMPARTMENT_FLOOR_RAISE_MM, Math.floor(room)));
}
