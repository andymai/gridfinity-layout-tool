/**
 * Resolve the mating geometry for a tray bin — a bin whose underside is a lid
 * instead of a Gridfinity base (`base.style === 'lid'`, #3036).
 *
 * Reuses `resolveLidInputs` by synthesising a `lid` config from
 * `base.trayBottom` rather than re-deriving the footprint: outer size, corner
 * radius, fit clearance, overhang expansion and the magnetic clearance relief
 * are all subtle and already correct there, and duplicating them is how the two
 * joints would drift apart and stop printing the same.
 *
 * The reuse is sound because the footprints line up exactly: a bin body is
 * `width * gridUnit - CLEARANCE` (0.5mm) and a lid is
 * `width * gridUnit - 2 * LID_FIT_CLEARANCE` (2 x 0.25mm). Same number, so the
 * shell fuses under the body with nothing to reconcile.
 */

import {
  DEFAULT_LID_CONFIG,
  DEFAULT_TRAY_BOTTOM,
  LID_FIT_CLEARANCE,
  trayBottomSkirtDepth as skirtDepth,
} from '@/shared/types/bin';

import type { BinParams } from '@/shared/types/bin';
import { hasAnyClickRail } from './lidClickRail';
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
 * `wallBottomZ` alone is not enough: click rails hang below the mating wall,
 * and leaving them out sinks the model 3.75mm under the print bed. Retention
 * bosses do the same on a magnetic joint — they reach past the skirt to clear
 * the pads they mate with (#3450).
 */
export function trayBottomSkirtDepth(inputs: LidInputs): number {
  // LID_FIT_CLEARANCE, not `inputs.fitClearance`: the magnetic relief is
  // XY-only, and `resolveLidInputs` derives `wallBottomZ` from the base value
  // for the same reason. Feeding the relieved value here would lift the seated
  // plane into the corner magnets' seat gap.
  return skirtDepth(
    inputs.heightUnitMm,
    LID_FIT_CLEARANCE,
    inputs.cavityExtraMm,
    hasAnyClickRail(inputs.clickRails),
    inputs.retentionMagnets ? inputs.retentionMagnetDepth : null
  );
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
    // Same reasoning as `disabledRails`: the tab geometry lives on the covered
    // bin's design, not this tray's, so reading this tray's labels would clip
    // rails against a shelf on the wrong part.
    labelFootprints: [],
  };
}
