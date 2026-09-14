/**
 * Stack-grid pocket cutter for the lid's optional Gridfinity-spec top
 * surface.
 *
 * Builds a `SOCKET_HEIGHT`-tall slab over the lid outline, then cuts the
 * baseplate-style tapered pocket per cell. Pocket dimensions match
 * `baseplateGenerator.buildPocketCutter` exactly so an upper bin's base
 * socket engages the lid the same way it engages a baseplate. The
 * remaining slab material between pockets forms the ring + dividers.
 *
 * `stackLipOnly` swaps the per-cell pockets for one footprint-wide
 * pocket, so only the perimeter ring survives — the same lip an upper bin
 * registers on, without the interior dividers.
 */

import { drawRoundedRectangle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing, Sketch, ValidSolid } from 'brepjs';
import {
  COPLANAR_OVERLAP,
  CORNER_RADIUS,
  pocketCornerRadius,
  safeSectionRect,
} from './generatorConstants';
import { SOCKET_HEIGHT, SOCKET_BIG_TAPER, SOCKET_TAPER_WIDTH, CLEARANCE } from './generatorTypes';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { isRegionFilled } from '@/shared/utils/cellMask';
import { forEachCell, type CellInfo } from './cellDecomposition';
import { buildMaskDrawingAtInset } from './maskPolygon';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

/** Insets at each Z breakpoint — same values as `baseplateGenerator`. */
const STACK_INSET_TOP = 0;
const STACK_INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
/** Inset at the pocket floor, per side — on a lip-only top this is how far the
 *  lip's inner face sits inside the nominal socket grid. `lidTextBuilder` sizes
 *  the text fit box from it. */
export const STACK_INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/**
 * Z breakpoints of the pocket profile, paired with their per-side inset — the
 * baseplate socket profile, walked top-down, with a coplanar cap at each end so
 * the cut bites cleanly through both slab faces.
 */
const POCKET_PROFILE: readonly (readonly [z: number, inset: number])[] = [
  [SOCKET_HEIGHT + LID_COPLANAR_MARGIN, STACK_INSET_TOP],
  [SOCKET_HEIGHT, STACK_INSET_TOP],
  [SOCKET_HEIGHT - CLEARANCE / 2, STACK_INSET_TOP],
  [SOCKET_HEIGHT - SOCKET_BIG_TAPER, STACK_INSET_MID],
  [SOCKET_HEIGHT - SOCKET_BIG_TAPER - (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH), STACK_INSET_MID],
  [0, STACK_INSET_BOT],
  [-LID_COPLANAR_MARGIN, STACK_INSET_BOT],
];

/** `outlineAt` must return sections that share a vertex topology at every
 *  inset — a ruled loft can't bridge differing curve counts, which is why both
 *  callers size their sections through `safeSectionRect`. */
function loftPocket(outlineAt: (inset: number) => Drawing): Shape3D {
  const [first, ...rest] = POCKET_PROFILE.map(
    ([z, inset]) => outlineAt(inset).sketchOnPlane('XY', z) as Sketch
  );
  return first.loftWith(rest, { ruled: true });
}

/**
 * Growth (mm, per side) on a per-cell pocket cutter's footprint.
 *
 * An edge cell's rounded corner (from the NOMINAL socket grid) and the
 * slab's own outer corner (from the `fitClearance`-shrunk perimeter) land
 * EXACTLY tangent, because the grid shrink and the two corner radii differ
 * by the identical `fitClearance`. Two arcs meeting at exact tangency, not a
 * real overlap, is the same trap `COPLANAR_OVERLAP` exists for on flat faces
 * (generatorConstants.ts): it produces sliver triangles no topology or
 * watertight check catches. Growing every pocket by this — cheap, since it
 * is a cutter — breaks the tangency everywhere at once.
 *
 * Bigger than `COPLANAR_OVERLAP` itself because the loft is RULED between
 * breakpoints: the near-tangent corner recurs, slightly smaller, down the
 * whole ruled segment into the big taper, not just at one Z plane.
 *
 * Clears the case where one cell edge's straight run meets the slab's
 * corner arc; does NOT clear a corner cell's own 90° corner, where the
 * pocket's arc and the slab's corner arc are tangent to each other on BOTH
 * axes at once — that needs a different fix than growing the rectangle.
 *
 * `buildStackLipCutter` below has the identical tangency by the same math
 * but stays unmodified: its exact peak position is pinned by
 * `lidGenerator.scenario`'s stacking-lip-only assertions, and growing it the
 * same way shifts that pinned edge and breaks them.
 */
const POCKET_EDGE_GROWTH_MM = 5 * COPLANAR_OVERLAP;

/**
 * Build a single pocket cutter for one cell. Multi-section loft with
 * the same five sections + two coplanar caps that
 * `baseplateGenerator.buildPocketCutter` uses, just translated UP by
 * `SOCKET_HEIGHT` so the slab sits at Z ∈ [0, SOCKET_HEIGHT] rather
 * than the baseplate's Z ∈ [-SOCKET_HEIGHT, 0].
 */
function buildLidStackPocketCutter(cellW_mm: number, cellD_mm: number): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  return loftPocket((inset) => {
    const { width, depth, radius } = safeSectionRect(
      cellW_mm + 2 * POCKET_EDGE_GROWTH_MM - 2 * inset,
      cellD_mm + 2 * POCKET_EDGE_GROWTH_MM - 2 * inset,
      cornerR - inset
    );
    return drawRoundedRectangle(width, depth, radius);
  });
}

/**
 * ONE pocket spanning the whole footprint — only the perimeter lip
 * survives.
 *
 * Sized from the NOMINAL socket grid, not `buildOutlineDrawing`'s lid
 * perimeter: that perimeter is shrunk by `fitClearance` and both grown and
 * shifted by asymmetric overhang, none of which the sockets of a bin stacked
 * on top move with. The per-cell path stays on the nominal grid for the same
 * reason.
 */
function buildStackLipCutter(inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, gridUnitMmY, cellMask } = inputs;
  const totalW = cellsX * gridUnitMm;
  const totalD = cellsY * gridUnitMmY;
  const cornerR = pocketCornerRadius(totalW, totalD);

  return loftPocket((inset) => {
    const { width, depth, radius } = safeSectionRect(
      totalW - 2 * inset,
      totalD - 2 * inset,
      cornerR - inset
    );
    return cellMask
      ? buildMaskDrawingAtInset(cellMask, { x: gridUnitMm, y: gridUnitMmY }, inset, radius)
      : drawRoundedRectangle(width, depth, radius);
  });
}

/**
 * Junction relief: shave the proud nub off each grid junction.
 *
 * A pocket's top opening is the full cell width, so the pockets shave every
 * divider run down to the socket rim (`SOCKET_HEIGHT - CLEARANCE/2`). But the
 * four pocket corners around a crossing are rounded, so they leave a square of
 * slab standing there at the full `SOCKET_HEIGHT` — a nub proud of the dividers.
 *
 * The cutter starts at the rim, where everything below is already gone, so it
 * bites only that proud material. That is why its footprint can be generous
 * (re-cutting empty pocket space or a divider run) without reaching the seating
 * taper below the rim — no bin foot ever lands on an interior crossing — or
 * narrowing a pocket.
 */
const JUNCTION_RELIEF_FLOOR_Z = SOCKET_HEIGHT - CLEARANCE / 2;
// Half-footprint of the relief. The nub fans ~one pocket-corner-radius down each
// divider arm from the crossing (the arms stay proud until the perpendicular
// pockets' rounded corners have curved clear), so the cutter has to reach that
// far to take the whole star, not just the centre.
const JUNCTION_RELIEF_HALF_MM = CORNER_RADIUS;
const JUNCTION_RELIEF_CORNER_MM = 0.5;

/** One relief cutter at the origin; callers translate a copy to each junction. */
function buildJunctionReliefCutter(): Shape3D {
  const side = 2 * JUNCTION_RELIEF_HALF_MM;
  const top = SOCKET_HEIGHT + LID_COPLANAR_MARGIN;
  // The shaved divider crests sit exactly at JUNCTION_RELIEF_FLOOR_Z, so a
  // cutter floor on that plane is a face coplanar with them — the sliver /
  // non-manifold interface COPLANAR_OVERLAP exists for. Drop the floor by that
  // margin so the cut passes cleanly through the crest; the divider is notched
  // only by COPLANAR_OVERLAP, well above the seating taper.
  const floor = JUNCTION_RELIEF_FLOOR_Z - COPLANAR_OVERLAP;
  const sketch = drawRoundedRectangle(side, side, JUNCTION_RELIEF_CORNER_MM).sketchOnPlane(
    'XY',
    floor
  ) as Sketch;
  return sketch.extrude(top - floor);
}

/**
 * Interior crossing positions that carry a proud junction nub: every crossing
 * of an INTERIOR cell-boundary line with another. The outer boundary lines are
 * excluded, so the four ring corners are left alone (see {@link collectTJunctions}
 * for the divider-meets-edge T-junctions, relieved separately with an inward
 * bias). A crossing surrounded by pockets on all sides is where a centred,
 * over-generous relief only re-cuts empty pocket space, never a real edge.
 * Derived from the same cell decomposition the pockets use, so it tracks half
 * and fractional cells without a second source of truth.
 */
export function collectJunctions(
  cornerXs: readonly number[],
  cornerYs: readonly number[]
): Array<readonly [number, number]> {
  const interior = (vals: readonly number[]): number[] => {
    const uniq = [...new Set(vals.map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
    return uniq.slice(1, -1); // drop the two outer boundary lines
  };
  const xs = interior(cornerXs);
  const ys = interior(cornerYs);
  const out: Array<readonly [number, number]> = [];
  for (const x of xs) {
    for (const y of ys) {
      out.push([x, y] as const);
    }
  }
  return out;
}

/** A T-junction and the unit direction that points from its boundary line back
 *  INTO the grid (one component is 0). The relief cutter is shifted this way so
 *  its outer face lands on the boundary line and it only ever bites inward. */
export type TJunction = readonly [x: number, y: number, inX: number, inY: number];

/**
 * T-junction positions: where an INTERIOR divider line runs into an outer
 * boundary line. Same proud nub as an interior crossing (the flanking pockets'
 * rounded corners leave a square of full-height slab where the divider meets
 * the ring), but only three arms instead of four.
 *
 * Excludes the four ring corners (both coordinates on an outer line): those
 * carry the perimeter stacking lip an upper bin registers on, at full
 * `SOCKET_HEIGHT`, and must stay. Whether that lip exists depends on overhang
 * (a bin with no overhang has its outer sockets flush with the edge, so there
 * is no frame; an overhung one grows a frame past the nominal grid), so the
 * relief must never assume either. Each junction carries the inward direction
 * so its cutter can be pushed off the boundary line: it then bites only the nub
 * standing above the shaved divider rim and never the frame outside the line or
 * the seating taper below the rim.
 */
export function collectTJunctions(
  cornerXs: readonly number[],
  cornerYs: readonly number[]
): TJunction[] {
  const uniq = (vals: readonly number[]): number[] =>
    [...new Set(vals.map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const xs = uniq(cornerXs);
  const ys = uniq(cornerYs);
  if (xs.length < 3 && ys.length < 3) return []; // no interior line on either axis
  const interiorXs = xs.length >= 3 ? xs.slice(1, -1) : [];
  const interiorYs = ys.length >= 3 ? ys.slice(1, -1) : [];
  const out: TJunction[] = [];
  // Interior dividers meeting the front/back (outer-Y) edges. Inward = toward 0.
  if (ys.length >= 2) {
    for (const x of interiorXs) {
      out.push([x, ys[0], 0, 1] as const);
      out.push([x, ys[ys.length - 1], 0, -1] as const);
    }
  }
  // Interior dividers meeting the left/right (outer-X) edges.
  if (xs.length >= 2) {
    for (const y of interiorYs) {
      out.push([xs[0], y, 1, 0] as const);
      out.push([xs[xs.length - 1], y, -1, 0] as const);
    }
  }
  return out;
}

/** The slice of {@link LidInputs} that locates a cell against the mask. */
export type LidCellGrid = Pick<
  LidInputs,
  'cellMask' | 'cellsX' | 'cellsY' | 'gridUnitMm' | 'gridUnitMmY'
>;

/**
 * Whether the mask fills a cell's own footprint — false for a partially covered
 * cell, so nothing is cut across the polygon boundary.
 *
 * Measured over the cell's OWN extent rather than the 1u cell containing it.
 * A trailing 0.5u cell covers one column of mask sub-cells, and a whole-cell
 * query reaches past the mask's last column, which answers "unfilled" for every
 * fractional edge cell on a masked lid.
 *
 * Shared by the pocket pass here and the magnet pass in `lidMagnets`: both cut
 * into the same face, and a cell one accepts while the other refuses puts a
 * magnet where no foot can seat.
 */
export function isLidCellFilled(grid: LidCellGrid, cell: CellInfo): boolean {
  const { cellMask, cellsX, cellsY, gridUnitMm, gridUnitMmY } = grid;
  if (!cellMask) return true;
  const leftUnit =
    (cell.centerX + (cellsX * gridUnitMm) / 2 - (cell.widthUnits * gridUnitMm) / 2) / gridUnitMm;
  const bottomUnit =
    (cell.centerY + (cellsY * gridUnitMmY) / 2 - (cell.depthUnits * gridUnitMmY) / 2) / gridUnitMmY;
  return isRegionFilled(cellMask, leftUnit, bottomUnit, cell.widthUnits, cell.depthUnits);
}

export function buildStackGrid(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, gridUnitMmY } = inputs;
  // Non-square grids scale columns by X and rows by Y; the pocket cells must
  // mate with the (equally non-square) sockets of a bin stacked on top.
  const pitch = { x: gridUnitMm, y: gridUnitMmY };

  // 1. Slab — lid's outer footprint extruded UP by SOCKET_HEIGHT (5mm,
  //    matching the baseplate's slab depth). `buildOutlineDrawing(inputs, 0)`
  //    gives the full perimeter — rounded for plain bins, polygon for
  //    cellMask bins.
  const slabSketch = buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', 0) as Sketch;
  let slab: Shape3D = scope.register(slabSketch.extrude(SOCKET_HEIGHT));

  // 2. Pocket cutters. Lip-only cuts a single footprint-wide pocket,
  //    leaving just the perimeter lip. Otherwise one per filled cell:
  //    `forEachCell` decomposes half-bin grids into 1u + 0.5u sub-cells and we
  //    cut a pocket sized to whichever sub-cell appears at each position.
  //    Polygon (cellMask) bins skip pockets in unfilled cells so the lip
  //    pattern only covers material that actually exists.
  const pockets: Shape3D[] = [];
  if (inputs.stackLipOnly) {
    pockets.push(scope.register(buildStackLipCutter(inputs)));
  } else {
    const cornerXs: number[] = [];
    const cornerYs: number[] = [];
    forEachCell(
      cellsX,
      cellsY,
      (cell) => {
        const hx = (cell.widthUnits * gridUnitMm) / 2;
        const hy = (cell.depthUnits * gridUnitMmY) / 2;
        cornerXs.push(cell.centerX - hx, cell.centerX + hx);
        cornerYs.push(cell.centerY - hy, cell.centerY + hy);
        if (!isLidCellFilled(inputs, cell)) return;
        const pocket = buildLidStackPocketCutter(
          cell.widthUnits * gridUnitMm,
          cell.depthUnits * gridUnitMmY
        );
        const positioned = scope.register(translate(pocket, [cell.centerX, cell.centerY, 0]));
        pocket.delete();
        pockets.push(positioned);
      },
      // The half cell must land on the side the stacked bin's half foot does,
      // or the foot meets slab and the pocket meets air.
      {
        gridUnitMm: pitch,
        fractionalEdgeX: inputs.fractionalEdgeX,
        fractionalEdgeY: inputs.fractionalEdgeY,
      }
    );

    // Relief the proud junction nubs. Skipped for cellMask lids: their grid is
    // irregular and the ring follows the polygon outline, so a square relief
    // could bite a real edge rather than an interior crossing.
    if (!inputs.cellMask) {
      const crossings = collectJunctions(cornerXs, cornerYs);
      // A T-junction nub is only relieved when the lid outline reaches past the
      // nominal socket grid, i.e. an overhang grew a perimeter frame. That frame
      // holds the grid's SOCKET_HEIGHT top, so relieving the nub is pure cleanup.
      // Without it the outer sockets breach the edge and the nubs are the only
      // full-height material — relieving them would drop the whole grid below
      // SOCKET_HEIGHT and shorten the assembled height, so they are left in.
      const hasPerimeterFrame =
        inputs.lidOuterW > cellsX * gridUnitMm + COPLANAR_OVERLAP ||
        inputs.lidOuterD > cellsY * gridUnitMmY + COPLANAR_OVERLAP;
      const tJunctions = hasPerimeterFrame ? collectTJunctions(cornerXs, cornerYs) : [];
      if (crossings.length > 0 || tJunctions.length > 0) {
        const base = buildJunctionReliefCutter();
        // Interior crossings sit clear of every edge, so the cutter is centred.
        for (const [x, y] of crossings) {
          pockets.push(scope.register(translate(base, [x, y, 0])));
        }
        // A T-junction cutter is pushed inward so its outer face lands on the
        // boundary line: it takes the nub but never reaches the frame (if the
        // config grew one) outside that line.
        for (const [x, y, inX, inY] of tJunctions) {
          pockets.push(
            scope.register(
              translate(base, [
                x + inX * JUNCTION_RELIEF_HALF_MM,
                y + inY * JUNCTION_RELIEF_HALF_MM,
                0,
              ])
            )
          );
        }
        base.delete();
      }
    }
  }

  if (pockets.length > 0) {
    scope.register(slab);
    slab = unwrap(cutAll(slab as ValidSolid, pockets as ValidSolid[]));
  }
  return slab;
}
