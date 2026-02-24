/**
 * Converts stored baseplate params (with ratios) into fully resolved
 * per-side padding values for the generation engine.
 */

import type { BaseplateParams as CoreBaseplateParams } from '@/core/types';
import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';

/**
 * Resolve a user-entered drawer dimension.
 * 0 means "derive from grid" — returns gridUnits × gridUnitMm.
 */
export function resolveDrawerMm(stored: number, gridUnits: number, gridUnitMm: number): number {
  return stored > 0 ? stored : gridUnits * gridUnitMm;
}

/**
 * Build full generation params from the stored per-layout config.
 *
 * Computes per-side padding from the drawer remainder and distribution ratio:
 * - remainder = drawerMm − gridUnits × gridUnitMm
 * - paddingStart = remainder × ratio
 * - paddingEnd   = remainder × (1 − ratio)
 */
export function buildFullParams(
  stored: CoreBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end'
): FullBaseplateParams {
  const drawerWmm = resolveDrawerMm(stored.drawerWidthMm, drawerWidth, gridUnitMm);
  const drawerDmm = resolveDrawerMm(stored.drawerDepthMm, drawerDepth, gridUnitMm);
  const remainderX = Math.max(0, drawerWmm - drawerWidth * gridUnitMm);
  const remainderY = Math.max(0, drawerDmm - drawerDepth * gridUnitMm);

  return {
    width: drawerWidth,
    depth: drawerDepth,
    gridUnitMm,
    magnetHoles: stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    paddingLeft: remainderX * stored.paddingRatioX,
    paddingRight: remainderX * (1 - stored.paddingRatioX),
    paddingFront: remainderY * stored.paddingRatioY,
    paddingBack: remainderY * (1 - stored.paddingRatioY),
    fractionalEdgeX,
    fractionalEdgeY,
  };
}
