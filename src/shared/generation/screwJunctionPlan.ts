/**
 * Mount-down screws at the "+" junctions where four pockets meet: the solid
 * post under the rounded corners of the bins' feet, which holds a flat head
 * without a margin band or a floor pad.
 *
 * Kernel-free so the BREP cutter, the draft mesh and the plate-level pad
 * decision on the main thread all read one answer.
 *
 * The head cannot sit at the top face: the post is a knife edge there. It sits
 * as high as a seated foot allows, reached through a bore of the head's width
 * that notches the four pocket corners above it. That height is set by the
 * FOOT, not the pocket, because the foot is what the head must not touch; the
 * pocket corners above the seat are cut away anyway.
 */

import type { ScrewHoleParams } from '@/core/types/baseplate';
import { SCREW_PAD_MIN_RETAIN_MM } from '@/core/baseplateDefaults';
import {
  resolveScrewHeadDiameter,
  screwHeadRecessDepth,
  type ScrewJunctionSite,
} from './screwHolePlan';
import {
  BOX_CORNER_RADIUS,
  CLEARANCE,
  CORNER_RADIUS,
  footProfileFor,
  pocketProfileFor,
} from './generatorConstants';
import type { CellInfo, ForEachCellOptions } from './cellDecomposition';
import type { GridUnitInput } from './gridPitch';
import {
  MOUNT_MAGNET_MIN_WALL_MM,
  cornerDistance,
  junctionClearanceMm,
  pieceJunctions,
  profileInsetAt,
} from './mountMagnetPlan';

/**
 * Air kept between a junction screw's head and a seated foot's corner: the gap
 * the pocket itself keeps from the foot, so the head is no tighter to the bin
 * than the plate already is.
 */
export const SCREW_JUNCTION_FOOT_CLEARANCE_MM = CLEARANCE / 2;

/**
 * Distance from a junction to a bin foot seated in one of its four pockets, at
 * `depthBelowTop` below the plate's top face. Infinity below the foot.
 *
 * The foot lands on the pocket floor, so its top stands `socketHeight -
 * profileHeight` above the plate's top face. Its sections are `cell - CLEARANCE`
 * inset by the foot profile, rounded about the same arc centre as the pocket,
 * `CLEARANCE / 2 + footRadius` in from the cell edges.
 */
export function seatedFootDistanceMm(
  depthBelowTop: number,
  profileHeight: number,
  socketHeight: number,
  pocketRadius: number = CORNER_RADIUS
): number {
  if (depthBelowTop > profileHeight) return Number.POSITIVE_INFINITY;
  const footInset = profileInsetAt(
    footProfileFor(socketHeight),
    depthBelowTop + socketHeight - profileHeight
  );
  const footRadius = Math.min(BOX_CORNER_RADIUS, pocketRadius);
  return cornerDistance(CLEARANCE / 2 + footInset, CLEARANCE / 2 + footRadius);
}

/**
 * Depth below the top face of a junction screw's head seat: the shallowest at
 * which a seated foot clears the head's rim by
 * {@link SCREW_JUNCTION_FOOT_CLEARANCE_MM}. Undefined when no depth within the
 * pocket profile does. The foot only recedes going down, so the first depth
 * that clears is the seat.
 */
export function junctionScrewSeatMm(
  params: ScrewHoleParams,
  profileHeight: number,
  socketHeight: number,
  pocketRadius: number = CORNER_RADIUS
): number | undefined {
  const need =
    resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2 +
    SCREW_JUNCTION_FOOT_CLEARANCE_MM;
  const clears = (depth: number): boolean =>
    seatedFootDistanceMm(depth, profileHeight, socketHeight, pocketRadius) >= need - 1e-9;
  if (clears(0)) return 0;
  if (!clears(profileHeight)) return undefined;
  let lo = 0;
  let hi = profileHeight;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (clears(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 1000) / 1000;
}

/**
 * Depth below the top face at which a point offset `(dx, dy)` from a junction
 * passes from pocket air into the post, or Infinity when it never does within
 * the pocket profile.
 *
 * A point in one quadrant can only be inside that quadrant's pocket, whose
 * section at inset `i` spans `[i, ...)` on both axes with a corner arc of
 * radius `r - i` about `(r, r)`. The point leaves it once `i` passes the
 * smallest of its two axis offsets and its arc margin, and the inset only grows
 * going down.
 */
export function junctionPostDepthMm(
  dx: number,
  dy: number,
  profileHeight: number,
  cornerRadius: number = CORNER_RADIUS
): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const r = cornerRadius;
  const arcMargin = ax < r && ay < r ? r - Math.hypot(r - ax, r - ay) : Number.POSITIVE_INFINITY;
  const inset = Math.min(ax, ay, arcMargin);
  if (inset <= 0) return 0;
  const profile = pocketProfileFor(profileHeight);
  for (let k = 1; k < profile.length; k++) {
    const [d0, i0] = profile[k - 1];
    const [d1, i1] = profile[k];
    if (inset <= i1) return i1 > i0 ? d0 + ((inset - i0) / (i1 - i0)) * (d1 - d0) : d0;
  }
  return Number.POSITIVE_INFINITY;
}

/** Shaft probe spacing: finer than any band of the pocket profile. */
const SHAFT_PROBE_STEP_MM = 0.25;

/**
 * Whether a head seated `seat` below the top face holds at a junction of a
 * plate `totalHeight` tall: the recess stays inside the post below its rim, the
 * shaft keeps a wall to the pockets all the way out, and
 * `SCREW_PAD_MIN_RETAIN_MM` of plastic is left under the head.
 *
 * The rim itself is exempt from the post check. At the seat the foot sits
 * {@link SCREW_JUNCTION_FOOT_CLEARANCE_MM} beyond the head, and the pocket
 * surface a further 0.1mm inside that, so the rim overhangs the four pocket
 * corners by at most that much: air between the plate and the foot.
 */
export function junctionScrewFits(
  params: ScrewHoleParams,
  seat: number,
  totalHeight: number,
  profileHeight: number,
  cornerRadius: number = CORNER_RADIUS,
  cornerRelief: boolean = false
): boolean {
  const recess = screwHeadRecessDepth(params);
  if (totalHeight - (seat + recess) < SCREW_PAD_MIN_RETAIN_MM - 1e-9) return false;

  const clearance = (depth: number): number =>
    junctionClearanceMm(depth, profileHeight, cornerRadius, cornerRelief);
  const shaftRadius = params.diameter / 2;
  const headRadius = resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2;

  if (recess > 0 && headRadius > shaftRadius) {
    const steps = 8;
    for (let k = 1; k <= steps; k++) {
      const z = (k / steps) * recess;
      const radius =
        params.headStyle === 'counterbore'
          ? headRadius
          : headRadius - (z / recess) * (headRadius - shaftRadius);
      if (clearance(seat + z) < radius - 1e-9) return false;
    }
  }

  const shaftTop = seat + recess;
  const probes = Math.ceil((totalHeight - shaftTop) / SHAFT_PROBE_STEP_MM);
  for (let k = 0; k <= probes; k++) {
    const depth = Math.min(shaftTop + k * SHAFT_PROBE_STEP_MM, totalHeight);
    if (clearance(depth) - shaftRadius < MOUNT_MAGNET_MIN_WALL_MM - 1e-9) return false;
  }
  return true;
}

/**
 * The junctions of a piece that hold this screw, with each one's head seat.
 * `totalHeight` must be the plate's height WITHOUT a screw pad: a site that
 * only fits once the pad exists would make the pad a condition of itself.
 */
export function screwJunctions(
  params: ScrewHoleParams,
  gridW: number,
  gridD: number,
  totalHeight: number,
  profileHeight: number,
  socketHeight: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: GridUnitInput },
  cellFilter?: (cell: CellInfo) => boolean,
  cellCornerRelief?: (cell: CellInfo) => boolean
): ScrewJunctionSite[] {
  const out: ScrewJunctionSite[] = [];
  for (const j of pieceJunctions(gridW, gridD, cellOpts, cellFilter, cellCornerRelief)) {
    const seat = junctionScrewSeatMm(params, profileHeight, socketHeight, j.cornerRadius);
    if (seat === undefined) continue;
    if (
      junctionScrewFits(params, seat, totalHeight, profileHeight, j.cornerRadius, j.cornerRelief)
    ) {
      out.push({ x: j.x, y: j.y, seatBelowTopMm: seat });
    }
  }
  return out;
}
