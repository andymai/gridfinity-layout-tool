/**
 * Is the bin's interior carved back to clear the lid's seating envelope?
 *
 * The single gate, read by the pipeline stage that cuts the ring, by
 * `dividerRailBlocks` (which has nothing to notch once it is on), by the label
 * shelf's datum, and by the scoop warning. A second copy anywhere would let the
 * bin be relieved while the rails still notched, or the reverse.
 *
 * Lives here rather than beside `shouldGenerateLid` because `lidCompatibility`
 * reaches this predicate through BOTH the divider planner and the label shelf
 * datum; defining it there makes those imports circular. Depending on params
 * alone keeps every arrow pointing one way.
 */

import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { LID_KEEPOUT_BELOW_CEILING_MM } from '@/shared/constants/lidKeepout';
import {
  isSlideLid,
  resolveLidPlateThickness,
  resolveLidSlide,
} from '@/features/bin-designer/types/lid';
import {
  SLIDE_KEEPOUT_CLEARANCE_MM,
  slidePlateTopBelowWallTopMm,
} from '@/shared/utils/slideLidPlan';

export function interiorReliefActive(params: BinParams): boolean {
  if (!params.lid.relieveInterior) return false;
  if (!params.lid.enabled) return false;
  // A CAPPING lid needs a lip to grip. A sliding one is held by a channel of
  // its own and works on a lipless bin — which is the whole of the `flush`
  // placement — so the precondition follows the attachment rather than the bin.
  if (!isSlideLid(params.lid) && !params.base.stackingLip) return false;
  // A base-only tile has no cavity to relieve.
  if (params.base.tile === true) return false;
  // Custom shapes are relieved too. Their ring follows the mask
  // outline as one band per edge (`lidKeepoutSlabs`) rather than as a rounded
  // rectangle, but the gate is the same: whether the bin has a lid to clear.
  return true;
}

/**
 * How far a label shelf sinks to stay out of the envelope (mm).
 *
 * A shelf is the one interior feature that legitimately wants that space — it
 * hangs off the wall AT the rim, so the ring's radial band is exactly the weld
 * that holds it, and trimming it would remove the anchor rather than the
 * obstruction. Its datum yields instead.
 *
 * Four things read this — the tab planner, the divider-pattern keep-outs, the
 * ghost overlay and the panel's height readout — and a shelf placed on one
 * plane while its keep-out is computed on another is the drift CLAUDE.md
 * gotcha #9 describes.
 */
export function labelShelfKeepoutMm(params: BinParams): number {
  if (!interiorReliefActive(params)) return 0;
  if (!isSlideLid(params.lid)) return LID_KEEPOUT_BELOW_CEILING_MM;
  // A sliding plate claims a deeper band than a click rail does: everything
  // from the retainer's top down past the plate's underside. The shelf has to
  // clear ALL of it, and the number is stated below the interior ceiling to
  // match the constant above — which sits `LIP_SMALL_TAPER` under the wall top
  // on a lipped bin, and at the wall top on a lipless one.
  const ceilingBelowWallTop = params.base.stackingLip ? GRIDFINITY_SPEC.LIP_SMALL_TAPER : 0;
  const slide = resolveLidSlide(params.lid);
  const plateTop = slidePlateTopBelowWallTopMm(
    slide.placement,
    slide.clearanceMm,
    params.base.stackingLip
  );
  const sink =
    plateTop + resolveLidPlateThickness(params) + SLIDE_KEEPOUT_CLEARANCE_MM - ceilingBelowWallTop;
  return Math.max(sink, 0);
}
