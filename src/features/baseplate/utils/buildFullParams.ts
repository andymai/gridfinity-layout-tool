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
  fractionalEdgeY: 'start' | 'end'
): FullBaseplateParams {
  const synced = stored.syncWithLayout !== false;
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);

  return {
    width,
    depth,
    gridUnitMm,
    magnetHoles: stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    paddingLeft: stored.paddingLeft,
    paddingRight: stored.paddingRight,
    paddingFront: stored.paddingFront,
    paddingBack: stored.paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    overTile: stored.overTile,
    connectorNubs: stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stored.connectorStyle,
    lightweight: stored.lightweight,
    cornerRadius: stored.cornerRadius,
    cornerRadii: stored.cornerRadii,
  };
}
