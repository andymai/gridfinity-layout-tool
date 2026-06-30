/**
 * Converts stored baseplate params into fully resolved generation params.
 *
 * With direct per-side padding, the conversion is a straightforward pass-through.
 */

import type { BaseplateParams as CoreBaseplateParams } from '@/core/types';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

/**
 * Build full generation params from the stored per-layout config.
 */
export function buildFullParams(
  stored: CoreBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end',
  nozzleSizeMm?: number
): FullBaseplateParams {
  const synced = stored.syncWithLayout !== false;
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);

  // Stack printing flips every plate above the bottom upside down. Magnet
  // pockets become downward bridges when flipped (audited ~10% bridge area, vs
  // 0% for a magnet-free plate), and corner rounding makes corner tiles differ
  // from the rest, so both are stripped. Dovetail connectors survive: tongues,
  // grooves, and the dovetail key are full-height vertical prisms that flip
  // cleanly. Only snap clip is incompatible — its blind top pocket (sealed
  // floor + undercut ledge) inverts into a downward bridge/overhang — so it
  // alone is stripped. Done here rather than by mutating stored params, so the
  // user's settings return intact when stacking is turned off.
  const stackingOn = stored.stackPrint?.enabled === true;
  const stripConnectors = stackingOn && stored.connectorStyle === 'snapClip';
  // Detach is mutually exclusive with stacking (stacking wins). Padding stays at
  // its stored values here — `emitMargins` and the camera/dimension overlay need
  // the true outer extent; the body mesh zeroes detached sides downstream.
  const detachMargins = stored.detachMargins === true && !stackingOn;

  return {
    width,
    depth,
    gridUnitMm,
    nozzleSizeMm,
    magnetHoles: stackingOn ? false : stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    paddingLeft: stored.paddingLeft,
    paddingRight: stored.paddingRight,
    paddingFront: stored.paddingFront,
    paddingBack: stored.paddingBack,
    fractionalEdgeX: synced ? fractionalEdgeX : (stored.fractionalEdgeX ?? 'end'),
    fractionalEdgeY: synced ? fractionalEdgeY : (stored.fractionalEdgeY ?? 'end'),
    overTile: stored.overTile,
    // Half-grid is meaningless without over-tile; normalize so an orphaned flag
    // can't fragment caches or trigger needless regeneration.
    overTileHalfGrid: stored.overTile === true ? stored.overTileHalfGrid : undefined,
    connectorNubs: stripConnectors ? false : stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stripConnectors ? undefined : stored.connectorStyle,
    connectorFitOffset: stored.connectorFitOffset,
    lightweight: stored.lightweight,
    // Corner rounding only applies to the assembled drawer's outer corners, so
    // it makes the corner tiles differ from the rest. Stacking wants uniform,
    // interchangeable tiles, so square them off (also restored when off).
    cornerRadius: stackingOn ? 0 : stored.cornerRadius,
    cornerRadii: stackingOn ? undefined : stored.cornerRadii,
    detachMargins,
  };
}
