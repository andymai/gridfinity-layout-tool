import type { BinParams } from '../types';
import { anyCutoutColored } from '@/shared/generation/cutoutColorUnits';
import { anyCompartmentColored } from './compartmentColorUnits';

/**
 * A colored cutout or compartment makes the design multi-color even with
 * feature colors off, so the 3MF export and its telemetry both gate on this.
 */
export function isMultiColorDesign(params: BinParams): boolean {
  return (
    params.featureColors.enabled ||
    anyCutoutColored(params.cutouts) ||
    anyCompartmentColored(params)
  );
}
