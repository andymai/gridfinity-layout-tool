/**
 * Where a caption on the INNER face of an outer wall may go.
 *
 * The outer face only meets features that pass through the wall, so the
 * outside solver gets away with four bands around one obstacle union. The
 * inner face also carries divider joints, label shelves, slide rails, label
 * slot bosses, lid magnet pads and scoop ramps (`insideWallObstacles`). A
 * union of those swallows the clear area between them, so regions are
 * enumerated as maximal empty rectangles, separately in each stretch of wall
 * between two dividers.
 *
 * Same clip frame as `wallTextPlan`: `u` along +X (front/back) or +Y
 * (left/right) centred on the cavity, `z` above the box bottom. Shared with the
 * designer's ghost overlay, so everything is derived from params and the
 * dimensions the caller already passes; nothing here may import the kernel.
 */

import type { BinParams, WallTextSide } from '@/shared/types/bin';
import {
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP,
  LID_FIT_CLEARANCE,
  buildOverrideLookup,
  dividerFootDrift,
  findPairAwareRuns,
  isSlideLid,
  lidAnchorZ,
  lidFillBottomZ,
  overrideKey,
  resolveLidCavityExtraMm,
  slideLidPlanForParams,
} from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { CUTOUT_BORDER_WIDTH, TOP_KEEP_OUT } from '@/shared/constants/wallBands';
import { LID_KEEPOUT_CLEARANCE } from '@/shared/constants/lidKeepout';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveOverhang } from '@/shared/utils/overhang';
import { interiorFilletCornerMm, interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { interiorReliefActive } from '@/shared/utils/lidInteriorRelief';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { resolveScoopSides } from '@/shared/utils/scoopCalculations';
import { SLIDE_BEARING_MM, SLIDE_SHELF_TIP_MM } from '@/shared/utils/slideLidPlan';
import { resolveBinFloorMm, resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import {
  builtFloorRaises,
  cavityCornerRadiusMm,
  scoopRampsApply,
  type InsideWallDims,
} from '@/shared/utils/insideWallObstacles';
import type { WallRect } from '@/shared/utils/maximalClearRects';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/** Why a wall's inner face cannot carry a caption at all. */
export type InsideWallTextBlock = 'solid' | 'scoop';

/** Walls whose inner face both sides of the app agree has no room for text. */
export function insideWallTextBlock(
  params: BinParams,
  side: WallTextSide
): InsideWallTextBlock | null {
  if (params.base.solid || params.base.tile === true) return 'solid';
  // On a lipped bin the ramp's chute stands proud of this face from the floor to
  // the lip across every compartment, so text cut at the wall plane is buried;
  // on a lipless one the ramp alone covers most of the useful height.
  if (scoopRampsApply(params) && resolveScoopSides(params.scoop).includes(side)) return 'scoop';
  return null;
}

/**
 * Top of a tapered side's flared band. Below it the real face sits inboard of
 * the rim plane every caption is built on.
 */
export function taperBandTop(params: BinParams, side: WallTextSide, wallHeight: number): number {
  const taper = resolveOverhang(params.overhang).taper;
  return taper && taper[side] > 1e-6 ? Math.min(taper.bandHeight, wallHeight) : 0;
}

/**
 * How far below the wall top lid parts reach into the cavity on `side` (mm), or
 * 0 when no lid puts anything on that inner face.
 */
function lidBandBelowWallTopMm(params: BinParams, side: WallTextSide): number {
  if (!params.lid.enabled) return 0;
  const ring = LID_CLICK_RAIL_BAND_BELOW_WALL_TOP + LID_KEEPOUT_CLEARANCE;
  if (isSlideLid(params.lid)) {
    // A plan that refuses the bin builds no channel, so it claims nothing.
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) return 0;
    // The shelf the plate rests on hangs lowest: plate thickness, the shelf
    // tip, then a 45° underside as deep as the shelf's reach.
    return (
      geometry.plateTopBelowWallTopMm +
      geometry.plate.thicknessMm +
      SLIDE_SHELF_TIP_MM +
      geometry.clearanceMm +
      SLIDE_BEARING_MM +
      LID_KEEPOUT_CLEARANCE
    );
  }

  let band = interiorReliefActive(params) ? ring : 0;
  if (params.lid.attachment === 'clickRails' && params.lid.clickRails[side]) band = ring;
  // A hinged lid's detent is a click rail on the catch wall alone.
  const hinge = planHingeLid(params).geometry;
  if (hinge?.catchMode === 'detent' && hinge.detentFits && hinge.catchSide === side) band = ring;
  // A fill plug seats inside the mouth, below the lip on deep magnets.
  const fillBottom = lidFillBottomZ(params);
  if (fillBottom !== null) {
    const anchor = lidAnchorZ(
      params.heightUnitMm,
      LID_FIT_CLEARANCE,
      resolveLidCavityExtraMm(params)
    );
    const plugDepth = anchor - fillBottom - GRIDFINITY_SPEC.LIP_HEIGHT;
    band = Math.max(band, plugDepth + LID_KEEPOUT_CLEARANCE);
  }
  return band;
}

/** The band an inside caption may occupy, before obstacles. */
export function insideWallBounds(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect | null {
  const wallSpan = side === 'front' || side === 'back' ? dims.innerW : dims.innerD;
  const uLimit = wallSpan / 2 - cavityCornerRadiusMm(params);

  const floorZ = resolveBinFloorMm(params);
  const raises = builtFloorRaises(params, floorZ, dims.interiorHeight);
  const floorTop = floorZ + Math.max(0, ...raises.values()) + interiorFilletRadiusMm(params);
  const minZ = Math.max(floorTop, taperBandTop(params, side, dims.wallHeight));

  const lipKeepOut = params.base.stackingLip ? LIP_TAPER_WIDTH : TOP_KEEP_OUT;
  const maxZ = dims.wallHeight - Math.max(lipKeepOut, lidBandBelowWallTopMm(params, side));

  const bounds: WallRect = { minU: -uLimit, maxU: uLimit, minZ, maxZ };
  return bounds.maxU > bounds.minU && bounds.maxZ > bounds.minZ ? bounds : null;
}

/** Half the footprint a divider of `thickness` leaves where it meets a wall at an angle. */
function crossingHalfSpan(thickness: number, segLen: number, drift: number): number {
  if (segLen <= 0) return thickness / 2;
  return (thickness * Math.hypot(segLen, drift)) / segLen / 2;
}

/**
 * Stretches of `side` a divider wall stands on, as u intervals. Mirrors the
 * gates and endpoint conventions of `dividerRailBlocks`, which is pinned to the
 * wall builder.
 */
function dividerCrossings(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): { readonly lo: number; readonly hi: number }[] {
  const { cols, rows, cells, thickness } = params.compartments;
  if (isPartialMask(params.cellMask)) return [];
  if (params.style !== 'standard') return [];
  if (cols < 1 || rows < 1 || cells.length !== cols * rows) return [];
  if (new Set(cells).size <= 1) return [];
  const { innerW, innerD } = dims;
  if ((innerW - (cols - 1) * thickness) / cols < thickness * 2) return [];
  if ((innerD - (rows - 1) * thickness) / rows < thickness * 2) return [];

  const dividerTopZ = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    dims.interiorHeight
  );
  // A filleted junction flares the divider's foot out along the wall.
  const flare = interiorFilletCornerMm(params);
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const out: { lo: number; hi: number }[] = [];
  const push = (at: number, halfSpan: number, sweep: number): void => {
    out.push({
      lo: at - halfSpan - flare + Math.min(0, sweep),
      hi: at + halfSpan + flare + Math.max(0, sweep),
    });
  };

  const alongX = side === 'front' || side === 'back';
  const lines = alongX ? cols : rows;
  const runLength = alongX ? rows : cols;
  const pitch = alongX ? cellW : cellD;
  const runPitch = alongX ? cellD : cellW;
  const origin = alongX ? -innerW / 2 : -innerD / 2;
  const atStart = side === 'front' || side === 'left';

  for (let boundary = 1; boundary < lines; boundary++) {
    const pos = origin + boundary * pitch;
    const runs = findPairAwareRuns(runLength, (i) => {
      const a = alongX ? cells[i * cols + (boundary - 1)] : cells[(boundary - 1) * cols + i];
      const b = alongX ? cells[i * cols + boundary] : cells[boundary * cols + i];
      return a !== b ? overrideKey(a, b) : null;
    });
    for (const run of runs) {
      const ov = lookup.get(run.pairKey);
      const start = pos + (ov?.offsetStart ?? 0);
      const end = pos + (ov?.offsetEnd ?? 0);
      const halfSpan = crossingHalfSpan(thickness, (run.end - run.start) * runPitch, end - start);
      const sweep = dividerFootDrift(ov, dividerTopZ);
      if (atStart && run.start === 0) push(start, halfSpan, sweep);
      if (!atStart && run.end === runLength) push(end, halfSpan, sweep);
    }
  }
  return out;
}

/**
 * The bounds split at every divider joint, so a caption never straddles one.
 * Ordered by u.
 */
export function insideWallSegments(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide,
  bounds: WallRect
): WallRect[] {
  const cuts = dividerCrossings(params, dims, side)
    .map((c) => ({ lo: c.lo - CUTOUT_BORDER_WIDTH, hi: c.hi + CUTOUT_BORDER_WIDTH }))
    .sort((a, b) => a.lo - b.lo);
  const out: WallRect[] = [];
  let start = bounds.minU;
  for (const cut of cuts) {
    if (cut.lo > start) out.push({ ...bounds, minU: start, maxU: Math.min(cut.lo, bounds.maxU) });
    start = Math.max(start, cut.hi);
  }
  if (bounds.maxU > start) out.push({ ...bounds, minU: start });
  return out.filter((r) => r.maxU - r.minU > 0);
}
