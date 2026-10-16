/**
 * What stands on, or is cut just behind, the inner face of an outer wall, as
 * rectangles in the clip frame `insideWallTextPlan` places captions in: `u`
 * along +X (front/back) or +Y (left/right) centred on the cavity, `z` above
 * the box bottom. Each collector mirrors the planner its feature is built
 * from, read from params alone so the designer's ghost overlay agrees with the
 * worker.
 */

import type { BinParams, WallTextSide } from '@/shared/types/bin';
import {
  MAX_COMPARTMENT_FLOOR_RAISE_MM,
  MIN_RAISED_CAVITY_MM,
  compartmentHasTiltedEdge,
  isNestingBase,
  isRectangularCompartment,
  retentionBossRadius,
  retentionMagnetInset,
} from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import { isPartialMask } from '@/shared/utils/cellMask';
import {
  hasOverhang,
  overhangExpansion,
  resolveOverhang,
  taperInsetAt,
} from '@/shared/utils/overhang';
import { labelTabFootprints } from '@/shared/utils/labelTabPlan';
import { interiorFilletCornerMm, interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { retentionMagnetPositions } from '@/shared/utils/retentionMagnetPlacement';
import {
  computeLipOffset,
  resolveScoopPlacement,
  resolveScoopProfile,
  resolveScoopSides,
  scoopArcAnchors,
  scoopFaceOffset,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import type { ScoopCompartmentBounds } from '@/shared/utils/scoopCalculations';
import {
  resolveSlideGeometry,
  sectionBounds,
  slideInputFromDims,
} from '@/shared/utils/slideGeometry';
import { isLiteFloorOpen, resolveBinFloorMm } from '@/shared/utils/slotMath';
import { planWallLabelSlots, resolveWallLabelSlots } from '@/shared/utils/wallLabelSlotPlan';
import {
  computeCutoutCenter,
  cornerSlackFor,
  resolveCutoutCornerRadii,
  resolveCutoutDrop,
  resolveCutoutSpan,
  safeCutoutCornerRadii,
} from '@/shared/utils/wallCutoutPosition';
import type { WallRect } from '@/shared/utils/maximalClearRects';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/** Slack in "does this feature touch the wall plane" tests (mm). */
const TOUCH_EPS = 0.05;

/** What the inside path reads beyond params, as the caller already resolved it. */
export interface InsideWallDims {
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly interiorHeight: number;
}

const PERPENDICULAR: Record<WallTextSide, readonly WallTextSide[]> = {
  front: ['left', 'right'],
  back: ['left', 'right'],
  left: ['front', 'back'],
  right: ['front', 'back'],
};

const alongX = (side: WallTextSide): boolean => side === 'front' || side === 'back';

/**
 * Radius of the cavity's vertical corners, widened by an interior fillet when
 * one rounds them further. A wall's flat inner face stops this far short of
 * the face it meets.
 */
export function cavityCornerRadiusMm(params: BinParams): number {
  return Math.max(
    GRIDFINITY_SPEC.BOX_CORNER_RADIUS - params.wallThickness,
    interiorFilletCornerMm(params)
  );
}

/** Half the span of `side` along its own u axis. */
const halfSpan = (side: WallTextSide, dims: InsideWallDims): number =>
  alongX(side) ? dims.innerW / 2 : dims.innerD / 2;

/** Mirrors the worker's `scoopRampsApply` from params alone. */
export function scoopRampsApply(params: BinParams): boolean {
  return (
    params.scoop.enabled &&
    params.style === 'standard' &&
    !isPartialMask(params.cellMask) &&
    !isNestingBase(params.base) &&
    !isLiteFloorOpen(params)
  );
}

/**
 * Each compartment's floor raise as the generator builds it. Nothing on a body
 * the raised-floor feature skips (a raise survives a style change), and
 * otherwise as `resolveFloorRaises` does: requests for a compartment that no
 * longer exists or has a tilted edge are dropped, and the rest are held below
 * the ceiling.
 */
function builtFloorRaises(
  params: BinParams,
  floorZ: number,
  interiorHeight: number
): Map<number, number> {
  const out = new Map<number, number>();
  const raises = params.compartments.floorRaises;
  if (!raises || isPartialMask(params.cellMask)) return out;
  if (params.style !== 'standard' || params.base.solid || params.base.tile === true) return out;
  if (isLiteFloorOpen(params) || isNestingBase(params.base)) return out;
  const ceiling = Math.min(
    MAX_COMPARTMENT_FLOOR_RAISE_MM,
    interiorHeight - floorZ - MIN_RAISED_CAVITY_MM
  );
  if (ceiling <= 0) return out;
  const ids = new Set(params.compartments.cells);
  raises.forEach((raise, id) => {
    if (typeof raise !== 'number' || !Number.isFinite(raise) || raise <= 0) return;
    if (!ids.has(id) || compartmentHasTiltedEdge(params.compartments, id)) return;
    out.set(id, Math.min(raise, ceiling));
  });
  return out;
}

/** Every compartment with its cell bounds. */
function compartmentBounds(params: BinParams): { id: number; bounds: ScoopCompartmentBounds }[] {
  const { cols, rows, cells } = params.compartments;
  if (cells.length !== cols * rows) {
    return [{ id: 0, bounds: { minCol: 0, maxCol: cols - 1, minRow: 0, maxRow: rows - 1 } }];
  }
  const byId = new Map<
    number,
    { minCol: number; maxCol: number; minRow: number; maxRow: number }
  >();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cells[r * cols + c];
      const b = byId.get(id);
      if (!b) byId.set(id, { minCol: c, maxCol: c, minRow: r, maxRow: r });
      else {
        b.minCol = Math.min(b.minCol, c);
        b.maxCol = Math.max(b.maxCol, c);
        b.minRow = Math.min(b.minRow, r);
        b.maxRow = Math.max(b.maxRow, r);
      }
    }
  }
  return [...byId].map(([id, bounds]) => ({ id, bounds }));
}

function touchesWall(params: BinParams, b: ScoopCompartmentBounds, side: WallTextSide): boolean {
  const { cols, rows } = params.compartments;
  if (side === 'front') return b.minRow === 0;
  if (side === 'back') return b.maxRow === rows - 1;
  if (side === 'left') return b.minCol === 0;
  return b.maxCol === cols - 1;
}

/**
 * Where a compartment's scoop ramp buries into this wall at a right angle to
 * the scooped one: from the ramp's wall out along its run, past any lip chute.
 * Every compartment against this wall that `planScoopRamps` builds a ramp for,
 * not only the corner ones. An outer ramp's chute climbs to the wall top; an
 * inner ramp stops at its rise.
 */
function scoopEndObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  if (!scoopRampsApply(params)) return [];
  const { cols, rows } = params.compartments;
  const hasLip = params.base.stackingLip;
  const floorZ = resolveBinFloorMm(params);
  const raises = builtFloorRaises(params, floorZ, dims.interiorHeight);
  const taper = resolveOverhang(params.overhang).taper;
  const grid = { cols, rows, innerW: dims.innerW, innerD: dims.innerD };
  const out: WallRect[] = [];
  for (const scooped of resolveScoopSides(params.scoop)) {
    if (!PERPENDICULAR[scooped].includes(side)) continue;
    for (const { id, bounds } of compartmentBounds(params)) {
      if (!touchesWall(params, bounds, side)) continue;
      if (compartmentHasTiltedEdge(params.compartments, id)) continue;
      if (!isRectangularCompartment(params.compartments, id)) continue;
      const placement = resolveScoopPlacement(scooped, bounds, grid);
      const compFloorZ = floorZ + (raises.get(id) ?? 0);
      const frame = scoopFrameHeights(dims.wallHeight, dims.interiorHeight, compFloorZ);
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
      // Where the arc meets the floor, as `planScoopRamps` places it: a tapered
      // outer wall leans inboard toward the floor and carries the ramp with it.
      const wallAt = (zAboveFloor: number): number =>
        taper && placement.isOuter
          ? taperInsetAt(taper, taper[scooped], compFloorZ + zAboveFloor, dims.wallHeight)
          : 0;
      const { floorStart } = scoopArcAnchors(
        lipOffset,
        wallAt(profile.height),
        wallAt(0),
        scoopFaceOffset(placement.isOuter, params.compartments.thickness)
      );
      const run = Math.min(profile.run, placement.depth - 0.5 - floorStart);
      if (run < 1) continue;
      const reach = floorStart + run;
      const [minU, maxU] =
        placement.runSign > 0
          ? [placement.edge, placement.edge + reach]
          : [placement.edge - reach, placement.edge];
      out.push({
        minU,
        maxU,
        minZ: -Infinity,
        maxZ: placement.isOuter && hasLip ? Infinity : compFloorZ + profile.height,
      });
    }
  }
  return out;
}

/**
 * A raised compartment floor, and the fillet on it, along the stretch of this
 * wall that compartment occupies. The slab is built within its own cells.
 */
function raisedFloorObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  const floorZ = resolveBinFloorMm(params);
  const raises = builtFloorRaises(params, floorZ, dims.interiorHeight);
  if (raises.size === 0) return [];
  const { cols, rows } = params.compartments;
  const fillet = interiorFilletRadiusMm(params);
  const out: WallRect[] = [];
  for (const { id, bounds } of compartmentBounds(params)) {
    const raise = raises.get(id);
    if (raise === undefined || !touchesWall(params, bounds, side)) continue;
    const [first, last, count, span] = alongX(side)
      ? [bounds.minCol, bounds.maxCol, cols, dims.innerW]
      : [bounds.minRow, bounds.maxRow, rows, dims.innerD];
    const pitch = span / count;
    out.push({
      minU: -span / 2 + first * pitch,
      maxU: -span / 2 + (last + 1) * pitch,
      minZ: -Infinity,
      maxZ: floorZ + raise + fillet,
    });
  }
  return out;
}

/**
 * Label tabs on this wall, and those inset from it by no more than the
 * caption reaches into the cavity, which an embossed caption would run into.
 */
function labelTabObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide,
  reachMm: number
): WallRect[] {
  const near = reachMm + TOUCH_EPS;
  const out: WallRect[] = [];
  const footprints = labelTabFootprints(
    params,
    dims.innerW,
    dims.innerD,
    dims.interiorHeight,
    params.wallThickness
  );
  for (const f of footprints) {
    const gap =
      side === 'front'
        ? f.yMin + dims.innerD / 2
        : side === 'back'
          ? dims.innerD / 2 - f.yMax
          : side === 'left'
            ? f.xMin + dims.innerW / 2
            : dims.innerW / 2 - f.xMax;
    if (gap > near) continue;
    out.push({
      minU: alongX(side) ? f.xMin : f.yMin,
      maxU: alongX(side) ? f.xMax : f.yMax,
      minZ: f.zMin,
      maxZ: f.zMax,
    });
  }
  return out;
}

function collarHeightMm(params: BinParams): number {
  const raw = params.extraWallHeightMm ?? 0;
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

/**
 * Sliding-tray rails: along the wall they are fused to, and where their ends
 * meet the two walls across it.
 */
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
  const out: WallRect[] = [];
  for (const rail of geometry.rails) {
    const b = sectionBounds(rail);
    const z = { minZ: b.zMin, maxZ: b.zMax };
    if (side === 'front' && b.yMin <= -dims.innerD / 2 + TOUCH_EPS) {
      out.push({ minU: rail.xMin, maxU: rail.xMax, ...z });
    } else if (side === 'back' && b.yMax >= dims.innerD / 2 - TOUCH_EPS) {
      out.push({ minU: rail.xMin, maxU: rail.xMax, ...z });
    } else if (side === 'left' && rail.xMin <= -dims.innerW / 2 + TOUCH_EPS) {
      out.push({ minU: b.yMin, maxU: b.yMax, ...z });
    } else if (side === 'right' && rail.xMax >= dims.innerW / 2 - TOUCH_EPS) {
      out.push({ minU: b.yMin, maxU: b.yMax, ...z });
    }
  }
  return out;
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
  const onSide = (v: number): boolean => (side === 'front' || side === 'left' ? v < 0 : v > 0);
  const out: WallRect[] = [];
  for (const p of positions) {
    const across = alongX(side) ? p.y : p.x;
    const along = alongX(side) ? p.x : p.y;
    const reaches = p.anchor === 'corner' || p.anchor === (alongX(side) ? 'y' : 'x');
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

/**
 * Where a tapered neighbour leans in over this wall's ends. Below the taper
 * band its inner face sits inboard of the rim plane by up to the side's inset,
 * and carries the rounded corner in with it, so a caption at that end would
 * run into either.
 */
function taperCornerObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  const taper = resolveOverhang(params.overhang).taper;
  if (!taper) return [];
  const half = halfSpan(side, dims);
  const band = Math.min(taper.bandHeight, dims.wallHeight);
  const corner = cavityCornerRadiusMm(params);
  const out: WallRect[] = [];
  for (const neighbour of PERPENDICULAR[side]) {
    const inset = taper[neighbour];
    if (inset <= 1e-6) continue;
    const atStart = neighbour === 'front' || neighbour === 'left';
    out.push({
      minU: atStart ? -Infinity : half - inset - corner,
      maxU: atStart ? -half + inset + corner : Infinity,
      minZ: -Infinity,
      maxZ: band,
    });
  }
  return out;
}

/**
 * A wall cutout's rounded top shoulders, which widen the opening past its
 * nominal span near the rim, at the radii the cutout builder settles on.
 */
function cutoutShoulderObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide
): WallRect[] {
  const cutout = params.walls.enabled ? params.walls[side] : undefined;
  if (!cutout?.enabled) return [];
  const wallSpan = 2 * halfSpan(side, dims);
  const cutWidth = resolveCutoutSpan(cutout, wallSpan);
  const cutHeight = resolveCutoutDrop(cutout, dims.wallHeight - params.wallThickness);
  if (cutWidth < 0.1 || cutHeight < 0.1) return [];
  const centerU = computeCutoutCenter(
    wallSpan,
    cutWidth,
    params.wallThickness,
    cutout.alignment,
    cutout.offset
  );
  const lipRoom = params.base.stackingLip ? GRIDFINITY_SPEC.LIP_HEIGHT : 0;
  const { topLeft, topRight } = safeCutoutCornerRadii(
    resolveCutoutCornerRadii(params.walls, cutout, cutWidth),
    cutWidth,
    cutHeight,
    lipRoom,
    cornerSlackFor(wallSpan, cutWidth, centerU)
  );
  if (topLeft <= 0 && topRight <= 0) return [];
  // The cutout builder stands on the uncollared wall height; a collar does not
  // lift the cut.
  const rim = dims.wallHeight + lipRoom;
  return [
    {
      minU: centerU - cutWidth / 2 - topLeft,
      maxU: centerU + cutWidth / 2 + topRight,
      minZ: rim - Math.max(topLeft, topRight),
      maxZ: Infinity,
    },
  ];
}

/**
 * Everything standing on, or cut just behind, the inner face of `side`.
 * `reachMm` is how far the caption itself stands into the cavity.
 */
export function insideWallObstacles(
  params: BinParams,
  dims: InsideWallDims,
  side: WallTextSide,
  reachMm: number
): WallRect[] {
  return [
    ...raisedFloorObstacles(params, dims, side),
    ...labelTabObstacles(params, dims, side, reachMm),
    ...slideRailObstacles(params, dims, side),
    ...labelSlotObstacles(params, dims, side),
    ...magnetPadObstacles(params, side),
    ...scoopEndObstacles(params, dims, side),
    ...taperCornerObstacles(params, dims, side),
    ...cutoutShoulderObstacles(params, dims, side),
  ];
}
