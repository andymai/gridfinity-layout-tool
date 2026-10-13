import { LID_CORNER_RADIUS } from '@/features/bin-designer/types';
import type { BinParams } from '@/features/bin-designer/types';
import { isNestingBase } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { isLiteFloorOpen, resolveBinFloorMm } from '@/shared/utils/slotMath';
import { binDimensions, expandInteriorForOverhang } from './binDimensions';

export interface InteriorDimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

/**
 * Width and depth of the opening a Nesting body cuts down to its bed-level
 * floor. It sits `LID_CORNER_RADIUS` in from the footprint, inside the cavity
 * the wall encloses above it, so it is the narrowest part.
 */
function nestingMouth(params: BinParams): { widthMm: number; depthMm: number } {
  const { innerW, innerD } = expandInteriorForOverhang(
    params.width * params.gridUnitMm - 2 * LID_CORNER_RADIUS,
    params.depth * (params.gridUnitMmY ?? params.gridUnitMm) - 2 * LID_CORNER_RADIUS,
    params.overhang,
    params.cellMask
  );
  return { widthMm: innerW, depthMm: innerD };
}

/**
 * Clear size of the empty cavity: floor top to wall top, wall to wall.
 *
 * Width and depth are the narrowest the cavity gets, so an overhang's wider
 * upper cavity is not counted. Height stops at the wall top; the stacking lip
 * rises above it. Mirrors `deriveDimensions` (`wallTopZ` less the floor top);
 * `interiorDimensions.test.ts` holds the two together.
 *
 * Null when there is no single closed cavity to measure: a solid block, a
 * base-only plate, an open lightweight floor, or a non-rectangular footprint.
 */
export function binInteriorDimensions(params: BinParams): InteriorDimensions | null {
  if (params.base.solid || isLiteFloorOpen(params) || isPartialMask(params.cellMask)) return null;

  const { innerW, innerD, wallHeight, floorZ } = binDimensions(params);
  if (wallHeight <= 0) return null;

  const rawCollar = params.extraWallHeightMm ?? 0;
  const collarMm = Number.isFinite(rawCollar) ? Math.max(0, rawCollar) : 0;
  const floorMm = resolveBinFloorMm(params);
  // A Nesting body drops its floor onto the bed, under the skirt every other
  // lid-mating base seats its floor on.
  const floorTopZ = isNestingBase(params.base) ? floorMm : floorZ + floorMm;
  const heightMm = floorZ + wallHeight + collarMm - floorTopZ;
  const mouth = isNestingBase(params.base) ? nestingMouth(params) : null;
  const widthMm = Math.min(innerW, mouth?.widthMm ?? innerW);
  const depthMm = Math.min(innerD, mouth?.depthMm ?? innerD);
  if (widthMm <= 0 || depthMm <= 0 || heightMm <= 0) return null;

  return { widthMm, depthMm, heightMm };
}
