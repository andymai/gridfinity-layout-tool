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
import type { BinParams, OverhangConfig } from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { CellMask } from '@/shared/utils/cellMask';

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

export interface CutoutInterior {
  /** Interior cavity width in mm, overhang folded in. */
  readonly innerW: number;
  /** Interior cavity depth in mm, overhang folded in. */
  readonly innerD: number;
  /**
   * X shift (mm, +X) of the expanded cavity center inside the outer body when
   * opposite overhang sides differ. Zero for symmetric/absent overhang. Only
   * model-space consumers (the 3D ghost) need it; the flat 2D cutout editor
   * works in the offset-free `[0, innerW]` in-cavity frame.
   */
  readonly offsetX: number;
  /** Y shift (mm, +Y) of the expanded cavity center. See {@link offsetX}. */
  readonly offsetY: number;
}

/**
 * Interior cavity with any per-side {@link BinParams.overhang} folded in — the
 * floor area cutouts can actually occupy.
 *
 * Overhang grows the bin body outward, so the interior floor grows in lockstep;
 * the cutout coordinate frame runs `[0, innerW] × [0, innerD]` over that
 * expanded floor (cutout `x`/`y` are relative to the expanded interior's
 * bottom-left corner, exactly as the generator places them).
 *
 * Mirrors the generator's derivation in
 * `generation/worker/generators/pipeline/context.ts`: an absent or disabled
 * overhang leaves the interior nominal, overhang is suppressed for polygon
 * masks (the mask defines its own footprint), negative side values clamp to
 * zero, and the asymmetry offset is `(right − left) / 2` / `(back − front) / 2`.
 */
export function cutoutInterior(params: BinParams): CutoutInterior {
  const { innerW, innerD } = binDimensions(params);
  return expandInteriorForOverhang(innerW, innerD, params.overhang, params.cellMask);
}

/**
 * Fold overhang into a nominal interior. Lower-level than {@link cutoutInterior}
 * for callers that already hold the nominal `innerW`/`innerD` (e.g. the 3D ghost
 * overlay, which derives them inline). Single source for the overhang math so
 * the editor and the ghost can't drift.
 */
export function expandInteriorForOverhang(
  innerW: number,
  innerD: number,
  overhang: OverhangConfig | undefined,
  cellMask: CellMask | undefined
): CutoutInterior {
  if (!overhang || overhang.enabled === false || isPartialMask(cellMask)) {
    return { innerW, innerD, offsetX: 0, offsetY: 0 };
  }
  const left = Math.max(0, overhang.left);
  const right = Math.max(0, overhang.right);
  const front = Math.max(0, overhang.front);
  const back = Math.max(0, overhang.back);
  return {
    innerW: innerW + left + right,
    innerD: innerD + front + back,
    offsetX: (right - left) / 2,
    offsetY: (back - front) / 2,
  };
}
