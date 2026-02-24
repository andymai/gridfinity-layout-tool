/**
 * Converts stored baseplate params into fully resolved generation params.
 *
 * With direct per-side padding, the conversion is a straightforward pass-through.
 * The centered-params variant still exists for the preview optimization:
 * BREP geometry is generated with symmetric padding, and the asymmetric offset
 * is applied in Three.js.
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
  };
}

/**
 * Build generation params with centered padding.
 *
 * For preview, the BREP geometry is identical regardless of how padding is
 * distributed — only the slab dimensions (total per axis) matter. By always
 * generating centered, we can skip BREP regeneration when only the distribution
 * changes and apply the offset in Three.js instead.
 *
 * Returns both the centered params and the slab offset for the actual distribution.
 */
export function buildCenteredParams(
  stored: CoreBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end'
): { params: FullBaseplateParams; slabOffsetX: number; slabOffsetY: number } {
  const halfX = (stored.paddingLeft + stored.paddingRight) / 2;
  const halfY = (stored.paddingFront + stored.paddingBack) / 2;

  return {
    params: {
      width: drawerWidth,
      depth: drawerDepth,
      gridUnitMm,
      magnetHoles: stored.magnetHoles,
      magnetDiameter: stored.magnetDiameter,
      magnetDepth: stored.magnetDepth,
      paddingLeft: halfX,
      paddingRight: halfX,
      paddingFront: halfY,
      paddingBack: halfY,
      fractionalEdgeX,
      fractionalEdgeY,
    },
    slabOffsetX: (stored.paddingLeft - stored.paddingRight) / 2,
    slabOffsetY: (stored.paddingFront - stored.paddingBack) / 2,
  };
}
