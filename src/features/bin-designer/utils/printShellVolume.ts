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
import type { TrayBottomConfig } from '@/features/bin-designer/types/base';
import { LID_CORNER_RADIUS, LID_FIT_CLEARANCE } from '@/features/bin-designer/types/lid';

export const SHELL_REFERENCE_WALL_MM = 1.2;

/** The floor the reference shell was measured with: a socketed bin's. */
const SHELL_REFERENCE_FLOOR_MM = binFloorMm(SHELL_REFERENCE_WALL_MM, 'standard', 0);

/**
 * Height at the top of the cavity a thicker wall does not fill. Under a lip
 * the lip's inward overhang already occupies it, so most of the band is lost.
 */
const CAVITY_TOP_ALLOWANCE_MM = { lip: 2.35, open: 0.2 } as const;

/** Lip cross-section per mm of outer perimeter, and what the rounded corners take back. */
const LIP_SECTION_MM2 = 9.462;
const LIP_CORNER_DEFICIT_MM3 = 131;

/**
 * A tray bin's lid skirt, measured as the tray less a flat bin on the same
 * floor: linear in the outer perimeter from 1x1 to 4x4, worst residual
 * 0.04mm³. A nesting tray measures the same, its bed floor standing in for the
 * body floor it opens.
 */
const TRAY_SKIRT_SECTION_MM2 = 16.498;
const TRAY_SKIRT_CORNER_DEFICIT_MM3 = 334.5;

/** The 0.15mm mate relief that click rails and retention magnets both cut. */
const TRAY_MATE_RELIEF_SECTION_MM2 = 0.698;
const TRAY_MATE_RELIEF_CORNER_MM3 = 16.8;

/** Per mm of the rail each wall gets, its coverage share of the run between corners. */
const TRAY_RAIL_SECTION_MM2 = 7.345;

/** One retention magnet's boss less its pocket, at the default magnet size. */
const TRAY_MAGNET_MM3 = { raised: 174.7, nesting: 92.4 } as const;

function roundedRectArea(w: number, d: number, r: number): number {
  return Math.max(0, w) * Math.max(0, d) - (4 - Math.PI) * r * r;
}

function cavityArea(outerW: number, outerD: number, wall: number): number {
  const r = Math.max(GRIDFINITY.BOX_CORNER_RADIUS - wall, 0);
  return Math.max(0, roundedRectArea(outerW - 2 * wall, outerD - 2 * wall, r));
}

function cavityVolume(
  outerW: number,
  outerD: number,
  wallHeight: number,
  wall: number,
  floor: number,
  allowance: number
): number {
  const height = wallHeight - floor - allowance;
  if (height <= 0) return 0;
  return cavityArea(outerW, outerD, wall) * height;
}

/**
 * Material (mm³) a `wall`-thick shell on a `floor`-thick floor holds beyond the
 * reference shell: the cavity it gives up, or gains back where its floor is
 * thinner than the reference's.
 */
export function wallThicknessDelta(
  outerW: number,
  outerD: number,
  wallHeight: number,
  wall: number,
  floor: number,
  stackingLip: boolean
): number {
  const allowance = stackingLip ? CAVITY_TOP_ALLOWANCE_MM.lip : CAVITY_TOP_ALLOWANCE_MM.open;
  return (
    cavityVolume(
      outerW,
      outerD,
      wallHeight,
      SHELL_REFERENCE_WALL_MM,
      SHELL_REFERENCE_FLOOR_MM,
      allowance
    ) - cavityVolume(outerW, outerD, wallHeight, wall, floor, allowance)
  );
}

/** The stacking lip's own volume (mm³), measured as a lipped bin less its open twin. */
export function stackingLipVolume(outerW: number, outerD: number): number {
  return Math.max(0, LIP_SECTION_MM2 * 2 * (outerW + outerD) - LIP_CORNER_DEFICIT_MM3);
}

/**
 * A flat bin's whole shell (mm³), and a tray bin's above its skirt, standing in
 * for the fitted model rather than correcting it: that model's `base` term is a
 * socket and its 7mm dead space, neither of which a socketless bin has.
 *
 * The body is exact, the outer box less the cavity above the floor. The lip is
 * the socketed bin's lip, plus or minus the cavity band its inward overhang
 * fills as the wall moves off the reference.
 */
export function flatShellVolume(
  outerW: number,
  outerD: number,
  height: number,
  wall: number,
  floor: number,
  stackingLip: boolean
): number {
  const cavity = cavityArea(outerW, outerD, wall);
  const outer = Math.max(0, roundedRectArea(outerW, outerD, GRIDFINITY.BOX_CORNER_RADIUS));
  const body = outer * height - cavity * Math.max(0, height - floor);
  if (!stackingLip) return body;
  const lipBand = CAVITY_TOP_ALLOWANCE_MM.lip - CAVITY_TOP_ALLOWANCE_MM.open;
  const reference = cavityArea(outerW, outerD, SHELL_REFERENCE_WALL_MM);
  return body + stackingLipVolume(outerW, outerD) + lipBand * (cavity - reference);
}

/**
 * What a tray bin's lid skirt adds under its {@link flatShellVolume} body (mm³),
 * for a `tray` already through `resolveTrayBottomConfig`. Extra skirt depth is
 * the lid wall's own ring, the lid cavity's inset thick.
 */
export function traySkirtVolume(
  outerW: number,
  outerD: number,
  tray: TrayBottomConfig,
  magnetCount: number
): number {
  const perimeter = 2 * (outerW + outerD);
  const inset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
  const ring =
    roundedRectArea(outerW, outerD, GRIDFINITY.BOX_CORNER_RADIUS) -
    roundedRectArea(
      outerW - 2 * inset,
      outerD - 2 * inset,
      Math.max(0, GRIDFINITY.BOX_CORNER_RADIUS - inset)
    );
  let volume =
    TRAY_SKIRT_SECTION_MM2 * perimeter -
    TRAY_SKIRT_CORNER_DEFICIT_MM3 +
    Math.max(0, ring) * Math.max(0, tray.extraHeightMm);

  const rails = tray.clickRails;
  const railRun = (side: number): number =>
    (tray.clickRailCoverage / 100) * Math.max(0, side - 2 * LID_CORNER_RADIUS);
  const railLength =
    tray.attachment === 'clickRails'
      ? (rails.front ? railRun(outerW) : 0) +
        (rails.back ? railRun(outerW) : 0) +
        (rails.left ? railRun(outerD) : 0) +
        (rails.right ? railRun(outerD) : 0)
      : 0;
  const magnetic = tray.attachment === 'magnetic';
  if (railLength > 0 || magnetic) {
    volume += TRAY_MATE_RELIEF_CORNER_MM3 - TRAY_MATE_RELIEF_SECTION_MM2 * perimeter;
  }
  volume += TRAY_RAIL_SECTION_MM2 * railLength;
  if (magnetic) {
    volume += magnetCount * TRAY_MAGNET_MM3[tray.floorAtBed === true ? 'nesting' : 'raised'];
  }
  return volume;
}
