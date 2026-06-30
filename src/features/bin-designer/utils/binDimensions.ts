/**
 * Canonical bin-dimension derivations.
 *
 * Every UI, validator, and overlay that needs `outerW`, `innerW`, `totalH`,
 * `wallHeight`, or `floorZ` derives them through this helper instead of
 * re-deriving from `GRIDFINITY.GRID_SIZE` directly. That keeps the editor,
 * the ghost overlays, the validator, and the BREP generator in lockstep
 * when the user changes `params.gridUnitMm` / `params.heightUnitMm` via
 * Physical Units.
 *
 * The mesh generator's reference derivation lives in
 * `splitBinBuilder.ts` (`floorZ = isFlat ? 0 : SOCKET_HEIGHT`) — this
 * helper mirrors that contract so previews and validators don't drift.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';

export interface BinDimensions {
  /** Outer bin width in mm (XY footprint, includes tolerance) */
  readonly outerW: number;
  /** Outer bin depth in mm */
  readonly outerD: number;
  /** Interior cavity width in mm (outerW − 2 × wallThickness) */
  readonly innerW: number;
  /** Interior cavity depth in mm */
  readonly innerD: number;
  /** Total bin height in mm (height units × heightUnitMm) */
  readonly totalH: number;
  /**
   * Wall height in mm — the vertical extent of the side walls.
   * For socketed bins this excludes the socket (totalH − SOCKET_HEIGHT);
   * for flat-base bins it equals totalH.
   */
  readonly wallHeight: number;
  /**
   * Z of the cavity floor in mm. Matches the generator's coordinate
   * system: socketed bins have their floor at SOCKET_HEIGHT (5mm) above
   * the world origin; flat bins sit on the floor at z=0.
   */
  readonly floorZ: number;
  /** True when params.base.style === 'flat' (no socket profile) */
  readonly isFlat: boolean;
}

/**
 * Derive every dimension that downstream code needs from a `BinParams`.
 *
 * Pure function — safe to call inline in render paths (no allocations
 * beyond the result object). Callers that need only one field should
 * still call this rather than recomputing, so the math stays canonical.
 */
export function binDimensions(params: BinParams): BinDimensions {
  // Y axis uses gridUnitMmY when set (non-square grid); otherwise it equals the
  // X pitch, so square bins are unchanged.
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * params.wallThickness;
  const innerD = outerD - 2 * params.wallThickness;
  const totalH = params.height * params.heightUnitMm;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const floorZ = isFlat ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  return { outerW, outerD, innerW, innerD, totalH, wallHeight, floorZ, isFlat };
}
