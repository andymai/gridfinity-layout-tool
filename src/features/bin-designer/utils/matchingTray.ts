/**
 * Derive a tray bin that caps a given bin.
 *
 * A tray is a separate design from the bin it covers, which is what lets it
 * carry the whole editor — and the cost is that nothing structural guarantees
 * the two fit. Every field the joint is sized from is copied from the source
 * here rather than retyped, so a mismatch takes deliberate effort instead of
 * one forgotten field.
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
    width: source.width,
    depth: source.depth,
    gridUnitMm: source.gridUnitMm,
    gridUnitMmY: source.gridUnitMmY,
    heightUnitMm: source.heightUnitMm,
    fractionalEdgeX: source.fractionalEdgeX,
    fractionalEdgeY: source.fractionalEdgeY,
    fractionalEdgeManualX: source.fractionalEdgeManualX,
    fractionalEdgeManualY: source.fractionalEdgeManualY,
    // Spread conditionally: a rectangular source has no mask, and writing the
    // key as `undefined` would add it to the params hash.
    ...(source.cellMask ? { cellMask: source.cellMask } : {}),
    // `resolveLidInputs` grows the mating shell by the overhang, so a tray
    // built to the nominal footprint will not seat over an overhung bin.
    overhang: source.overhang,
    height: MATCHING_TRAY_HEIGHT_UNITS,
    base: {
      ...DEFAULT_BIN_PARAMS.base,
      style: 'lid',
      // The tray is the top piece; the user can add a lip back to stack
      // something further on top.
      stackingLip: false,
      trayBottom: {
        ...DEFAULT_TRAY_BOTTOM,
        attachment: source.lid.attachment,
        clickRails: source.lid.clickRails,
        clickRailCoverage: source.lid.clickRailCoverage,
        retentionMagnet: source.lid.retentionMagnet,
      },
    },
    // The tray IS the lid, so it gets none of its own.
    lid: DEFAULT_LID_CONFIG,
  };
}
