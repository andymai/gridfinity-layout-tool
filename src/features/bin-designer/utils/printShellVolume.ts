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
import {
  DEFAULT_LID_CONFIG,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_MAGNETIC_EXTRA_CLEARANCE,
  LID_MIN_RAIL_LENGTH,
  LID_SNAP_PLUG_CLEARANCE,
  lidAnchorZ,
  lidWallBottomZ,
  plugInsetAtWallBottom,
  resolveLidCavityExtraMm,
  trayBottomSkirtDepth,
} from '@/features/bin-designer/types/lid';
import { roundedRectArea, type ShellFootprint } from './printFootprint';

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

/** Simpson panels per straight run of the lid's mating profile. */
const SHELL_PANELS = 4;

/** A click rail's cross-section. */
const TRAY_RAIL_SECTION_MM2 = 7.345;

/** One retention magnet's boss less its pocket, at the default magnet size. */
const TRAY_MAGNET_MM3 = { raised: 174.7, nesting: 92.4 } as const;

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
 * The body is exact, the outline less the cavity above the floor. The lip is
 * the socketed bin's lip, plus or minus the cavity band its inward overhang
 * fills as the wall moves off the reference.
 */
export function flatShellVolume(
  footprint: ShellFootprint,
  height: number,
  wall: number,
  floor: number,
  stackingLip: boolean
): number {
  const box = GRIDFINITY.BOX_CORNER_RADIUS;
  const cavity = footprint.section(wall, Math.max(box - wall, 0));
  const body = footprint.section(0, box) * height - cavity * Math.max(0, height - floor);
  if (!stackingLip) return body;
  const lipBand = CAVITY_TOP_ALLOWANCE_MM.lip - CAVITY_TOP_ALLOWANCE_MM.open;
  const reference = footprint.section(
    SHELL_REFERENCE_WALL_MM,
    Math.max(box - SHELL_REFERENCE_WALL_MM, 0)
  );
  // A capped corner sweeps the lip round a tighter arc, which gives back the
  // section's (8 - 2π) share of the deficit for every mm the radius loses.
  const deficit =
    LIP_CORNER_DEFICIT_MM3 - LIP_SECTION_MM2 * (8 - 2 * Math.PI) * (box - footprint.cornerRadius);
  const lip = Math.max(0, LIP_SECTION_MM2 * footprint.lipPerimeter - deficit * footprint.turning);
  return body + lip + lipBand * (cavity - reference);
}

/**
 * The lid's mating shell under a tray (mm³): the outer loft less the cavity
 * cut, integrated section by section over the profile `buildMatingShell`
 * lofts. Sections rather than a rate per mm of perimeter, because on a
 * footprint narrower than the shell is thick the opposite walls merge, and a
 * capped corner rounds less than the lid's full radius.
 */
function matingShellVolume(
  footprint: ShellFootprint,
  heightUnitMm: number,
  cavityExtraMm: number,
  mateRelief: number
): number {
  const cavityInset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
  const anchorZ = lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtraMm);
  const wallBottomZ = lidWallBottomZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtraMm);
  const plugInset = GRIDFINITY.LIP_BIG_TAPER + mateRelief;
  const bottomInset = plugInsetAtWallBottom(mateRelief);
  const chamferTopZ = anchorZ + mateRelief * Math.SQRT2;
  const profile: ReadonlyArray<readonly [z: number, inset: number]> = [
    [wallBottomZ, bottomInset],
    ...(bottomInset > plugInset
      ? [[wallBottomZ + bottomInset - plugInset, plugInset] as const]
      : []),
    [chamferTopZ - plugInset, plugInset],
    [chamferTopZ, 0],
    [0, 0],
  ];
  const lidSection = (inset: number): number =>
    footprint.outerSection(inset, Math.max(0, cavityInset - inset));
  const cavity = lidSection(cavityInset);
  const ring = (inset: number): number => Math.max(0, lidSection(inset) - cavity);

  let volume = 0;
  for (let i = 1; i < profile.length; i++) {
    const [z0, from] = profile[i - 1];
    const [z1, to] = profile[i];
    if (z1 <= z0) continue;
    let sum = ring(from) + ring(to);
    for (let k = 1; k < SHELL_PANELS; k++) {
      sum += (k % 2 === 1 ? 4 : 2) * ring(from + ((to - from) * k) / SHELL_PANELS);
    }
    volume += ((z1 - z0) / SHELL_PANELS / 3) * sum;
  }
  return volume;
}

/**
 * The tray's own joint, scoped as `trayFloorZ` scopes it, so a lid chosen for
 * the top cannot reshape the skirt.
 */
function trayCavityExtraMm(tray: TrayBottomConfig, heightUnitMm: number): number {
  return resolveLidCavityExtraMm({
    lid: {
      ...DEFAULT_LID_CONFIG,
      attachment: tray.attachment,
      extraHeightMm: tray.extraHeightMm,
      retentionMagnet: tray.retentionMagnet,
    },
    base: { stackingLip: true, magnetDepth: 0 },
    heightUnitMm,
  });
}

/**
 * What a tray bin's lid skirt adds under its {@link flatShellVolume} body (mm³),
 * for a `tray` already through `resolveTrayBottomConfig`.
 *
 * A rail shorter than the minimum is one the lid builder drops, but the relief
 * follows the rail toggles, so a wall too short for its rail is still relieved.
 */
export function traySkirtVolume(
  footprint: ShellFootprint,
  tray: TrayBottomConfig,
  magnetCount: number,
  heightUnitMm: number
): number {
  const railed = tray.attachment === 'clickRails';
  let railLength = 0;
  if (railed) {
    for (const edge of footprint.railEdges) {
      if (!tray.clickRails[edge.side]) continue;
      const rail =
        (tray.clickRailCoverage / 100) * Math.max(0, edge.length - 2 * LID_CORNER_RADIUS);
      if (rail >= LID_MIN_RAIL_LENGTH) railLength += rail;
    }
  }
  const rails = tray.clickRails;
  const anyRail = railed && (rails.front || rails.back || rails.left || rails.right);
  const magnetic = tray.attachment === 'magnetic';
  const mateRelief = footprint.polygon
    ? 0
    : magnetic
      ? LID_MAGNETIC_EXTRA_CLEARANCE
      : anyRail
        ? LID_SNAP_PLUG_CLEARANCE
        : 0;
  const cavityExtraMm = trayCavityExtraMm(tray, heightUnitMm);
  let volume = matingShellVolume(footprint, heightUnitMm, cavityExtraMm, mateRelief);
  volume += TRAY_RAIL_SECTION_MM2 * railLength;
  if (magnetic) {
    volume += magnetCount * TRAY_MAGNET_MM3[tray.floorAtBed === true ? 'nesting' : 'raised'];
  }
  return volume;
}

/**
 * The plug interior a solid nesting tray keeps (mm³). `addNestingFloor` fills
 * the plug, then a hollow tray cuts the lid cavity's section back out of it
 * from its bed floor up through the body's floor; a solid one keeps it, over
 * the skirt's whole depth. A nesting joint has no click rails, and a deep
 * magnet that sinks the bed floor below the skirt is not modelled.
 */
export function nestingPlugFillVolume(
  footprint: ShellFootprint,
  tray: TrayBottomConfig,
  heightUnitMm: number
): number {
  const cavityInset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
  const depth = trayBottomSkirtDepth(
    heightUnitMm,
    LID_FIT_CLEARANCE,
    trayCavityExtraMm(tray, heightUnitMm),
    false
  );
  return footprint.outerSection(cavityInset, 0) * depth;
}
