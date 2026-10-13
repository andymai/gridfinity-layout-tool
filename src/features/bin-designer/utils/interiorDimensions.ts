import type { BinParams } from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import { isLiteFloorOpen, resolveBinFloorMm } from '@/shared/utils/slotMath';
import { binDimensions } from './binDimensions';

export interface InteriorDimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

/**
 * Clear size of the empty cavity: floor top to wall top, wall to wall.
 *
 * Width and depth are the narrowest the cavity gets, so an overhang's wider
 * upper cavity is not counted. Height stops at the wall top; the stacking lip
 * rises above it. Mirrors `deriveDimensions` (`wallTopZ` less
 * `baseOffsetZ + floorThickness`); `interiorDimensions.test.ts` holds
 * the two together.
 *
 * Null when there is no single closed cavity to measure: a solid block, a
 * base-only plate, an open lightweight floor, or a non-rectangular footprint.
 */
export function binInteriorDimensions(params: BinParams): InteriorDimensions | null {
  if (params.base.solid || isLiteFloorOpen(params) || isPartialMask(params.cellMask)) return null;

  const { innerW, innerD, wallHeight } = binDimensions(params);
  if (wallHeight <= 0) return null;

  const rawCollar = params.extraWallHeightMm ?? 0;
  const collarMm = Number.isFinite(rawCollar) ? Math.max(0, rawCollar) : 0;
  const heightMm = wallHeight + collarMm - resolveBinFloorMm(params);
  if (innerW <= 0 || innerD <= 0 || heightMm <= 0) return null;

  return { widthMm: innerW, depthMm: innerD, heightMm };
}
