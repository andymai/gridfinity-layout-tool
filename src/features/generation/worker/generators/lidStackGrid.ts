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
import { pocketCornerRadius } from './generatorConstants';
import { SOCKET_HEIGHT, SOCKET_BIG_TAPER, SOCKET_TAPER_WIDTH, CLEARANCE } from './generatorTypes';
import { LID_COPLANAR_MARGIN, LID_MIN_CORNER_RADIUS } from './lidConstants';
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

/** Floor for every inset-derived pocket dimension. The deepest inset is
 *  STACK_INSET_BOT (2.95mm per side), which a small enough cell or grid unit
 *  would otherwise drive to zero or negative. */
const MIN_POCKET_MM = 0.1;

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
 *  callers floor their corner radius rather than let it reach zero. */
function loftPocket(outlineAt: (inset: number) => Drawing): Shape3D {
  const [first, ...rest] = POCKET_PROFILE.map(
    ([z, inset]) => outlineAt(inset).sketchOnPlane('XY', z) as Sketch
  );
  return first.loftWith(rest, { ruled: true });
}

/**
 * Build a single pocket cutter for one cell. Multi-section loft with
 * the same five sections + two coplanar caps that
 * `baseplateGenerator.buildPocketCutter` uses, just translated UP by
 * `SOCKET_HEIGHT` so the slab sits at Z ∈ [0, SOCKET_HEIGHT] rather
 * than the baseplate's Z ∈ [-SOCKET_HEIGHT, 0].
 */
function buildLidStackPocketCutter(cellW_mm: number, cellD_mm: number): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  return loftPocket((inset) =>
    drawRoundedRectangle(
      Math.max(cellW_mm - 2 * inset, MIN_POCKET_MM),
      Math.max(cellD_mm - 2 * inset, MIN_POCKET_MM),
      Math.max(cornerR - inset, MIN_POCKET_MM)
    )
  );
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
    const radius = Math.max(cornerR - inset, LID_MIN_CORNER_RADIUS);
    return cellMask
      ? buildMaskDrawingAtInset(cellMask, { x: gridUnitMm, y: gridUnitMmY }, inset, radius)
      : drawRoundedRectangle(
          Math.max(totalW - 2 * inset, MIN_POCKET_MM),
          Math.max(totalD - 2 * inset, MIN_POCKET_MM),
          radius
        );
  });
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
    forEachCell(
      cellsX,
      cellsY,
      (cell) => {
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
  }

  if (pockets.length > 0) {
    scope.register(slab);
    slab = unwrap(cutAll(slab as ValidSolid, pockets as ValidSolid[]));
  }
  return slab;
}
