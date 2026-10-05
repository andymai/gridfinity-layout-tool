/**
 * Shell corrections the bin designer layers onto `standardBinSolidComponents`.
 *
 * That model is fitted to `OCCT_GROUND_TRUTH`, which is generated with the
 * default params: a lipped bin at {@link SHELL_REFERENCE_WALL_MM}. Its `walls`
 * term therefore already carries the real lip, and its `lip` term is only what
 * the three-term fit left over. Every figure here was measured on the exported
 * BREP solid (`exportBin` then `measureVolume`), 1x1x2u to 4x3x5u, walls 0.4 to
 * 2.4mm, lip on and off; the worst residual is 0.5%. The preview mesh is not a
 * substitute: below a 1mm wall its socket and box are separate overlapping
 * shells, so its signed volume counts the overlap twice.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { binFloorMm } from '@/features/bin-designer/types/base';

export const SHELL_REFERENCE_WALL_MM = 1.2;

/**
 * Height at the top of the cavity a thicker wall does not fill. Under a lip
 * the lip's inward overhang already occupies it, so most of the band is lost.
 */
const CAVITY_TOP_ALLOWANCE_MM = { lip: 2.35, open: 0.2 } as const;

/** Lip cross-section per mm of outer perimeter, and what the rounded corners take back. */
const LIP_SECTION_MM2 = 9.462;
const LIP_CORNER_DEFICIT_MM3 = 131;

function cavityVolume(
  outerW: number,
  outerD: number,
  wallHeight: number,
  wall: number,
  allowance: number
): number {
  const height = wallHeight - binFloorMm(wall) - allowance;
  if (height <= 0) return 0;
  const r = Math.max(GRIDFINITY.BOX_CORNER_RADIUS - wall, 0);
  const area =
    Math.max(0, outerW - 2 * wall) * Math.max(0, outerD - 2 * wall) - (4 - Math.PI) * r * r;
  return Math.max(0, area) * height;
}

/**
 * Material (mm³) a `wall`-thick shell holds beyond the reference wall: the
 * cavity it gives up, including the floor slab rising once the wall exceeds it.
 */
export function wallThicknessDelta(
  outerW: number,
  outerD: number,
  wallHeight: number,
  wall: number,
  stackingLip: boolean
): number {
  const allowance = stackingLip ? CAVITY_TOP_ALLOWANCE_MM.lip : CAVITY_TOP_ALLOWANCE_MM.open;
  return (
    cavityVolume(outerW, outerD, wallHeight, SHELL_REFERENCE_WALL_MM, allowance) -
    cavityVolume(outerW, outerD, wallHeight, wall, allowance)
  );
}

/** The stacking lip's own volume (mm³), measured as a lipped bin less its open twin. */
export function stackingLipVolume(outerW: number, outerD: number): number {
  return Math.max(0, LIP_SECTION_MM2 * 2 * (outerW + outerD) - LIP_CORNER_DEFICIT_MM3);
}
