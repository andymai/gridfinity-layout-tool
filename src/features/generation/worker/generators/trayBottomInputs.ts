/**
 * Resolve the mating geometry for a tray bin — a bin whose underside is a lid
 * instead of a Gridfinity base (`base.style === 'lid'`, issue #3036).
 *
 * Deliberately reuses `resolveLidInputs` by synthesising the `lid` config from
 * `base.trayBottom` rather than re-deriving the footprint. Outer size, corner
 * radius, fit clearance, overhang expansion and the magnetic clearance relief
 * are all subtle and already correct there; duplicating them is how the two
 * joints would drift apart and stop printing the same.
 *
 * The footprints line up exactly, which is what makes this reuse sound: a bin
 * body is `width * gridUnit - CLEARANCE` (0.5mm) and a lid is
 * `width * gridUnit - 2 * LID_FIT_CLEARANCE` (2 x 0.25mm). Same number, so the
 * shell fuses under the body with nothing to reconcile.
 */

import { DEFAULT_LID_CONFIG, DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import { CLICK_RAIL_DROP_BELOW_WALL } from './lidClickRail';
import { resolveLidInputs } from './lidInputs';
import type { LidInputs } from './lidInputs';

/**
 * `BinParams` shaped so `resolveLidInputs` reads the tray's mating config.
 *
 * `base.stackingLip: true` is forced, and is NOT the tray's own lip. The field
 * answers "does the thing I mate with have a stacking lip", and for a tray
 * bottom the answer is yes by construction: `shouldGenerateLid` refuses to
 * build any lid for a lip-less bin, so a lip-less bin cannot be capped at all.
 * The tray's real `base.stackingLip` describes its own TOP and stays free, so
 * an ordinary Gridfinity bin can still stack on top of a tray.
 */
function trayBottomParams(params: BinParams): BinParams {
  const trayBottom = params.base.trayBottom ?? DEFAULT_TRAY_BOTTOM;
  return {
    ...params,
    base: { ...params.base, stackingLip: true },
    lid: {
      ...DEFAULT_LID_CONFIG,
      enabled: true,
      attachment: trayBottom.attachment,
      extraHeightMm: trayBottom.extraHeightMm,
      clickRails: trayBottom.clickRails,
      clickRailCoverage: trayBottom.clickRailCoverage,
      retentionMagnet: trayBottom.retentionMagnet,
      // A tray's top surface is its own compartment interior, so none of the
      // lid's top-face features exist here. Forced off rather than left to the
      // caller so a crafted payload cannot grow a stack grid under a bin floor.
      stackableTop: false,
      separateStackPlate: false,
      magnetHoles: false,
      tray: { ...DEFAULT_LID_CONFIG.tray, enabled: false },
    },
  };
}

/**
 * How far the skirt hangs below the tray's floor, i.e. how far the whole bin
 * must be lifted for Z=0 to remain the absolute bottom.
 *
 * `wallBottomZ` is not enough on its own: click rails hang below the mating
 * wall, which is exactly the mistake this function exists to stop anyone
 * repeating (the model sank 3.75mm under the bed until the geometry test
 * caught it).
 */
export function trayBottomSkirtDepth(inputs: LidInputs): number {
  const { clickRails } = inputs;
  const anyRail = clickRails.front || clickRails.back || clickRails.left || clickRails.right;
  return -inputs.wallBottomZ + (anyRail ? CLICK_RAIL_DROP_BELOW_WALL : 0);
}

export function resolveTrayBottomInputs(params: BinParams): LidInputs {
  return {
    ...resolveLidInputs(trayBottomParams(params)),
    // `computeDisabledRails` suppresses rails on sides where the COVERED bin's
    // features (label tabs, wall cutouts, handles) intrude into the lip zone.
    // A tray is a separate design from the bin it caps, so those features are
    // unknowable here — deriving them from the tray's own walls would disable
    // rails because of geometry on the wrong part. The user's per-side choice
    // stands.
    disabledRails: new Set(),
  };
}
