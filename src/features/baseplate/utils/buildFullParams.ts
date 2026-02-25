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
  return {
    width: drawerWidth,
    depth: drawerDepth,
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
    ...(stored.connectorNubs !== undefined ? { connectorNubs: stored.connectorNubs } : {}),
  };
}
