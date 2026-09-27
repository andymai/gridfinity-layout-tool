/**
 * Where each finger scoop ramp stands, without building it. The ramp builder
 * and the floor and divider pattern keep-outs both read this, so a pattern hole
 * cannot land in a ramp the builder placed somewhere else.
 */
import {
  compartmentHasTiltedEdge,
  isNestingBase,
  isRectangularCompartment,
} from '@/shared/types/bin';
import type { BinParams, ScoopSide, ScoopStyle } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  computeInteriorHeight,
  computeLipOffset,
  resolveScoopPlacement,
  resolveScoopProfile,
  resolveScoopSides,
  scoopArcAnchors,
  scoopFaceOffset,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import type { ScoopPlacement } from '@/shared/utils/scoopCalculations';
import { findCompartmentBounds } from './compartmentBuilder';
import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorConstants';
import { taperInsetAt } from './overhang';
import type { ResolvedTaper } from './overhang';
import type { BinDimensions } from './pipeline/types';

/**
 * Whether ramps are built for this bin at all. A ramp needs solid material to
 * rest on. `liteFloorOpen`, not `lightweight`: the interior mode and a spacer
 * leave nothing under the ramp but cup recesses, while the underside relief
 * keeps the floor a standard bin has. The scoop does not declare
 * `supportsCellMask`, so a custom shape never takes one either.
 */
export function scoopRampsApply(params: BinParams, dim: BinDimensions): boolean {
  return (
    params.scoop.enabled &&
    params.style === 'standard' &&
    !isPartialMask(params.cellMask) &&
    !isNestingBase(params.base) &&
    !dim.isSlotted &&
    !dim.liteFloorOpen
  );
}

export interface ScoopRampPlan {
  readonly compId: number;
  readonly side: ScoopSide;
  readonly placement: ScoopPlacement;
  /** The compartment's floor top, raised or not: the profile's local Z=0. */
  readonly floorZ: number;
  /** Wall height measured from that floor. */
  readonly wallHeight: number;
  readonly lipOffset: number;
  readonly height: number;
  readonly style: ScoopStyle;
  readonly arcTop: number;
  readonly floorStart: number;
  /** Measured from `floorStart`. */
  readonly run: number;
  /** How far a tapered outer wall has leaned inboard at a height above the floor. */
  readonly wallAt: (zAboveFloor: number) => number;
}

/** One ramp per compartment for each scooped wall, in the cavity frame. */
export function planScoopRamps(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number,
  floorZ: number,
  floorRaiseFor: (compartmentId: number) => number,
  taper: ResolvedTaper | null
): ScoopRampPlan[] {
  const hasLip = params.base.stackingLip;
  // The profile is authored with its floor at local Z=0 and the solid lifted
  // onto the interior floor, so every height here is measured from that floor,
  // which a raised compartment moves up.
  const interiorHeightRaw = computeInteriorHeight(wallHeight, hasLip, LIP_SMALL_TAPER);
  const { cols, rows, cells } = params.compartments;
  const sides = resolveScoopSides(params.scoop);

  const seen = new Set<number>();
  const plans: ScoopRampPlan[] = [];
  for (const compId of cells) {
    if (seen.has(compId)) continue;
    seen.add(compId);

    // Scoop ramps assume axis-aligned compartment floors. When a divider
    // override tilts one of this compartment's walls, the floor becomes a
    // wedge/trapezoid and the ramp math no longer applies. Silently skip;
    // the UI surfaces a tooltip explaining why.
    if (compartmentHasTiltedEdge(params.compartments, compId)) continue;

    // Same reasoning for a merged L, S or U: the ramp spans the compartment's
    // bounding-box wall, which on those crosses the notch into a neighbour.
    if (!isRectangularCompartment(params.compartments, compId)) continue;

    const bounds = findCompartmentBounds(compId, cols, rows, cells);
    if (!bounds) continue;

    const compFloorZ = floorZ + floorRaiseFor(compId);
    const frame = scoopFrameHeights(wallHeight, interiorHeightRaw, compFloorZ);

    for (const side of sides) {
      const placement = resolveScoopPlacement(side, bounds, { cols, rows, innerW, innerD });
      const { span, depth, isOuter } = placement;

      const lipOffset = computeLipOffset(hasLip, isOuter, LIP_TAPER_WIDTH, wallThickness);
      const profile = resolveScoopProfile(
        params.scoop,
        span,
        depth,
        isOuter,
        hasLip,
        frame.wallHeight,
        frame.interiorHeight,
        lipOffset
      );
      if (!profile) continue;

      // The profile is authored against the rim-anchored cavity edge, but a
      // tapered outer wall leans inboard toward the floor, so the arc is drawn
      // on the wall's own inset at each height plus its bulge. Anchoring it on
      // the wall only at the top is not enough: a quarter-ellipse leaves the
      // wall vertically and the wall leans away faster than the arc curves,
      // which buries the top of the arc for the envelope clip to shave off.
      // The bulge is never negative, so the arc never re-enters the wall.
      // Dividers are vertical, so an interior compartment never shifts.
      const wallAt = (zAboveFloor: number): number =>
        taper && isOuter
          ? taperInsetAt(taper, taper[side], compFloorZ + zAboveFloor, wallHeight)
          : 0;
      const { arcTop, floorStart } = scoopArcAnchors(
        lipOffset,
        wallAt(profile.height),
        wallAt(0),
        scoopFaceOffset(isOuter, params.compartments.thickness)
      );
      // The resolved run was clamped to the compartment depth from `lipOffset`;
      // re-clamp from where the arc reaches the floor so its end still stops
      // short of the opposite wall or divider.
      const run = Math.min(profile.run, depth - 0.5 - floorStart);
      if (run < 1) continue;

      plans.push({
        compId,
        side,
        placement,
        floorZ: compFloorZ,
        wallHeight: frame.wallHeight,
        lipOffset,
        height: profile.height,
        style: profile.style,
        arcTop,
        floorStart,
        run,
        wallAt,
      });
    }
  }
  return plans;
}
