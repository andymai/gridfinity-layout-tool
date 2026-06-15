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

  // Stack printing strips connectors AND magnet holes: connectors are
  // unsupportable overhangs in a vertical stack, and magnet pockets become
  // downward bridges when printed upside down (audited ~10% bridge area, vs 0%
  // for a magnet-free plate). Done here rather than by mutating stored params,
  // so the user's settings return intact when stacking is turned off.
  const stackingOn = stored.stackPrint?.enabled === true;

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
    connectorNubs: stackingOn ? false : stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stackingOn ? undefined : stored.connectorStyle,
    connectorFitOffset: stored.connectorFitOffset,
    lightweight: stored.lightweight,
    // Corner rounding only applies to the assembled drawer's outer corners, so
    // it makes the corner tiles differ from the rest. Stacking wants uniform,
    // interchangeable tiles, so square them off (also restored when off).
    cornerRadius: stackingOn ? 0 : stored.cornerRadius,
    cornerRadii: stackingOn ? undefined : stored.cornerRadii,
  };
}
