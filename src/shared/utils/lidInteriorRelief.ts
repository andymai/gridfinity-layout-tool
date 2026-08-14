/**
 * Is the bin's interior carved back to clear the lid's seating envelope (#3477)?
 *
 * The single gate, read by the pipeline stage that cuts the ring, by
 * `dividerRailBlocks` (which has nothing to notch once it is on), by the label
 * shelf's datum, and by the scoop warning. A second copy anywhere would let the
 * bin be relieved while the rails still notched, or the reverse.
 *
 * Lives here rather than beside `shouldGenerateLid` because `lidCompatibility`
 * reaches this predicate through BOTH the divider planner and the label shelf
 * datum; defining it there makes those imports circular. Depending only on
 * params alone keeps every arrow pointing one way.
 */

import type { BinParams } from '@/shared/types/bin';
import { LID_KEEPOUT_BELOW_CEILING_MM } from '@/shared/constants/lidKeepout';

export function interiorReliefActive(params: BinParams): boolean {
  if (!params.lid.relieveInterior) return false;
  if (!params.lid.enabled) return false;
  // A lid needs a lip to grip, and a base-only tile has no cavity to relieve.
  if (!params.base.stackingLip) return false;
  if (params.base.tile === true) return false;
  // Custom shapes are relieved too since #3482. Their ring follows the mask
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
  return interiorReliefActive(params) ? LID_KEEPOUT_BELOW_CEILING_MM : 0;
}
