/**
 * The bin↔lid interface envelope: the volume a seated lid claims inside the
 * bin's mouth, and the clearance stack that sizes it.
 *
 * The top of a bin's cavity belongs to the lid. A seated click rail hangs
 * `LID_CLICK_RAIL_BAND_BELOW_WALL_TOP` under the wall top and reaches inboard
 * of the inner wall face, so any interior feature that rises into that ring
 * collides with it — and until #3477 each such feature was discovered, and
 * worked around, one at a time.
 *
 * `lid.relieveInterior` cuts this envelope out of the interior as the LAST
 * operation on the bin, which is the whole point: tree order does the
 * enforcement, so a feature added later is trimmed without its author knowing
 * the lid exists. The per-feature rail notching stays for designs that predate
 * the flag.
 */

import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP,
  LID_CLICK_RAIL_INNER,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
} from '@/features/bin-designer/types/lid';

/**
 * Clearance (mm) between the lid's swept volume and anything the bin keeps.
 *
 * The stack it comes from, per side:
 *
 * | term                          |   mm |
 * | ----------------------------- | ---- |
 * | lid-to-lip fit                | 0.25 | `LID_FIT_CLEARANCE`
 * | print tolerance, typical FDM  | 0.15 |
 * | warp across a 250mm part      | 0.50 | dominant term
 * |                               | 0.90 | → 1.0
 *
 * Warp dominates and is the reason this is not 0.4mm: a long bin's walls bow
 * inward as it cools, and a keep-out sized only to the nominal fit is consumed
 * by that alone.
 *
 * The per-feature notching margins (`LABEL_RAIL_MARGIN`, `DIVIDER_RAIL_MARGIN`,
 * `GRIP_RAIL_MARGIN`) are deliberately NOT re-derived from this. They now
 * affect only designs that predate `relieveInterior`, and re-tuning them would
 * regenerate published geometry for tidiness alone.
 */
export const LID_KEEPOUT_CLEARANCE = 1.0;

/**
 * How far BELOW THE INTERIOR CEILING the envelope reaches (mm).
 *
 * The ring is stated against the wall top; the cavity ceiling sits
 * `LIP_SMALL_TAPER` under that on a lipped bin, and a lid needs a lip, so this
 * is the only case. 3.45mm at the stock joint.
 *
 * The number a label shelf moves DOWN by. A shelf is the one interior feature
 * that legitimately wants the envelope's space — it hangs off the wall at the
 * rim — so trimming it would take away the weld that holds it, not the part in
 * the way. Its datum yields instead, which is the same rule stated from the
 * other side: features reference the interface, they are not cut by it.
 */
export const LID_KEEPOUT_BELOW_CEILING_MM =
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP + LID_KEEPOUT_CLEARANCE - GRIDFINITY_SPEC.LIP_SMALL_TAPER;

/** The envelope as a ring, in the bin's interior frame. */
export interface LidKeepoutRing {
  /** Half-extent of the ring's OUTER boundary from the interior centre. */
  readonly outerHalfX: number;
  readonly outerHalfY: number;
  /** Radial width, inward from that boundary. */
  readonly width: number;
  /** How far the ring reaches below the bin's wall top. */
  readonly depthBelowWallTop: number;
  /** Corner radius of the outer boundary. */
  readonly cornerRadius: number;
}

/**
 * How far inboard of the INNER WALL FACE a seated rail reaches (mm).
 *
 * The lid's outer half is `innerHalf + wallThickness + TOLERANCE/2 -
 * fitClearance`; the rail's spine sits `lidCornerR` inside that, and the
 * profile another `LID_CLICK_RAIL_INNER` (negative, i.e. inboard) past the
 * spine. 3.35mm at the 1.2mm default wall.
 *
 * Shared with `dividerRailPlan`, which needs the same number to decide whether
 * a divider line runs THROUGH a side rail rather than across it.
 */
export function railInboardReachMm(wallThickness: number): number {
  return -(
    wallThickness +
    GRIDFINITY_SPEC.TOLERANCE / 2 -
    LID_FIT_CLEARANCE -
    (LID_CORNER_RADIUS - LID_FIT_CLEARANCE) +
    LID_CLICK_RAIL_INNER
  );
}

/**
 * Resolve the keep-out ring for a bin's interior.
 *
 * Two bounds, both chosen so the cut can never touch what makes the joint work:
 *
 * - OUTER, at the stacking lip's inner face rather than the wall's. The lip
 *   juts into the cavity by `LIP_BIG_TAPER - wallThickness` (0.7mm at the
 *   default), and the void beneath that jut IS the undercut the rail's bump
 *   hooks. Starting the ring at the wall face would put the cutter over that
 *   material, and extending it upward to cut cleanly would then shave the
 *   undercut away and quietly disable the snap. Starting at the lip line
 *   leaves open air above the ring at every radius it spans, so the top can
 *   overshoot freely. The rail's own outer face sits 0.25mm inboard of this
 *   line, so nothing is given up.
 * - DEPTH, the rail band plus one clearance. Measured from the WALL TOP, which
 *   is what {@link LID_CLICK_RAIL_BAND_BELOW_WALL_TOP} is stated against, so a
 *   collar carries the whole envelope up with it for free.
 *
 * `innerW`/`innerD` are the pipeline's interior dimensions, overhang included.
 */
export function lidKeepoutRing(
  innerW: number,
  innerD: number,
  wallThickness: number
): LidKeepoutRing {
  // Distance from the interior centre out to the lip's inner face.
  const lipInset = wallThickness - GRIDFINITY_SPEC.LIP_BIG_TAPER;
  const outerHalfX = innerW / 2 + lipInset;
  const outerHalfY = innerD / 2 + lipInset;
  // Inward to the rail's deepest reach, plus clearance. Both are measured from
  // the INNER WALL FACE while the ring starts at the lip line, so the jut is
  // already spent: `lipInset` is negative and adding it shortens the width by
  // the head start. Subtracting it instead makes the ring 2x0.7mm too wide,
  // which cuts more divider than the lid needs and passes every geometry check.
  const width = railInboardReachMm(wallThickness) + LID_KEEPOUT_CLEARANCE + lipInset;
  return {
    outerHalfX,
    outerHalfY,
    width,
    depthBelowWallTop: LID_CLICK_RAIL_BAND_BELOW_WALL_TOP + LID_KEEPOUT_CLEARANCE,
    cornerRadius: Math.max(GRIDFINITY_SPEC.BOX_CORNER_RADIUS - GRIDFINITY_SPEC.LIP_BIG_TAPER, 0),
  };
}
