/**
 * Socket cell generation for Gridfinity bin bases.
 *
 * Builds the segmented base socket grid: per-cell tapered frustum sockets
 * (full 42mm + half 21mm cells) with optional magnet/screw holes.
 *
 * Socket coordinate system:
 * - Z=0: top face (mates with bin body)
 * - Z=-SOCKET_HEIGHT: bottom face
 */

import {
  drawRoundedRectangle,
  cylinder,
  unwrap,
  fuseAll,
  cutAll,
  clone,
  translate,
  fuse,
  withScope,
  booleanPipeline,
  isOk,
} from 'brepjs';
import type { Shape3D, ValidSolid, Sketch, DisposalScope, BooleanPipelineStep } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  CORNER_RADIUS,
  COPLANAR_MARGIN,
  pocketCornerRadius,
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_VERTICAL_PART,
  SOCKET_TAPER_WIDTH,
  MIN_PRINTABLE_TILE_MM,
  forEachCell,
  frameCells,
  type CellInfo,
} from './generatorTypes';
import { hasOverhang, overhangBaseSides, type ResolvedOverhang } from './overhang';
import {
  socketCacheKey,
  getSocketCache,
  setSocketCache,
  getCellSocketTemplateCache,
  setCellSocketTemplateCache,
} from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { resolvePitch, type GridUnitInput } from './gridPitch';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './baseplateMagnets';
import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import {
  hasHalfBinDetail,
  hashMask,
  isPartialMask,
  isRegionFilled,
  type CellMask,
} from '@/shared/utils/cellMask';
import type { FootLattice } from '@/shared/types/bin';
import { isFractional } from '@/core/constants';

/**
 * Smallest printable edge foot, in mm. A fractional bin whose trailing strip is
 * narrower than this drops the foot entirely (flat bottom there) rather than
 * emit a degenerate sliver. Shares the project-wide printable-tile floor so it
 * can't drift from the baseplate over-tile rule.
 */
export const MIN_FOOT_TILE_MM = MIN_PRINTABLE_TILE_MM;

/**
 * Which side a fractional (half-unit) foot column/row sits on. `'end'` (default)
 * places it at the positive coordinate side; `'start'` at the negative side.
 */
export interface FractionalEdge {
  readonly x: 'start' | 'end';
  readonly y: 'start' | 'end';
}

export const DEFAULT_FRACTIONAL_EDGE: FractionalEdge = { x: 'end', y: 'end' };

/**
 * Where one axis's feet fall relative to the plate's cell boundaries.
 * Re-exported from the canonical `BaseConfig` definition so the generator and
 * the stored param can never describe different sets of values.
 */
export type { FootLattice };

/**
 * The foot layout the socket walk builds, resolved from the user's base
 * settings and the bin's mask.
 *
 * A foot has to land inside one pocket — adjacent pockets are separated by a
 * ridge — so which layout seats depends on where the bin sits, PER AXIS. Half-bin
 * mode can place a bin half a unit off-grid on one axis and on-grid on the
 * other, and a layout applied to both axes at once straddles ridges on whichever
 * one it got wrong.
 */
export interface SocketCellPlan {
  /** Uniform 0.5u feet everywhere: seats at either offset, at the most feet. */
  readonly halfSockets: boolean;
  readonly latticeX: FootLattice;
  readonly latticeY: FootLattice;
}

/** Plain full-cell feet on both axes — the older layout. */
export const DEFAULT_SOCKET_CELL_PLAN: SocketCellPlan = {
  halfSockets: false,
  latticeX: 'grid',
  latticeY: 'grid',
};

/**
 * A fractional axis ignores the `half` lattice.
 *
 * Such an axis already carries a half cell, and `fractionalEdge` decides which
 * end it sits on — which covers BOTH placements on its own ('end' seats on-grid,
 * 'start' seats half-offset). The lattice can only add a layout that seats at
 * one of them and perches at the other, and `computeMatchedFootLattice`
 * deliberately skips fractional axes, so nothing would warn about it.
 */
function axisLattice(lattice: FootLattice | undefined, units: number): FootLattice {
  return lattice === 'half' && !isFractional(units) ? 'half' : 'grid';
}

/**
 * Fold the base settings, the bin's size and its mask into the plan the socket
 * walk consumes.
 *
 * `halfSockets` overrides both lattices: uniform 0.5u feet already seat at
 * either offset, so a lattice choice on top would only cost feet.
 *
 * A partial `cellMask` also forces `grid`. The mask is authored against the
 * standard grid, and the `half` lattice moves every interior boundary half a
 * unit off it — the mask's fill test would then straddle two authored cells and
 * silently drop feet along an inner corner. The UI says so rather than offering
 * a lattice that would not be honoured.
 */
export function resolveSocketCellPlan(
  halfSockets: boolean,
  latticeX: FootLattice | undefined,
  latticeY: FootLattice | undefined,
  mask: CellMask | undefined,
  gridW: number,
  gridD: number
): SocketCellPlan {
  if (halfSockets) return { halfSockets: true, latticeX: 'grid', latticeY: 'grid' };
  if (isPartialMask(mask)) return DEFAULT_SOCKET_CELL_PLAN;
  return {
    halfSockets: false,
    latticeX: axisLattice(latticeX, gridW),
    latticeY: axisLattice(latticeY, gridD),
  };
}

/** Stable key fragment for a plan; empty for the older default. */
export function socketCellPlanKey(plan: SocketCellPlan): string {
  if (plan.halfSockets || (plan.latticeX === 'grid' && plan.latticeY === 'grid')) return '';
  return `lat:${plan.latticeX}:${plan.latticeY}`;
}

/**
 * Walk the grid the same way `forEachCell` does, emitting the cells the base
 * grows a foot on.
 *
 * `halfSockets` halves every cell. Otherwise each axis takes its own lattice:
 * `grid` is full cells (plus the fractional edge cell), `half` is a 0.5u cell at
 * both rims with full cells between, which is what seats when the bin sits half
 * a unit off-grid on that axis.
 *
 * Independently of the plan, a 1u cell in a mask with mixed half-bin detail is
 * split into four 0.5u quarter-sub-cells so the foot follows the authored
 * shape. Uniform 1u cells stay one full socket; the trailing fractional fringe
 * (natural 0.5u cells from `decomposeCells`) is untouched.
 */
export function forEachSocketCell(
  gridW: number,
  gridD: number,
  mask: CellMask | undefined,
  gridUnitMm: GridUnitInput,
  plan: SocketCellPlan,
  callback: (cell: CellInfo) => void,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE
): void {
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);

  if (plan.halfSockets) {
    // Uniform 0.5u feet on every axis, so the grid is symmetric and
    // `fractionalEdge` has no foot to reposition — intentionally omitted (the
    // UI hides the edge controls in this mode).
    forEachCell(gridW, gridD, callback, { halfSockets: true, gridUnitMm });
    return;
  }

  const totalW_mm = gridW * unitX;
  const totalD_mm = gridD * unitY;

  const needsPerCellSplit = mask !== undefined && isPartialMask(mask) && hasHalfBinDetail(mask);

  if (!needsPerCellSplit) {
    // Fractional feet: a non-0.5 trailing dimension (e.g. 1.7u) gets a clipped
    // edge foot matching the true footprint instead of snapping to a half cell.
    // Backward-safe — multiples of 0.5 decompose identically. Sub-threshold
    // slivers are dropped (flat bottom), mirroring the over-tile baseplate. The
    // physical drop threshold (MIN_FOOT_TILE_MM) maps to a different grid-unit
    // count per axis under a non-square pitch.
    forEachCell(gridW, gridD, callback, {
      gridUnitMm,
      fractional: true,
      edgeBandX: plan.latticeX === 'half',
      edgeBandY: plan.latticeY === 'half',
      minFractionUnitsX: MIN_FOOT_TILE_MM / unitX,
      minFractionUnitsY: MIN_FOOT_TILE_MM / unitY,
      fractionalEdgeX: fractionalEdge.x,
      fractionalEdgeY: fractionalEdge.y,
    });
    return;
  }

  forEachCell(
    gridW,
    gridD,
    (cell) => {
      // Fractional-edge cells (0.5u) are already half-cells; emit them as-is.
      if (cell.widthUnits !== 1 || cell.depthUnits !== 1) {
        callback(cell);
        return;
      }

      // Map cell center back to bottom-left of the mask region (in grid units).
      const leftUnit = (cell.centerX + totalW_mm / 2 - unitX / 2) / unitX;
      const bottomUnit = (cell.centerY + totalD_mm / 2 - unitY / 2) / unitY;

      // A 1u cell is "mixed" when its 1u mask region is neither fully
      // filled nor fully empty. Uniform-filled emits one full socket;
      // uniform-empty is caught by the outer `cellInMask` filter.
      if (isRegionFilled(mask, leftUnit, bottomUnit, 1, 1)) {
        callback(cell);
        return;
      }

      // Split into four 0.5u quarter-sub-cells. The outer cellInMask check
      // filters empty quarters so only filled half-cells produce sockets.
      const qx = unitX / 4;
      const qy = unitY / 4;
      for (const [dx, dy] of [
        [-qx, -qy],
        [qx, -qy],
        [-qx, qy],
        [qx, qy],
      ] as const) {
        callback({
          widthUnits: 0.5,
          depthUnits: 0.5,
          centerX: cell.centerX + dx,
          centerY: cell.centerY + dy,
        });
      }
    },
    { gridUnitMm, fractionalEdgeX: fractionalEdge.x, fractionalEdgeY: fractionalEdge.y }
  );
}
/**
 * The socket cells this bin actually grows a foot on — {@link forEachSocketCell}
 * with the cell-mask filter applied.
 *
 * Shared with the floor pattern, whose holes must exit through a foot's
 * flat underside rather than its baseplate-mating taper; it therefore needs the
 * same cell list the socket is built from, not a re-derivation of it.
 */
export function filledSocketCells(
  gridW: number,
  gridD: number,
  mask: CellMask | undefined,
  gridUnitMm: GridUnitInput,
  plan: SocketCellPlan,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE
): CellInfo[] {
  const usingMask = isPartialMask(mask);
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const totalW_mm = gridW * unitX;
  const totalD_mm = gridD * unitY;

  const cells: CellInfo[] = [];
  forEachSocketCell(
    gridW,
    gridD,
    mask,
    gridUnitMm,
    plan,
    (cell) => {
      if (usingMask) {
        const leftUnit = (cell.centerX + totalW_mm / 2 - (cell.widthUnits * unitX) / 2) / unitX;
        const bottomUnit = (cell.centerY + totalD_mm / 2 - (cell.depthUnits * unitY) / 2) / unitY;
        if (!isRegionFilled(mask, leftUnit, bottomUnit, cell.widthUnits, cell.depthUnits)) return;
      }
      cells.push(cell);
    },
    fractionalEdge
  );
  return cells;
}

/**
 * Build a single socket cell solid at the origin using multi-section loft.
 *
 * The socket is a frustum-like solid whose cross-section shrinks with depth,
 * following the standard Gridfinity tapered profile. Built as a ruled loft
 * through 5 sections corresponding to the profile breakpoints:
 *   Z=0:     outer boundary (top face, mates with bin body)
 *   Z=-0.25: same as top (vertical clearance step)
 *   Z=-2.4:  inset by 2.15mm (end of big taper)
 *   Z=-4.2:  same inset (vertical wall section)
 *   Z=-5.0:  inset by 2.95mm (end of small taper, bottom face)
 *
 * This approach avoids EdgeFinder limitations with non-square cells.
 *
 * @param cellW_mm Physical width of this cell in mm (after clearance)
 * @param cellD_mm Physical depth of this cell in mm (after clearance)
 */
/**
 * A prism of a cell socket's TOP face, rising `heightMm` from z=0.
 *
 * The socket's top 0.25mm is already vertical, so this continues that face
 * without a step. Lives here because the corner-radius clamp is the socket
 * profile's, and a second copy of it is a ledge inside every cup.
 */
export function buildSocketTopPrism(cellW_mm: number, cellD_mm: number, heightMm: number): Shape3D {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);
  return (
    drawRoundedRectangle(cellW_mm, cellD_mm, Math.max(cornerR, 0.1)).sketchOnPlane(
      'XY',
      0
    ) as Sketch
  ).extrude(heightMm);
}

/**
 * Tool that relieves a cell socket's top outer rim.
 *
 * Intersect a foot with this and its mating face is set back by `insetMm`, on
 * the cell boundary only — the tool spans the whole cell, so the faces where a
 * foot was clipped out of one are not touched.
 *
 * The relief lands on the profile's own widest breakpoint, `-CLEARANCE / 2`, so
 * the widest section and every face a baseplate meets survive it untouched.
 *
 * The tool continues above Z=0 rather than stopping on the foot's top plane, so
 * the intersection never has two coincident faces to resolve.
 */
export function buildSocketRimReliefTool(
  cellW_mm: number,
  cellD_mm: number,
  insetMm: number
): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const sectionAt = (z: number, inset: number): Sketch =>
    drawRoundedRectangle(
      cellW_mm - 2 * inset,
      cellD_mm - 2 * inset,
      Math.max(cornerR - inset, 0.1)
    ).sketchOnPlane('XY', z) as Sketch;

  const below = sectionAt(-SOCKET_HEIGHT - COPLANAR_MARGIN, 0);
  try {
    return below.loftWith(
      [sectionAt(-(CLEARANCE / 2), 0), sectionAt(0, insetMm), sectionAt(COPLANAR_MARGIN, insetMm)],
      { ruled: true }
    );
  } finally {
    below.delete();
  }
}

export function buildSingleCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  // Clamp corner radius to fit within cell dimensions
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  // Profile insets from outer boundary at each Z breakpoint
  // (derived from socketProfile after translate(CLEARANCE/2, 0))
  const INSET_TOP = 0;
  const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

  // Z positions of profile breakpoints
  const Z1 = 0;
  const Z2 = -(CLEARANCE / 2); // -0.25
  const Z3 = -SOCKET_BIG_TAPER; // -2.4
  const Z4 = -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART); // -4.2
  const Z5 = -SOCKET_HEIGHT; // -5.0

  // Helper to create a rounded rect sketch at a given Z with a given inset
  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Build 5 cross-sections matching the socket profile breakpoints
  const s1 = sectionAt(Z1, INSET_TOP);
  const s2 = sectionAt(Z2, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_MID);
  const s4 = sectionAt(Z4, INSET_MID);
  const s5 = sectionAt(Z5, INSET_BOT);

  // Ruled loft through all sections -- straight-line connections between
  // corresponding points, matching the angular profile exactly
  return s1.loftWith([s2, s3, s4, s5], { ruled: true });
}

/**
 * Build a simplified 3-section socket cell for preview rendering.
 *
 * Uses only 3 sections (top, mid, bottom) instead of the full 5-section
 * profile. Visually similar but generates fewer triangles for faster
 * preview updates. Export mode uses buildSingleCellSocket for full fidelity.
 */
export function buildSimplifiedCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  const INSET_TOP = 0;
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2;

  const Z1 = 0;
  const Z3 = -SOCKET_HEIGHT;

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  const s1 = sectionAt(Z1, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_BOT);

  return s1.loftWith([s3], { ruled: true });
}

/**
 * Get a single cell-socket solid for the given cell size, cloning a cached loft
 * template instead of re-lofting. On a uniform grid every full cell is the same
 * loft, so this turns a cold socket build from N lofts into 1 loft + (N−1)
 * clones (mirrors the baseplate `getPocketTemplate`). The key is intrinsic
 * (cell size + profile detail), so it's placement-invariant and shared across
 * grids. The returned clone is owned by the caller — register + translate it;
 * the cache keeps the original.
 */
function getCellSocketTemplate(cellW_mm: number, cellD_mm: number, forExport: boolean): Shape3D {
  const key = buildCacheKey('cell-socket-v1', quantize(cellW_mm), quantize(cellD_mm), forExport);
  const cached = getCellSocketTemplateCache(key);
  if (cached) return cached;
  const template = forExport
    ? buildSingleCellSocket(cellW_mm, cellD_mm)
    : buildSimplifiedCellSocket(cellW_mm, cellD_mm);
  return setCellSocketTemplateCache(key, template);
}

/** Fuse all cell sockets, then cut all hole tools. Disposes replaced intermediates. */
function batchFuseAndCut(cellSockets: Shape3D[], holeTools: Shape3D[]): Shape3D {
  let result = unwrap(fuseAll(cellSockets as ValidSolid[], { optimisation: 'commonFace' }));
  if (holeTools.length > 0) {
    const preCut = result;
    result = unwrap(cutAll(result, holeTools as ValidSolid[]));
    if (preCut !== result) preCut.delete();
  }
  return result;
}

/**
 * Build the segmented base socket grid for the bin.
 *
 * Decomposes the bin footprint into per-cell sockets (full 42mm or half 21mm cells),
 * each with the standard Gridfinity tapered profile. This ensures proper baseplate
 * interface for any half-bin dimension.
 *
 * Magnet/screw holes are placed at the standard 4-corner positions (±13mm from
 * cell center) using the original cell decomposition, NOT the half-socket sub-cells.
 * This ensures magnets align with the baseplate regardless of socket subdivision.
 * A half foot keeps the part of that pattern it can hold — two holes on its long
 * axis, or one centered — which is what a matching half pocket in this tool's
 * baseplate places too. Against a third-party full-cell plate the centered hole
 * lands ~2.5mm off that plate's lattice magnet: partial engagement, where the
 * foot used to offer none.
 *
 * @param forExport If true, uses full 5-section socket profile. Preview uses 3-section.
 */
/**
 * Cache key for the base socket shape produced by {@link buildBaseSocket}.
 *
 * Exposed so the tessellate stage can key a *mesh* cache off the exact same
 * geometry identity the shape cache uses — without re-deriving (and risking
 * drift from) the masking logic below.
 */
export function baseSocketShapeKey(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport: boolean,
  plan: SocketCellPlan,
  gridUnitMm: GridUnitInput,
  cellMask?: CellMask,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR
): string {
  const usingMask = isPartialMask(cellMask);
  return socketCacheKey(
    gridW,
    gridD,
    withMagnet,
    withScrew,
    magnetRadius,
    magnetDepth,
    screwRadius,
    forExport,
    plan.halfSockets,
    socketCellPlanKey(plan),
    gridUnitMm,
    usingMask ? hashMask(cellMask) : undefined,
    fractionalEdge.x,
    fractionalEdge.y,
    anchor
  );
}

export function buildBaseSocket(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport = false,
  plan: SocketCellPlan = DEFAULT_SOCKET_CELL_PLAN,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR
): Shape3D {
  // Treat a fully-filled mask as a rectangle so the cache key and iteration
  // path match the existing rectangular code.
  const usingMask = isPartialMask(cellMask);
  // Per-axis pitch: unitX scales width/columns, unitY scales depth/rows.
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);

  // Check socket cache -- skip entire build if params haven't changed
  const key = baseSocketShapeKey(
    gridW,
    gridD,
    withMagnet,
    withScrew,
    magnetRadius,
    magnetDepth,
    screwRadius,
    forExport,
    plan,
    gridUnitMm,
    cellMask,
    fractionalEdge,
    anchor
  );
  const cached = getSocketCache(key);
  if (cached) {
    return cached;
  }

  /**
   * True when the cell with center `(centerX, centerY)` in bin-centered mm
   * coordinates and size `wUnits × dUnits` lies entirely inside the filled
   * region of the mask. Returns true when no mask is in use.
   */
  const cellInMask = (
    centerX: number,
    centerY: number,
    wUnits: number,
    dUnits: number
  ): boolean => {
    if (!usingMask) return true;
    const totalW_mm = gridW * unitX;
    const totalD_mm = gridD * unitY;
    const leftUnit = (centerX + totalW_mm / 2 - (wUnits * unitX) / 2) / unitX;
    const bottomUnit = (centerY + totalD_mm / 2 - (dUnits * unitY) / 2) / unitY;
    return isRegionFilled(cellMask, leftUnit, bottomUnit, wUnits, dUnits);
  };

  return withScope((scope: DisposalScope) => {
    // Build and position each cell socket
    const cellSockets: Shape3D[] = [];

    for (const cell of filledSocketCells(
      gridW,
      gridD,
      cellMask,
      gridUnitMm,
      plan,
      fractionalEdge
    )) {
      const cellW_mm = cell.widthUnits * unitX - CLEARANCE;
      const cellD_mm = cell.depthUnits * unitY - CLEARANCE;
      // Clone a cached cell-socket template (simplified for preview, full for
      // export) instead of re-lofting every cell. The clone is registered so
      // scope disposes it; `translate` returns the positioned socket.
      // NOTE: cellSockets (the translated results) are NOT scope-registered
      // because fuseAll may return one of its inputs when given a single
      // element. They're deleted manually.
      const cellSocket = translate(
        scope.register(getCellSocketTemplate(cellW_mm, cellD_mm, forExport)),
        [cell.centerX, cell.centerY, 0]
      );
      cellSockets.push(cellSocket);
    }

    if (cellSockets.length === 0) {
      throw new Error('Invalid grid dimensions: at least one cell required');
    }

    // Build hole tools upfront so they can be included in the pipeline
    const holeTools: Shape3D[] = [];
    if (withScrew || withMagnet) {
      const magnetCutout = withMagnet ? scope.register(cylinder(magnetRadius, magnetDepth)) : null;
      const screwCutout = withScrew ? scope.register(cylinder(screwRadius, SOCKET_HEIGHT)) : null;

      // When both exist, fuse creates a new shape (register it); when only one exists,
      // it's already registered above — don't double-register
      const cutout: Shape3D =
        magnetCutout && screwCutout
          ? scope.register(unwrap(fuse(magnetCutout, screwCutout)))
          : ((magnetCutout || screwCutout) as Shape3D);

      // Cutter bounding radius (magnet is wider than the screw; both concentric).
      const holeRadius = Math.max(withMagnet ? magnetRadius : 0, withScrew ? screwRadius : 0);

      forEachCell(
        gridW,
        gridD,
        (cell) => {
          if (!cellHostsAttachmentHoles(cell, holeRadius, unitX, unitY)) return;
          if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
          // Standard ±13mm 4-corner pattern on a normal foot; a non-square/small
          // foot (e.g. a 25mm-wide cell) gets the corners that fit, else a single
          // centered hole — so magnet/screw holes never breach the foot's side.
          for (const [x, y] of magnetPositionsForCell(cell, holeRadius, unitX, unitY, anchor)) {
            holeTools.push(
              translate(scope.register(unwrap(clone(cutout))), [x, y, -SOCKET_HEIGHT])
            );
          }
        },
        { gridUnitMm, fractionalEdgeX: fractionalEdge.x, fractionalEdgeY: fractionalEdge.y }
      );
    }

    // Use booleanPipeline for small sockets (fuse cells → cut holes in one
    // WASM call, skipping intermediate UnifySameDomain). For large grids, fall
    // back to batch fuseAll/cutAll — compound booleans are faster than N
    // sequential pipeline steps when there are many targets.
    const totalSteps = cellSockets.length - 1 + holeTools.length;
    let result: Shape3D;

    if (totalSteps <= 20) {
      const steps: BooleanPipelineStep[] = [
        ...cellSockets.slice(1).map((s): BooleanPipelineStep => ({ op: 'fuse', tool: s })),
        ...holeTools.map((t): BooleanPipelineStep => ({ op: 'cut', tool: t })),
      ];
      const pipelineResult = booleanPipeline(cellSockets[0], steps, {
        optimisation: 'commonFace',
      });

      if (isOk(pipelineResult)) {
        result = pipelineResult.value;
      } else {
        result = batchFuseAndCut(cellSockets, holeTools);
      }
    } else {
      result = batchFuseAndCut(cellSockets, holeTools);
    }

    // Dispose consumed inputs (skip if result reuses a reference)
    for (const s of cellSockets) {
      if (s !== result) s.delete();
    }
    for (const t of holeTools) {
      if (t !== result) t.delete();
    }

    return setSocketCache(key, result); // result NOT registered — survives scope
  });
}

/**
 * Build the grid-aligned feet that sit under a bin's overhang region.
 *
 * The nominal feet (origin-centered) come from {@link buildBaseSocket}; this
 * adds the "frame" of clipped feet around them (see {@link frameCells}) — strips
 * narrower than the printable threshold are dropped, leaving a flat bottom
 * there. Returns `null` when there's no overhang or every strip is
 * sub-threshold. Caller fuses the result onto the base socket.
 *
 * Framed from the overhang at the *base* ({@link overhangBaseSides}), not the
 * rim: on a tapered wall the two differ by the flare, and feet laid out to the
 * rim would jut past the wall above them into open air.
 */
export function buildOverhangFeet(
  gridW: number,
  gridD: number,
  overhang: ResolvedOverhang,
  gridUnitMm: GridUnitInput,
  forExport: boolean
): Shape3D | null {
  if (!hasOverhang(overhang)) return null;
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const frame = frameCells(
    gridW,
    gridD,
    overhangBaseSides(overhang),
    gridUnitMm,
    MIN_PRINTABLE_TILE_MM
  );
  if (frame.length === 0) return null;

  return withScope((scope: DisposalScope) => {
    const sockets: Shape3D[] = frame.map((cell) => {
      const cellW_mm = cell.widthUnits * unitX - CLEARANCE;
      const cellD_mm = cell.depthUnits * unitY - CLEARANCE;
      return translate(scope.register(getCellSocketTemplate(cellW_mm, cellD_mm, forExport)), [
        cell.centerX,
        cell.centerY,
        0,
      ]);
    });
    const result = unwrap(fuseAll(sockets as ValidSolid[], { optimisation: 'commonFace' }));
    for (const s of sockets) {
      if (s !== result) s.delete();
    }
    return result; // NOT registered — survives scope
  });
}
