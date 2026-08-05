/**
 * Derive a tray bin that caps a given bin (issue #3036).
 *
 * A tray is a separate design from the bin it covers, which is what lets it
 * carry the whole editor. The cost of that separation is that nothing
 * guarantees the two fit: a lid's footprint is normally derived from its own
 * design's bin, and here it cannot be. This function is that guarantee —
 * everything the joint depends on is copied from the source rather than
 * retyped, so a mismatch takes deliberate effort instead of one forgotten
 * field.
 */

import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { DEFAULT_LID_CONFIG } from '../types/lid';
import { DEFAULT_TRAY_BOTTOM } from '../types/base';
import type { BinParams } from '../types';

/** Shallow enough to be a tray, tall enough to hold something. */
export const MATCHING_TRAY_HEIGHT_UNITS = 2;

export function matchingTrayParams(source: BinParams): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    // Footprint and grid: the mating shell is sized from these, so they are
    // the fields that actually decide whether the tray seats.
    width: source.width,
    depth: source.depth,
    gridUnitMm: source.gridUnitMm,
    gridUnitMmY: source.gridUnitMmY,
    heightUnitMm: source.heightUnitMm,
    fractionalEdgeX: source.fractionalEdgeX,
    fractionalEdgeY: source.fractionalEdgeY,
    fractionalEdgeManualX: source.fractionalEdgeManualX,
    fractionalEdgeManualY: source.fractionalEdgeManualY,
    // A polygon footprint has to carry over too, or the tray is a rectangle
    // over a shaped bin.
    ...(source.cellMask ? { cellMask: source.cellMask } : {}),
    height: MATCHING_TRAY_HEIGHT_UNITS,
    base: {
      ...DEFAULT_BIN_PARAMS.base,
      style: 'lid',
      // The tray is the top piece, so it starts without a lip of its own. The
      // user can add one to stack something further on top.
      stackingLip: false,
      trayBottom: {
        ...DEFAULT_TRAY_BOTTOM,
        // Take the joint from the source's lid config when it has one, so a
        // bin already set up for click rails gets a tray that clicks.
        attachment: source.lid.attachment,
        clickRails: source.lid.clickRails,
        clickRailCoverage: source.lid.clickRailCoverage,
        retentionMagnet: source.lid.retentionMagnet,
      },
    },
    // The tray's own lid is off: it is the lid.
    lid: { ...DEFAULT_LID_CONFIG },
  };
}
