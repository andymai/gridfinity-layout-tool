/**
 * Where a caption on the INNER face of an outer wall may go.
 *
 * The outer face only meets features that pass through the wall, so the
 * outside solver gets away with four bands around one obstacle union. The
 * inner face also carries divider joints, label shelves, slide rails, label
 * slot bosses, lid magnet pads and scoop ramps. A union of those swallows the
 * clear area between them, so regions here are enumerated as maximal empty
 * rectangles, separately in each stretch of wall between two dividers.
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
  MAX_COMPARTMENT_FLOOR_RAISE_MM,
  MIN_RAISED_CAVITY_MM,
  buildOverrideLookup,
  compartmentHasTiltedEdge,
  dividerFootDrift,
  findPairAwareRuns,
  isNestingBase,
  isSlideLid,
  lidAnchorZ,
  lidFillBottomZ,
  overrideKey,
  resolveLidCavityExtraMm,
  retentionBossRadius,
  retentionMagnetInset,
  slideLidPlanForParams,
} from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { CUTOUT_BORDER_WIDTH, TOP_KEEP_OUT } from '@/shared/constants/wallBands';
import { LID_KEEPOUT_CLEARANCE } from '@/shared/constants/lidKeepout';
import { effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import { isPartialMask } from '@/shared/utils/cellMask';
import { hasOverhang, overhangExpansion, resolveOverhang } from '@/shared/utils/overhang';
import { interiorFilletCornerMm, interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { interiorReliefActive } from '@/shared/utils/lidInteriorRelief';
import { labelTabFootprints } from '@/shared/utils/labelTabPlan';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { retentionMagnetPositions } from '@/shared/utils/retentionMagnetPlacement';
import {
  computeLipOffset,
  resolveScoopPlacement,
  resolveScoopProfile,
  resolveScoopSides,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import type { ScoopCompartmentBounds } from '@/shared/utils/scoopCalculations';
import { SLIDE_BEARING_MM, SLIDE_SHELF_TIP_MM } from '@/shared/utils/slideLidPlan';
import {
  resolveSlideGeometry,
  slideInputFromDims,
  slidePatternKeepOut,
} from '@/shared/utils/slideGeometry';
import {
  isLiteFloorOpen,
  resolveBinFloorMm,
  resolveCompartmentDividerHeight,
} from '@/shared/utils/slotMath';
import { planWallLabelSlots, resolveWallLabelSlots } from '@/shared/utils/wallLabelSlotPlan';
import type { WallRect } from '@/shared/utils/maximalClearRects';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/** What the inside path reads beyond params, as the caller already resolved it. */
export interface InsideWallDims {
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly interiorHeight: number;
}

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

/** Mirrors the worker's `scoopRampsApply` from params alone. */
function scoopRampsApply(params: BinParams): boolean {
  return (
    params.scoop.enabled &&
    params.style === 'standard' &&
    !isPartialMask(params.cellMask) &&
    !isNestingBase(params.base) &&
    !isLiteFloorOpen(params)
  );
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

/**
 * Highest compartment floor raise the generator actually builds: requests for
 * a compartment that no longer exists or has a tilted edge are dropped, and the
 * rest are held below the ceiling, exactly as `resolveFloorRaises` does.
 */
function builtFloorRaiseMm(params: BinParams, floorZ: number, interiorHeight: number): number {
  const raises = params.compartments.floorRaises;
  if (!raises || isPartialMask(params.cellMask)) return 0;
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - floorZ - MIN_RAISED_CAVITY_MM
  );
  if (ceiling <= 0) return 0;
  const ids = new Set(params.compartments.cells);
  let highest = 0;
  raises.forEach((raise, id) => {
    if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return;
    if (!ids.has(id) || compartmentHasTiltedEdge(params.compartments, id)) return;
    highest = Math.max(highest, Math.min(raise, ceiling));
  });
  return highest;
}

/** The band an inside caption may occupy, before obstacles. */
export function insideWallBounds(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect | null {
  const wallSpan = side === 'front' || side === 'back' ? dims.innerW : dims.innerD;
  // The cavity's vertical corner arcs, widened by an interior fillet when one
  // rounds them further.
  const cornerR = Math.max(
    GRIDFINITY.BOX_CORNER_RADIUS - params.wallThickness,
    interiorFilletCornerMm(params)
  );
  const uLimit = wallSpan / 2 - cornerR;

  const floorZ = resolveBinFloorMm(params);
  const floorTop =
    floorZ +
    builtFloorRaiseMm(params, floorZ, dims.interiorHeight) +
    interiorFilletRadiusMm(params);
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

/** Bounds of the compartment holding cell (col, row). */
function compartmentBoundsAt(params: BinParams, col: number, row: number): ScoopCompartmentBounds {
  const { cols, rows, cells } = params.compartments;
  if (cells.length !== cols * rows) {
    return { minCol: 0, maxCol: cols - 1, minRow: 0, maxRow: rows - 1 };
  }
  const id = cells[row * cols + col];
  let minCol = col;
  let maxCol = col;
  let minRow = row;
  let maxRow = row;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c] !== id) continue;
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
    }
  }
  return { minCol, maxCol, minRow, maxRow };
}

const PERPENDICULAR: Record<WallTextSide, readonly WallTextSide[]> = {
  front: ['left', 'right'],
  back: ['left', 'right'],
  left: ['front', 'back'],
  right: ['front', 'back'],
};

/** Corner cell where scooped wall `scooped` meets wall `side`. */
function cornerCell(
  params: BinParams,
  scooped: WallTextSide,
  side: WallTextSide
): { readonly col: number; readonly row: number } {
  const { cols, rows } = params.compartments;
  const lastCol = cols - 1;
  const lastRow = rows - 1;
  const alongX = scooped === 'front' || scooped === 'back';
  const row = alongX ? (scooped === 'front' ? 0 : lastRow) : side === 'front' ? 0 : lastRow;
  const col = alongX ? (side === 'left' ? 0 : lastCol) : scooped === 'left' ? 0 : lastCol;
  return { col, row };
}

/**
 * The end of a scoop ramp where it buries into the wall at a right angle to the
 * scooped one: from the corner out to the ramp's run, past its lip chute.
 */
function scoopEndObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  if (!scoopRampsApply(params)) return [];
  const { cols, rows } = params.compartments;
  const hasLip = params.base.stackingLip;
  const frame = scoopFrameHeights(dims.wallHeight, dims.interiorHeight, resolveBinFloorMm(params));
  const out: WallRect[] = [];
  for (const scooped of resolveScoopSides(params.scoop)) {
    if (!PERPENDICULAR[scooped].includes(side)) continue;
    const { col, row } = cornerCell(params, scooped, side);
    const placement = resolveScoopPlacement(scooped, compartmentBoundsAt(params, col, row), {
      cols,
      rows,
      innerW: dims.innerW,
      innerD: dims.innerD,
    });
    const lipOffset = computeLipOffset(
      hasLip,
      placement.isOuter,
      LIP_TAPER_WIDTH,
      params.wallThickness
    );
    const profile = resolveScoopProfile(
      params.scoop,
      placement.span,
      placement.depth,
      placement.isOuter,
      hasLip,
      frame.wallHeight,
      frame.interiorHeight,
      lipOffset
    );
    if (!profile) continue;
    const reach = lipOffset + profile.run;
    const half = side === 'front' || side === 'back' ? dims.innerW / 2 : dims.innerD / 2;
    const fromStart = scooped === 'front' || scooped === 'left';
    out.push({
      minU: fromStart ? -half : half - reach,
      maxU: fromStart ? -half + reach : half,
      minZ: -Infinity,
      maxZ: Infinity,
    });
  }
  return out;
}

function labelTabObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  const eps = 0.05;
  const out: WallRect[] = [];
  const footprints = labelTabFootprints(
    params,
    dims.innerW,
    dims.innerD,
    dims.interiorHeight,
    params.wallThickness
  );
  for (const f of footprints) {
    const touches =
      side === 'front'
        ? f.yMin <= -dims.innerD / 2 + eps
        : side === 'back'
          ? f.yMax >= dims.innerD / 2 - eps
          : side === 'left'
            ? f.xMin <= -dims.innerW / 2 + eps
            : f.xMax >= dims.innerW / 2 - eps;
    if (!touches) continue;
    const alongX = side === 'front' || side === 'back';
    out.push({
      minU: alongX ? f.xMin : f.yMin,
      maxU: alongX ? f.xMax : f.yMax,
      minZ: f.zMin,
      maxZ: f.zMax,
    });
  }
  return out;
}

function slideRailObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  if (!params.slide.enabled) return [];
  const geometry = resolveSlideGeometry(
    slideInputFromDims(
      params,
      {
        innerW: dims.innerW,
        innerD: dims.innerD,
        outerW: dims.innerW + 2 * params.wallThickness,
        outerD: dims.innerD + 2 * params.wallThickness,
        wallHeight: dims.wallHeight,
        collarHeight: collarHeightMm(params),
        hasLip: params.base.stackingLip,
        gridUnitMmX: params.gridUnitMm,
        isSlotted: params.style === 'slotted',
        solid: params.base.solid,
      },
      isPartialMask(params.cellMask)
    )
  );
  const keepOut = slidePatternKeepOut(geometry, side);
  if (!keepOut) return [];
  return [
    {
      minU: -keepOut.width / 2,
      maxU: keepOut.width / 2,
      minZ: keepOut.centerZ - keepOut.height / 2,
      maxZ: keepOut.centerZ + keepOut.height / 2,
    },
  ];
}

function collarHeightMm(params: BinParams): number {
  const raw = params.extraWallHeightMm ?? 0;
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

/** A label slot's boss, and the plate pocket a millimetre behind this face. */
function labelSlotObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  if (!resolveWallLabelSlots(params).enabled) return [];
  const plan = planWallLabelSlots(
    params,
    {
      wallHeightMm: dims.wallHeight + collarHeightMm(params),
      gridUnitMmX: params.gridUnitMm,
      gridUnitMmY: params.gridUnitMmY ?? params.gridUnitMm,
    },
    effectiveLabelSocketClearance(params.nozzleSizeMm, params.label.plateFitOffset)
  );
  return plan.slots
    .filter((slot) => slot.side === side)
    .map((slot) => ({
      minU: slot.offset - plan.bossWidthMm / 2,
      maxU: slot.offset + plan.bossWidthMm / 2,
      // The boss's underside runs back to the wall at 45°.
      minZ: plan.bossBottomZ - plan.bossDepthMm,
      maxZ: Infinity,
    }));
}

/**
 * Which magnet positions the bin carries pads at, or null for none. A hinge's
 * magnet catch keeps only its catch side, as `retentionMagnetPlacementsFor`
 * does; positions here are cavity-centred, so the split is at zero.
 */
function retentionPadFilter(params: BinParams): ((x: number, y: number) => boolean) | null {
  if (!params.lid.enabled || !params.base.stackingLip || isPartialMask(params.cellMask)) {
    return null;
  }
  if (params.lid.attachment === 'magnetic') return () => true;
  const hinge = planHingeLid(params).geometry;
  if (hinge?.catchMode !== 'magnets') return null;
  switch (hinge.catchSide) {
    case 'back':
      return (_x, y) => y > 0;
    case 'front':
      return (_x, y) => y < 0;
    case 'right':
      return (x) => x > 0;
    case 'left':
      return (x) => x < 0;
  }
}

/**
 * The bin's magnet pads, full height: their 45° gussets run a long way down
 * the corner, and a pad only a few millimetres wide costs little height to
 * clear entirely.
 */
function magnetPadObstacles(params: BinParams, side: WallTextSide): WallRect[] {
  const padded = retentionPadFilter(params);
  if (!padded) return [];
  const { diameter, edgeMagnets } = params.lid.retentionMagnet;
  const bossR = retentionBossRadius(diameter);
  const overhang = resolveOverhang(params.overhang);
  const expansion = hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  // Centred on the cavity rather than the grid, which is the clip frame.
  const positions = retentionMagnetPositions(
    params.width,
    params.depth,
    params.gridUnitMm,
    params.gridUnitMmY ?? params.gridUnitMm,
    retentionMagnetInset(diameter),
    edgeMagnets,
    bossR,
    expansion ? { ...expansion, offsetX: 0, offsetY: 0 } : null
  );
  const alongX = side === 'front' || side === 'back';
  const onSide = (v: number): boolean => (side === 'front' || side === 'left' ? v < 0 : v > 0);
  const out: WallRect[] = [];
  for (const p of positions) {
    const across = alongX ? p.y : p.x;
    const along = alongX ? p.x : p.y;
    const reaches = p.anchor === 'corner' || p.anchor === (alongX ? 'y' : 'x');
    if (!reaches || !onSide(across) || !padded(p.x, p.y)) continue;
    const corner = p.anchor === 'corner';
    out.push({
      minU: corner && along < 0 ? -Infinity : along - bossR,
      maxU: corner && along > 0 ? Infinity : along + bossR,
      minZ: -Infinity,
      maxZ: Infinity,
    });
  }
  return out;
}

/** Everything standing on, or cut just behind, the inner face of `side`. */
export function insideWallObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  return [
    ...labelTabObstacles(params, dims, side),
    ...slideRailObstacles(params, dims, side),
    ...labelSlotObstacles(params, dims, side),
    ...magnetPadObstacles(params, side),
    ...scoopEndObstacles(params, dims, side),
  ];
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
