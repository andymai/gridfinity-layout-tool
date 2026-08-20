/**
 * Shared geometry for lid-retention magnets.
 *
 * A magnetic lid holds onto the bin via four press-fit magnets: one in a
 * corner post rising from the bin's interior floor, and a mating one in a
 * corner boss hanging from the lid's floor down to meet it. They mate INSIDE
 * the bin mouth, below the lid's own mating skirt — not at the lip-top plane
 * (see {@link retentionInterfaceZ}, and for what happens when they try).
 * The seating transform is pinned to the lid's local `anchorZ`, which the
 * export assembly lands on the bin's lip top (`exportHandler` lifts the lid by
 * `lipTopZ - anchorZ`).
 *
 * The bin and the lid MUST place their magnets at the SAME XY or they won't
 * mate, so both callers derive positions from this single helper (the same
 * discipline `baseplateMagnets.magnetPositionsForCell` uses for stack magnets).
 * Positions ignore the per-part clearance so the bin's slightly-larger body and
 * the lid's slightly-smaller cavity still line up, but they DO follow the
 * overhang-expanded footprint — the magnets hug the stacking lip, and
 * overhang moves it. Unlike the stack sockets, which stay on the nominal grid
 * because they mate with a neighbouring bin's base rather than with this lip.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { LID_MAGNET_SEAT_GAP, lidRetentionInterfaceZ } from './lidConstants';
import { resolveLidInputs } from './lidInputs';
import type { LidInputs } from './lidInputs';

/* The boss footprint itself lives in the shared types module — the panel, the
 * grip-relief clamp and the lid cutout window all need it on the main thread.
 * Re-exported here so worker callers keep their existing import path. */
export { retentionBossRadius, retentionMagnetInset } from '@/shared/types/bin';

/* Placement lives in the shared module — the lid cutout window needs every boss
 * footprint on the main thread, and a second copy of the edge-magnet spacing
 * rule is how the two sides of this joint have drifted before. Re-exported so
 * worker callers keep their existing import path. */
export {
  retentionMagnetPositions,
  type RetentionMagnetPlacement,
} from '@/shared/utils/retentionMagnetPlacement';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import type { RetentionMagnetPlacement } from '@/shared/utils/retentionMagnetPlacement';
import type { LidRailSide } from '@/shared/types/bin';

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
 * True when a HINGED lid asks for the magnet catch, and the geometry supports
 * it. The same structural preconditions as {@link usesMagneticLid}, decided by
 * the hinge plan so a design whose hinge the plan refused never grows bosses
 * for a joint it does not have.
 */
/** The wall a hinged lid's magnet catch pins, or `null` for all four corners. */
export function retentionMagnetSide(params: BinParams): LidRailSide | null {
  const { geometry } = planHingeLid(params);
  return geometry !== null && geometry.catchMode === 'magnets' ? geometry.catchSide : null;
}

export function usesHingeMagnetCatch(params: BinParams): boolean {
  const { geometry } = planHingeLid(params);
  return geometry !== null && geometry.catchMode === 'magnets';
}

/**
 * True when this design needs retention magnets at all, whichever mode asked.
 *
 * The gate every consumer should read. `usesMagneticLid` stays narrow because
 * its name is a claim about the ATTACHMENT, and a hinged lid is not a magnetic
 * one — it is a hinged lid whose catch happens to be magnetic. Widening that
 * predicate instead of adding this one would have made every call site read as
 * a lie.
 */
export function usesRetentionMagnets(params: BinParams): boolean {
  return usesMagneticLid(params) || usesHingeMagnetCatch(params);
}

/**
 * The magnet placements this design actually wants.
 *
 * A magnetic LID pins all four corners. A hinged lid's magnet CATCH pins only
 * the free edge: the hinge already holds the other one absolutely, and magnets
 * on the hinge wall would fight the knuckles for the same millimetres while
 * adding nothing — the lid cannot lift there. So the catch is the same corner
 * geometry, filtered to one wall.
 *
 * Takes the SIDE rather than the design, so the two builders can hand it the
 * value they each already hold — the lid from its resolved inputs, the bin from
 * the plan — without either needing the other's frame. `null` means all four
 * corners, which is what a magnetic attachment asks for.
 */
export function retentionMagnetPlacementsFor(
  side: LidRailSide | null,
  all: ReadonlyArray<RetentionMagnetPlacement>,
  centreX: number,
  centreY: number
): ReadonlyArray<RetentionMagnetPlacement> {
  if (side === null) return all;
  switch (side) {
    case 'back':
      return all.filter((p) => p.y > centreY);
    case 'front':
      return all.filter((p) => p.y < centreY);
    case 'right':
      return all.filter((p) => p.x > centreX);
    case 'left':
      return all.filter((p) => p.x < centreX);
  }
}

/**
 * {@link lidRetentionInterfaceZ} in the worker's `LidInputs` terms — the magnet
 * mating plane in lid-local Z, one {@link LID_MAGNET_SEAT_GAP} above the bin
 * pad's face.
 *
 * The formula itself lives in the shared lid module: `trayBottomSkirtDepth`
 * needs it on the main thread to know how far a magnetic tray's bosses hang,
 * and a second copy here is precisely how the two sides of this joint have gone
 * wrong before. This adapter exists only so the two worker
 * callers can pass the resolved inputs they already hold.
 */
export function retentionInterfaceZ(
  inputs: Pick<LidInputs, 'retentionMagnetDepth' | 'cavityExtraMm' | 'heightUnitMm'>
): number {
  return lidRetentionInterfaceZ(
    inputs.heightUnitMm,
    inputs.cavityExtraMm,
    inputs.retentionMagnetDepth
  );
}

/**
 * The two magnet faces that mate when the lid is seated, in BIN-WORLD Z.
 *
 * Same discipline as {@link retentionMagnetPositions} for XY: the bin's pad and
 * the lid's boss are built by different passes, so both must derive their
 * mating plane from {@link retentionInterfaceZ} or the pair drifts apart in Z
 * and the magnets never touch.
 *
 * - `lidFaceZ` — the lid boss's downward magnet face, lifted by the seating
 *   transform (`lipTopZ - anchorZ`) that `exportHandler` applies to the lid.
 * - `binFaceZ` — the bin pad's upward magnet face, one {@link LID_MAGNET_SEAT_GAP}
 *   below, so the pads can't bottom out and hold the lid off its lip.
 *
 * Their separation is `LID_MAGNET_SEAT_GAP` by construction; the scenario suite
 * asserts it so a change to either side's derivation can't silently close it.
 */
export function retentionSeatPlanes(
  params: BinParams,
  lipTopZ: number
): { readonly lidFaceZ: number; readonly binFaceZ: number } {
  const lidInputs = resolveLidInputs(params);
  const lidFaceZ = retentionInterfaceZ(lidInputs) + (lipTopZ - lidInputs.anchorZ);
  return { lidFaceZ, binFaceZ: lidFaceZ - LID_MAGNET_SEAT_GAP };
}
