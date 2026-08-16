/**
 * Bin floor pattern placement — drainage / ventilation perforation.
 *
 * Pure data module; `floorPatternBuilder` turns this into geometry.
 *
 * The governing constraint is the base socket. A drainage hole has to leave the
 * bin, which means passing through the floor slab AND the foot under it — but
 * the foot's tapered flank is the baseplate-mating surface and must not be
 * touched. Its flat underside is inset {@link INSET_BOT} from the cell edge, so
 * every hole is confined to a per-foot WINDOW inset from that cell: the hole
 * enters the cavity floor and exits the foot's underside, never its taper.
 *
 * That is also why the windows come from the socket's own cell list
 * (`filledSocketCells`) rather than the interior rectangle — a cell the socket
 * builder skipped (empty mask region, sub-threshold fractional fringe) has no
 * foot to exit through, and the overhang region deliberately has none either.
 * Flat-base bins have no socket at all and take a single interior-wide window.
 *
 * Windows are described in their OWN frame — `u` along X and `v` along Y, both
 * zero at the window centre — so the builder can hand them straight to the
 * shared panel factory and place each with one translate.
 */

import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { PatternPanelSpec } from './dividerPatterns';
import type { WorldKeepOut } from './dividerPatterns';
import { scoopKeepOuts } from './dividerPatterns';
import { interiorDividerSegments } from './compartmentBuilder';
import { filledSocketCells } from './socketBuilder';
import { magnetPositionsForCell } from './baseplateMagnets';
import { forEachCell } from './cellDecomposition';
import { FLOOR_PATTERN_BORDER, floorWindowInset } from './floorPatternWindow';
import { CLEARANCE, COPLANAR_MARGIN } from './generatorConstants';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { BinDimensions } from './pipeline/types';

/** One patternable floor region: placement, extent, and its keep-outs. */
export interface FloorPatternWindow extends PatternPanelSpec {
  /** Window centre in bin-centred mm. */
  readonly x: number;
  readonly y: number;
  /** Extent the pattern may fill along Y (`patternSpan` covers X). */
  readonly patternDepth: number;
}

/** Resolved floor-pattern layout for a bin. */
export interface FloorPatternPlan {
  readonly windows: readonly FloorPatternWindow[];
  /** Bottom of the cut in the pre-translate body frame (Z=0 = socket top). */
  readonly cutZ0: number;
  /** Top of the cut in the same frame. */
  readonly cutZ1: number;
}

/**
 * Whether the floor-pattern feature applies at all.
 *
 * Solid bins have no floor distinct from the body, and an interior lightweight
 * base already replaces the slab + feet with shelled cups whose floor is open.
 *
 * The underside relief keeps the slab, so it keeps the pattern: the holes still
 * enter the cavity floor, and the relief cavity they now exit into is itself
 * open to the outside, so they still drain. `dim.liteFloorOpen` is what draws
 * that line — reading `dim.lightweight` would refuse a bin that has exactly the
 * floor a standard bin has.
 *
 * `style === 'solid'` is checked alongside `dim.solid` (which only reflects
 * `base.solid`) because the two are kept in lockstep by an IMPLICATION_RULE at
 * runtime, not by `migrateParams` — so a crafted or hand-edited design can
 * carry one without the other, and this must refuse the same bins the
 * constraint engine and the timeout budget do.
 */
export function floorPatternApplies(params: BinParams, dim: BinDimensions): boolean {
  if (params.floorPattern?.enabled !== true) return false;
  if (dim.solid || params.style === 'solid' || dim.liteFloorOpen) return false;
  return dim.innerW > 0 && dim.innerD > 0;
}

/** Grow a world-space footprint by the solid border. */
function inflate(box: WorldKeepOut, by: number): WorldKeepOut {
  return {
    xMin: box.xMin - by,
    xMax: box.xMax + by,
    yMin: box.yMin - by,
    yMax: box.yMax + by,
    zMin: box.zMin,
    zMax: box.zMax,
  };
}

/**
 * Magnet / screw pocket footprints in bin-centred mm.
 *
 * Taken from the FULL cell decomposition, matching `buildBaseSocket` — under
 * `halfSockets` the feet subdivide but the pockets stay on the standard grid so
 * they keep mating with the baseplate.
 */
function attachmentKeepOuts(params: BinParams, dim: BinDimensions): WorldKeepOut[] {
  if (!dim.withMagnet && !dim.withScrew) return [];
  const radius = Math.max(
    dim.withMagnet ? params.base.magnetDiameter / 2 : 0,
    dim.withScrew ? params.base.screwDiameter / 2 : 0
  );
  if (radius <= 0) return [];

  const out: WorldKeepOut[] = [];
  forEachCell(
    params.width,
    params.depth,
    (cell) => {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
      for (const [x, y] of magnetPositionsForCell(
        cell,
        radius,
        dim.gridUnitMmX,
        dim.gridUnitMmY,
        params.magnetAnchor ?? DEFAULT_MAGNET_ANCHOR
      )) {
        out.push({
          xMin: x - radius,
          xMax: x + radius,
          yMin: y - radius,
          yMax: y + radius,
          zMin: 0,
          zMax: 0,
        });
      }
    },
    {
      gridUnitMm: { x: dim.gridUnitMmX, y: dim.gridUnitMmY },
      fractionalEdgeX: params.fractionalEdgeX,
      fractionalEdgeY: params.fractionalEdgeY,
    }
  );
  return out;
}

/**
 * Footprints of everything that stands on the floor and would be left bridging
 * a hole: compartment dividers and scoop ramps.
 *
 * A tilted divider contributes its axis-aligned bounding box, which clears more
 * than the wall strictly covers — the safe direction, and the same convention
 * `dividerPatterns` uses for label tabs.
 */
function standingFeatureKeepOuts(params: BinParams, dim: BinDimensions): WorldKeepOut[] {
  const { innerW, innerD, innerOffsetX, innerOffsetY } = dim;
  const out: WorldKeepOut[] = [];

  // Polygon footprints have dividers and scoops filtered out of the feature
  // pipeline entirely (see `featuresStage`), so nothing stands on their floor.
  if (isPartialMask(params.cellMask)) return out;

  if (!dim.isSlotted && params.compartments.thickness > 0) {
    const half = params.compartments.thickness / 2;
    for (const seg of interiorDividerSegments(params, innerW, innerD)) {
      const rad = (seg.rotateZ * Math.PI) / 180;
      const halfX = Math.abs(Math.cos(rad)) * (seg.wallLen / 2) + Math.abs(Math.sin(rad)) * half;
      const halfY = Math.abs(Math.sin(rad)) * (seg.wallLen / 2) + Math.abs(Math.cos(rad)) * half;
      out.push({
        xMin: seg.x - halfX,
        xMax: seg.x + halfX,
        yMin: seg.y - halfY,
        yMax: seg.y + halfY,
        zMin: 0,
        zMax: 0,
      });
    }
  }

  out.push(...scoopKeepOuts(params, dim));

  // Divider segments and scoop footprints are both resolved in the interior
  // frame; an asymmetric overhang shifts that frame relative to the bin origin.
  if (innerOffsetX === 0 && innerOffsetY === 0) return out;
  return out.map((k) => ({
    ...k,
    xMin: k.xMin + innerOffsetX,
    xMax: k.xMax + innerOffsetX,
    yMin: k.yMin + innerOffsetY,
    yMax: k.yMax + innerOffsetY,
  }));
}

/** Clip world keep-outs into one window's local (u, v) frame. */
function localKeepOuts(
  world: readonly WorldKeepOut[],
  cx: number,
  cy: number,
  halfW: number,
  halfD: number
): PatternPanelSpec['keepOuts'] {
  const out: { uMin: number; uMax: number; zMin: number; zMax: number }[] = [];
  for (const k of world) {
    const uMin = k.xMin - cx;
    const uMax = k.xMax - cx;
    const vMin = k.yMin - cy;
    const vMax = k.yMax - cy;
    if (uMax <= -halfW || uMin >= halfW || vMax <= -halfD || vMin >= halfD) continue;
    out.push({ uMin, uMax, zMin: vMin, zMax: vMax });
  }
  return out;
}

/**
 * Resolve the floor pattern layout, or null when nothing can be patterned.
 *
 * Every returned window is already inset for the socket taper and the wall, so
 * the builder only has to fit elements inside it.
 */
export function planFloorPattern(params: BinParams, dim: BinDimensions): FloorPatternPlan | null {
  if (!floorPatternApplies(params, dim)) return null;

  const inset = floorWindowInset(params.wallThickness);
  const border = FLOOR_PATTERN_BORDER;
  // Inflated once, not per window: a magnet base contributes four keep-outs per
  // cell, so re-inflating inside `addWindow` would be O(windows x keep-outs)
  // allocations for a result that never varies by window.
  const worldKeepOuts = [
    ...attachmentKeepOuts(params, dim),
    ...standingFeatureKeepOuts(params, dim),
  ].map((k) => inflate(k, border));

  const windows: FloorPatternWindow[] = [];
  const addWindow = (cx: number, cy: number, spanX: number, spanY: number): void => {
    if (spanX <= 0 || spanY <= 0) return;
    windows.push({
      x: cx,
      y: cy,
      patternSpan: spanX,
      patternDepth: spanY,
      keepOuts: localKeepOuts(worldKeepOuts, cx, cy, spanX / 2, spanY / 2),
    });
  };

  if (dim.socketless) {
    // No socket to thread the holes through — the whole cavity floor is fair
    // game, minus the rim that bonds it to the walls.
    addWindow(dim.innerOffsetX, dim.innerOffsetY, dim.innerW - 2 * border, dim.innerD - 2 * border);
  } else {
    for (const cell of filledSocketCells(
      params.width,
      params.depth,
      params.cellMask,
      { x: dim.gridUnitMmX, y: dim.gridUnitMmY },
      dim.socketCellPlan,
      { x: params.fractionalEdgeX, y: params.fractionalEdgeY }
    )) {
      const cellW = cell.widthUnits * dim.gridUnitMmX - CLEARANCE;
      const cellD = cell.depthUnits * dim.gridUnitMmY - CLEARANCE;
      addWindow(cell.centerX, cell.centerY, cellW - 2 * inset, cellD - 2 * inset);
    }
  }

  if (windows.length === 0) return null;

  // The cut spans the floor slab and, on socket bins, the foot below it.
  // COPLANAR_MARGIN on both ends keeps the tool's end faces off the solid's
  // own faces, which OCCT resolves into non-manifold topology.
  //
  // An underside-relieved foot stops the cut at the floor. There is nothing
  // below to thread the hole through — the relief cavity is already open to the
  // outside, so the hole drains the moment it clears the slab — and reaching
  // further would only eat the ring. The window is inset 1.5mm + INSET_BOT from
  // the foot's TOP edge, while the ring's bore narrows with the taper going
  // down, so the two cross about a third of the way up: a full-depth cut would
  // take up to 1.5mm off the inside of the ring's bottom face, exactly where the
  // part meets the bed. Above Z=0 the bore is wider than the window on every
  // cell, so the shortened tool clears the ring entirely.
  return {
    windows,
    cutZ0: dim.undersideRelief ? -COPLANAR_MARGIN : -dim.baseOffsetZ - COPLANAR_MARGIN,
    cutZ1: params.wallThickness + COPLANAR_MARGIN,
  };
}
