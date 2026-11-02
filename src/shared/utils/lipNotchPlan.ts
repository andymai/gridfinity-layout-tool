import { hasDetachableFeet, type BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { hasOverhang, resolveOverhang } from '@/shared/utils/overhang';
import { resolveSocketCellPlan } from '@/shared/generation/socketCellPlan';
import {
  BOX_CORNER_RADIUS,
  CLEARANCE,
  LIP_TAPER_WIDTH,
} from '@/shared/generation/generatorConstants';

/** Why a bin cannot carry lip notches, in the order the panel reports them. */
export type LipNotchBlocker =
  'noLip' | 'lid' | 'shape' | 'overhang' | 'lattice' | 'size' | 'singleCell';

type LipNotchParams = Pick<BinParams, 'base' | 'lid' | 'cellMask' | 'overhang' | 'width' | 'depth'>;

const isHalfStep = (units: number): boolean => Math.abs(units * 2 - Math.round(units * 2)) < 1e-9;

/**
 * The first reason these params cannot carry lip notches, or `null` when they can.
 *
 * - `lid`: a capping lid's plug seats on the lip face the notches stand proud of,
 *   and a lid carries its own stack grid for the bin above.
 * - `shape` / `overhang`: notches sit on the nominal cell lattice, which a mask
 *   outline or an overhung rim does not follow.
 * - `lattice`: half-offset feet straddle the grid lines the notches stand on,
 *   so the bin's own twin would perch on them.
 * - `size`: a remainder that is not a half unit leaves an edge cell whose foot
 *   the socket builder may drop, so there is no grid line to notch with
 *   certainty.
 */
export function lipNotchBlocker(params: LipNotchParams): LipNotchBlocker | null {
  if (!params.base.stackingLip) return 'noLip';
  if (params.lid.enabled) return 'lid';
  if (isPartialMask(params.cellMask)) return 'shape';
  if (hasOverhang(resolveOverhang(params.overhang))) return 'overhang';
  // Detachable feet replace the socket and follow the lattice whatever
  // `halfSockets` says.
  const feet = resolveSocketCellPlan(
    params.base.halfSockets && !hasDetachableFeet(params.base),
    params.base.footLatticeX,
    params.base.footLatticeY,
    params.cellMask,
    params.width,
    params.depth
  );
  if (feet.latticeX === 'half' || feet.latticeY === 'half') return 'lattice';
  if (!isHalfStep(params.width) || !isHalfStep(params.depth)) return 'size';
  if (params.width <= 1 && params.depth <= 1) return 'singleCell';
  return null;
}

export function resolveLipNotches(params: LipNotchParams): boolean {
  return params.base.lipNotches === true && lipNotchBlocker(params) === null;
}

/**
 * How far in from the outer face a lip notch reaches, in mm.
 *
 * A foot's rounded corner ends `BOX_CORNER_RADIUS` in from the face, so the
 * notch has to reach at least that far to hold the whole corner. Stopping
 * exactly there would cut the pockets along their arc-to-flat seam, so it
 * carries on by half a clearance into the straight ridge.
 */
export const LIP_NOTCH_REACH_MM = BOX_CORNER_RADIUS + CLEARANCE / 2;

/**
 * How far in from the outer face the lip stands: its taper, or the notch reach
 * when notches are built. A tool cut through the lip has to clear this, or a
 * thin wall leaves a sliver of notch inside the opening.
 */
export function lipInnerReachMm(params: LipNotchParams): number {
  return resolveLipNotches(params) ? LIP_NOTCH_REACH_MM : LIP_TAPER_WIDTH;
}
