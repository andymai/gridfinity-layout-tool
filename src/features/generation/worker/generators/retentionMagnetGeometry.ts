/**
 * Shared geometry for lid-retention magnets (issue #2694).
 *
 * A magnetic lid holds onto the bin via four press-fit magnets: one in a
 * corner post rising from the bin's interior floor to its stacking-lip top,
 * and a mating one in a corner boss hanging from the lid's floor down to the
 * same plane. The two magnets meet across the seated interface — the bin's
 * lip-top plane, which the export assembly pins to the lid's local `anchorZ`
 * (`exportHandler` lifts the lid by `totalHeight - anchorZ`).
 *
 * The bin and the lid MUST place their magnets at the SAME XY or they won't
 * mate, so both callers derive positions from this single helper (the same
 * discipline `baseplateMagnets.magnetPositionsForCell` uses for stack magnets).
 * Positions are on the NOMINAL grid footprint (not the per-part clearance-
 * adjusted footprint) so the bin's slightly-larger body and the lid's
 * slightly-smaller cavity still line up.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  LID_MAGNET_BOSS_WALL,
  LID_MAGNET_LIP_CLEARANCE,
  LID_MAGNET_SEAT_GAP,
  LID_TOP_THICKNESS_BASE,
} from './lidConstants';
import { resolveLidInputs } from './lidInputs';

/** Radial material kept around the magnet in its post/boss (mm). */
export function retentionBossRadius(magnetDiameter: number): number {
  return magnetDiameter / 2 + LID_MAGNET_BOSS_WALL;
}

/**
 * Distance (mm) from the nominal footprint edge to the magnet centre.
 *
 * Set so the lid's boss (radius {@link retentionBossRadius}) sits fully INBOARD
 * of the bin's stacking lip: `inset - bossRadius = LID_MAGNET_LIP_CLEARANCE`, so
 * the boss can hang into the mouth without fouling the lip as the lid seats. The
 * bin's corner gusset then reaches back OUT to the interior walls to anchor
 * itself. Both parts use this same inset so their magnets stay coaxial.
 */
export function retentionMagnetInset(magnetDiameter: number): number {
  return LID_MAGNET_LIP_CLEARANCE + retentionBossRadius(magnetDiameter);
}

/**
 * The four corner magnet XY positions, centred on the origin like both the bin
 * body and the lid, inset from the NOMINAL footprint corner by
 * {@link retentionMagnetInset}. Nominal (not per-part) so the bin's slightly-
 * larger body and the lid's slightly-smaller cavity keep the magnets coaxial.
 */
export function retentionMagnetPositions(
  width: number,
  depth: number,
  gridUnitMmX: number,
  gridUnitMmY: number,
  inset: number
): ReadonlyArray<readonly [number, number]> {
  const halfW = (width * gridUnitMmX) / 2;
  const halfD = (depth * gridUnitMmY) / 2;
  const x = halfW - inset;
  const y = halfD - inset;
  return [
    [-x, -y],
    [x, -y],
    [-x, y],
    [x, y],
  ];
}

/**
 * True when the design's lid uses magnetic retention and the geometry is
 * supported (has a stacking lip, rectangular footprint). Polygon (cellMask)
 * bins are excluded for now — corner placement on an arbitrary outline is
 * ambiguous; `checkLidCompatibility` surfaces that to the user.
 *
 * Independent of whether the lid is being exported in the same action: the
 * physical BIN always needs its magnet posts once a magnetic lid is designed
 * for it, so the bin's retention stage keys off this too.
 */
export function usesMagneticLid(params: BinParams): boolean {
  return (
    params.lid.enabled &&
    params.lid.attachment === 'magnetic' &&
    params.base.stackingLip &&
    !isPartialMask(params.cellMask)
  );
}

/**
 * The two magnet faces that mate when the lid is seated, in BIN-WORLD Z.
 *
 * Same discipline as {@link retentionMagnetPositions} for XY: the bin's pad and
 * the lid's boss are built by different passes, so both must derive their
 * mating plane here or the pair drifts apart in Z and the magnets never touch.
 *
 * - `lidFaceZ` — the lid boss's downward magnet face. The boss is anchored to
 *   the cavity BOTTOM, so this stays a fixed distance below the lip line no
 *   matter how deep the cavity gets (a deep lid grows a longer pillar). Lifted
 *   by the seating transform (`totalHeight - anchorZ`) that `exportHandler`
 *   applies to the lid solid.
 * - `binFaceZ` — the bin pad's upward magnet face, one {@link LID_MAGNET_SEAT_GAP}
 *   below, so the corner posts can't bottom out and hold the lid off its lip.
 *
 * Their separation is `LID_MAGNET_SEAT_GAP` by construction; the scenario suite
 * asserts it so a change to either side's derivation can't silently close it.
 */
export function retentionSeatPlanes(
  params: BinParams,
  totalHeight: number
): { readonly lidFaceZ: number; readonly binFaceZ: number } {
  const lidInputs = resolveLidInputs(params);
  const magnetDepth = params.lid.retentionMagnet.depth;
  // Mirrors `lidRetentionMagnets`: the boss is anchored to the cavity bottom,
  // so a deeper cavity lengthens the pillar rather than lifting the magnet.
  const interfaceZ = -(LID_TOP_THICKNESS_BASE + magnetDepth) - lidInputs.cavityExtraMm;
  const lidFaceZ = interfaceZ + (totalHeight - lidInputs.anchorZ);
  return { lidFaceZ, binFaceZ: lidFaceZ - LID_MAGNET_SEAT_GAP };
}
