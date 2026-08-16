/**
 * Pure placement math for split-baseplate pieces.
 *
 * The piece meshes are generated grid-centered with a Y-extent of
 * `depthUnits * gridUnitMmY` (see baseplateDirectMesh `totalD`), so the depth
 * (Y) slot MUST be sized with the Y pitch. Sizing it with the X pitch leaves a
 * residual per-row gap on non-square grids that accumulates across rows.
 */

import { EXPLODE_GAP_MM } from '../../constants';
import type { PieceMeshEntry, SplitViewMode } from '../../store/baseplatePageStore';

export interface PiecePlacement {
  readonly x: number;
  readonly y: number;
  readonly widthMm: number;
  readonly depthMm: number;
}

export interface PiecePlacementOptions {
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  readonly splitViewMode: SplitViewMode;
}

export function computePiecePlacement(
  entry: Pick<PieceMeshEntry, 'offsetX' | 'offsetY' | 'widthUnits' | 'depthUnits' | 'col' | 'row'>,
  opts: PiecePlacementOptions
): PiecePlacement {
  const { totalWidthMm, totalDepthMm, gridUnitMm, gridUnitMmY, splitViewMode } = opts;

  const widthMm = entry.widthUnits * gridUnitMm;
  const depthMm = entry.depthUnits * gridUnitMmY;

  const explodeX = splitViewMode === 'exploded' ? entry.col * EXPLODE_GAP_MM : 0;
  const explodeY = splitViewMode === 'exploded' ? entry.row * EXPLODE_GAP_MM : 0;

  const x = entry.offsetX * gridUnitMm + widthMm / 2 - totalWidthMm / 2 + explodeX;
  const y = entry.offsetY * gridUnitMmY + depthMm / 2 - totalDepthMm / 2 + explodeY;

  return { x, y, widthMm, depthMm };
}
