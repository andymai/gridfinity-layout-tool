/**
 * Preview-side lid placement helpers.
 *
 * The anchor formulas are re-exported from `@/features/bin-designer/types/lid`
 * (main-thread safe — the worker's `lidConstants` pulls in brepjs/WASM and
 * can't be imported here). They used to be a hand-synced copy; the shared
 * module removes that drift risk, and the cross-thread agreement test in
 * `LidMesh.test.tsx` still pins the two entry points together.
 *
 * This file must contain only constants + pure functions (no React) so the
 * consuming component file stays react-refresh friendly.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import {
  isSlideLid,
  LID_FIT_CLEARANCE,
  resolveLidCavityExtraMm,
  resolveLidPlateThickness,
} from '@/features/bin-designer/types/lid';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { resolveOverhang, overhangExpansion, hasOverhang } from '@/shared/utils/overhang';
import { slideLidPlanForParams } from '@/features/bin-designer/utils/slideLidPlanForParams';
import type { BinParams } from '@/features/bin-designer/types';
import type { LidRailSide } from '@/features/bin-designer/types/lid';

/** The params {@link binLipTopWorldZ} reads — narrow so partial callers fit. */
export type LidSeatSource = Pick<
  BinParams,
  'height' | 'heightUnitMm' | 'base' | 'lid' | 'extraWallHeightMm'
>;

// The anchor formulas now live in `@/features/bin-designer/types/lid` — a
// main-thread-safe module both this preview and the worker import, so the two
// hand-synced copies this file used to hold can't drift. Re-exported here so
// existing consumers keep their import path.
export { LID_EXTRA_HEIGHT, lidWallBottomZ } from '@/features/bin-designer/types/lid';
import { lidAnchorZ } from '@/features/bin-designer/types/lid';
export { lidAnchorZ };

export const PREVIEW_Z_OFFSET = 0.1;

/**
 * World-Z of the bin's stacking-lip top in the R3F preview frame — the plane a
 * seated lid's `anchorZ` lands on. Mirrors the worker's `dimensions.lipTopZ`.
 *
 * The wall top is `floorZ + wallHeight`, and it is worth spelling out why that
 * is NOT `floorZ + height * heightUnitMm`: `wallHeight` already has the
 * Gridfinity socket subtracted, so adding the floor back on top of the nominal
 * height double-counts it. The two agree only for a socketless base,
 * where `floorZ` is the skirt or zero. An exterior-wall collar
 * (`extraWallHeightMm`,) raises the walls and the lip with them. With the
 * stacking lip the top face lands `LIP_HEIGHT` above the wall;
 * without it the lid mates with the bare wall. `PREVIEW_Z_OFFSET` accounts for
 * BinMesh's group offset.
 *
 * Takes the params rather than loose scalars so the two derivations can't be
 * fed inconsistent halves of the same bin.
 */
export function binLipTopWorldZ(params: LidSeatSource): number {
  return binWallTopWorldZ(params) + (params.base.stackingLip ? LIP_ABOVE_WALL_MM : 0);
}

/** How far the stacking lip's top face sits above the wall top. */
const LIP_ABOVE_WALL_MM = GRIDFINITY.LIP_HEIGHT;

/**
 * World-Z of the bin's WALL TOP in the preview frame.
 *
 * Split out of {@link binLipTopWorldZ} because a sliding lid is placed against
 * this plane rather than the lip's: `slideLidPlan` states its whole joint as a
 * depth below the wall top, so a collar carries the channel up for free.
 */
export function binWallTopWorldZ(params: LidSeatSource): number {
  const { height, heightUnitMm, base, lid } = params;
  const wallTop =
    baseFloorZ(base, heightUnitMm, lid) +
    baseWallHeight(base, height * heightUnitMm) +
    Math.max(0, params.extraWallHeightMm ?? 0);
  return wallTop + PREVIEW_Z_OFFSET;
}

/**
 * Where the lid group sits, and which way the explode slider moves it.
 *
 * A capping lid lifts straight up off its lip; a sliding one withdraws through
 * its entry wall, and showing it lifting would depict a motion the printed part
 * physically cannot make — as well as hiding whether the plate, the channel and
 * the notch actually line up.
 *
 * Both cases return a full translation rather than a Z and a direction, so the
 * consumer has one thing to apply and no branch of its own.
 */
export function lidGroupPosition(
  params: BinParams,
  offsetMm: number
): readonly [number, number, number] {
  if (!isSlideLid(params.lid)) {
    const anchorZ = lidAnchorZ(
      params.heightUnitMm,
      LID_FIT_CLEARANCE,
      resolveLidCavityExtraMm(params)
    );
    return [0, 0, binLipTopWorldZ(params) - anchorZ + offsetMm];
  }

  const { geometry } = slideLidPlanForParams(params);
  const z = binWallTopWorldZ(params) - (geometry?.plateTopBelowWallTopMm ?? 0);
  if (!geometry) return [0, 0, z];
  // Outward normal of the entry wall, in the same convention the rest of the
  // lid code uses: back is +Y, front is −Y, right is +X, left is −X.
  const [dx, dy] = ENTRY_OUTWARD[geometry.entrySide];
  // Clamped to the plate's own travel: past that it is clear of the bin and
  // sliding it further only pushes it off screen.
  const travel = Math.min(offsetMm, geometry.travelMm);
  return [dx * travel, dy * travel, z];
}

/**
 * How a hinged lid is posed in the preview: pivot, rotation, and the shift that
 * puts the mesh back where it belongs under them.
 *
 * Three transforms rather than one, because the pivot is NOT the lid's origin.
 * A group rotates about its own origin, and the hinge axis sits out at the
 * wall — so the mesh has to be carried to the axis, turned, and carried back.
 * Returned as a triple so the component applies it without arithmetic of its
 * own; getting a pivot wrong is invisible at 0° and obvious at 90°, which is
 * exactly the kind of error a static preview would never surface.
 *
 * `null` when this design has no hinge, so the caller keeps its existing path.
 */
export function lidHingePose(
  params: BinParams,
  angleDeg: number
): {
  readonly pivot: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly inner: readonly [number, number, number];
} | null {
  const { geometry } = planHingeLid(params);
  if (!geometry) return null;

  const overhang = resolveOverhang(params.overhang);
  const expansion = hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const halfW =
    (params.width * params.gridUnitMm - 2 * LID_FIT_CLEARANCE + (expansion?.addW ?? 0)) / 2;
  const halfD = (params.depth * gridUnitMmY - 2 * LID_FIT_CLEARANCE + (expansion?.addD ?? 0)) / 2;

  const outward = geometry.side === 'back' || geometry.side === 'right' ? 1 : -1;
  // The axis, in the lid's own frame: inset from ITS outer face, which is the
  // same statement the builders work from — so the preview cannot draw the lid
  // turning about a line the geometry was not built around.
  const half = geometry.alongX ? halfD : halfW;
  const shift = geometry.alongX ? (expansion?.offsetY ?? 0) : (expansion?.offsetX ?? 0);
  const axisCross = outward * (half - geometry.axisInsetMm) + shift;
  const axisLocalZ = -resolveLidPlateThickness(params);
  const axisWorldZ = binLipTopWorldZ(params) + geometry.axisAboveLipTopMm;

  // Opening lifts the material INBOARD of the axis, and which rotation does
  // that flips with both the axis direction and which side of the bin the wall
  // is on. One expression for all four, matching the kernel harness exactly —
  // a preview that turned the other way would be depicting a motion the printed
  // part cannot make.
  const rad = ((geometry.alongX ? -outward : outward) * angleDeg * Math.PI) / 180;

  return {
    pivot: geometry.alongX ? [0, axisCross, axisWorldZ] : [axisCross, 0, axisWorldZ],
    rotation: geometry.alongX ? [rad, 0, 0] : [0, rad, 0],
    inner: geometry.alongX ? [0, -axisCross, -axisLocalZ] : [-axisCross, 0, -axisLocalZ],
  };
}

const ENTRY_OUTWARD: Record<LidRailSide, readonly [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  back: [0, 1],
  front: [0, -1],
};
