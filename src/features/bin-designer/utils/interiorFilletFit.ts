import type { BinParams } from '../types';
import { binFloorMm } from '../types/base';
import { GRIDFINITY } from '../constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { INTERIOR_FILLET_HEADROOM_MM, narrowestCavitySpansMm } from '@/shared/utils/interiorFillet';
import { binDimensions } from './binDimensions';
import { builtCompartmentFloorRaiseMm } from './compartmentFloorRaise';

/**
 * The largest fillet every compartment can hold: half its narrowest span, and
 * the height from its floor, raised or not, to the top of the walls or
 * dividers around it, less the headroom the generator keeps. Past this, some
 * compartment rounds less than asked, or not at all.
 */
export function interiorFilletFitMm(params: BinParams): number {
  const { wallHeight } = binDimensions(params);
  const interior = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  const { cells, dividerHeight } = params.compartments;
  const top =
    new Set(cells).size > 1 ? resolveCompartmentDividerHeight(dividerHeight, interior) : interior;
  const floor = binFloorMm(params.wallThickness);
  let fit = Infinity;
  for (const [id, span] of narrowestCavitySpansMm(params)) {
    const height =
      top - floor - builtCompartmentFloorRaiseMm(params, id) - INTERIOR_FILLET_HEADROOM_MM;
    fit = Math.min(fit, span / 2, height);
  }
  return fit;
}
