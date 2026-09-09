import type { BinParams } from '../types';
import { MAX_COMPARTMENT_FLOOR_RAISE_MM, MIN_RAISED_CAVITY_MM } from '../types';
import { binFloorMm } from '../types/base';
import { binDimensions } from './binDimensions';

/**
 * Highest floor raise the panel offers: what leaves {@link MIN_RAISED_CAVITY_MM}
 * of pocket above it. Rounded down so it can only be more conservative than
 * the generator's own clamp, which also subtracts the lip taper.
 */
export function maxCompartmentFloorRaiseMm(params: BinParams): number {
  const { wallHeight } = binDimensions(params);
  const room = wallHeight - binFloorMm(params.wallThickness) - MIN_RAISED_CAVITY_MM;
  return Math.max(0, Math.min(MAX_COMPARTMENT_FLOOR_RAISE_MM, Math.floor(room)));
}
