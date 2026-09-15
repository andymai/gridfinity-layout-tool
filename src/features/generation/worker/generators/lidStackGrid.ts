/**
 * Stack-grid pocket cutter for the lid's optional Gridfinity top surface.
 *
 * A grid on a lid is not a Gridfinity feature, so there is no profile to quote.
 * What it has to do is receive a bin's foot exactly as a baseplate does, and the
 * only thing standing in the way is size: a lid is the BIN's footprint, i.e. the
 * baseplate cell already offset inward by `CLEARANCE / 2` on every side, corners
 * included. So this cuts the pocket at FULL size into a slab one half-clearance
 * shorter, and lets the slab's own top face do the trimming.
 *
 * Trimming rather than re-deriving the breakpoints is the point: a cut cannot
 * change a face angle, so every taper stays at 45 degrees and the foot mates
 * face-to-face with `CLEARANCE / 2` of air perpendicular to each one. It also
 * lands the rim at exactly the lid outline, leaves a `CLEARANCE`-wide flat land
 * between adjacent pockets, and tops every divider, crossing and T-junction out
 * at one height.
 *
 * `stackLipOnly` swaps the per-cell pockets for one footprint-wide
 * pocket, so only the perimeter ring survives — the same lip an upper bin
 * registers on, without the interior dividers.
 */

import { drawRoundedRectangle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing, Sketch, ValidSolid } from 'brepjs';
import { pocketCornerRadius, safeSectionRect } from './generatorConstants';
import { PLATE_PROFILE_HEIGHT, POCKET_INSET_BOT, POCKET_PROFILE } from './generatorTypes';
import { LID_STACK_GRID_HEIGHT_MM } from '@/shared/printSettings/gridfinityGeometry';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { isRegionFilled } from '@/shared/utils/cellMask';
import { forEachCell, type CellInfo } from './cellDecomposition';
import { buildMaskDrawingAtInset } from './maskPolygon';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

/**
 * Height of the grid above the lid's top face.
 *
 * A half-clearance under the baseplate profile, because a lid is the BIN's
 * footprint: `gridUnitMm - 2 * LID_FIT_CLEARANCE` with its corner radius
 * reduced by the same, which is the nominal cell offset inward by exactly that
 * — flats and corners alike. A pocket grid laid on the nominal lattice
 * overhangs it by that much, and trimming the overhang off a 45-degree face
 * lowers the face's high point by the same amount.
 */
const STACK_HEIGHT = LID_STACK_GRID_HEIGHT_MM;

/**
 * Inset at the pocket floor, per side — on a lip-only top this is how far the
 * lip's inner face sits inside the nominal socket grid. `lidTextBuilder` sizes
 * the text fit box from it, and `lidCutoutPlan` mirrors it.
 *
 * The floor is below the cut, so it is the baseplate's own floor inset
 * untouched: an upper bin's foot lands on it exactly as it would in a plate.
 */
export const STACK_INSET_BOT = POCKET_INSET_BOT;

/**
 * Z breakpoints of the pocket profile, paired with their per-side inset.
 *
 * The UNTRIMMED baseplate pocket, floor on the lid's top face (Z=0) and rim a
 * half-clearance ABOVE the slab. The slab's own top face does the trimming, so
 * the cutter overhangs it in both directions — a half-clearance past the lid's
 * outer edge and a half-clearance above its top.
 *
 * Pre-trimming the profile to the slab instead lands the rim exactly on the lid
 * outline, arcs and all. That is a tangency rather than a cut, and it sheds
 * sliver triangles no watertight or triangle-count check reports
 * (`lidGenerator.scenario` counts them). Overhanging keeps every cut transversal.
 */
export const POCKET_SECTIONS: readonly (readonly [z: number, inset: number])[] = [
  [PLATE_PROFILE_HEIGHT + LID_COPLANAR_MARGIN, 0],
  ...POCKET_PROFILE.map(([depth, inset]): readonly [number, number] => [
    PLATE_PROFILE_HEIGHT - depth,
    inset,
  ]),
  [-LID_COPLANAR_MARGIN, POCKET_INSET_BOT],
];

/** `outlineAt` must return sections that share a vertex topology at every
 *  inset — a ruled loft can't bridge differing curve counts, which is why both
 *  callers size their sections through `safeSectionRect`. */
function loftPocket(outlineAt: (inset: number) => Drawing): Shape3D {
  const [first, ...rest] = POCKET_SECTIONS.map(
    ([z, inset]) => outlineAt(inset).sketchOnPlane('XY', z) as Sketch
  );
  return first.loftWith(rest, { ruled: true });
}

/**
 * Build a single pocket cutter for one cell. Multi-section loft over
 * {@link POCKET_SECTIONS}, placed so the slab sits at Z ∈ [0, STACK_HEIGHT]
 * rather than the baseplate's Z ∈ [-BASEPLATE_HEIGHT, 0].
 */
function buildLidStackPocketCutter(cellW_mm: number, cellD_mm: number): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  return loftPocket((inset) => {
    const { width, depth, radius } = safeSectionRect(
      cellW_mm - 2 * inset,
      cellD_mm - 2 * inset,
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

  // 1. Slab — lid's outer footprint extruded UP by STACK_HEIGHT (the trimmed
  //    baseplate's slab depth). `buildOutlineDrawing(inputs, 0)` gives the full
  //    perimeter — rounded for plain bins, polygon for cellMask bins.
  const slabSketch = buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', 0) as Sketch;
  let slab: Shape3D = scope.register(slabSketch.extrude(STACK_HEIGHT));

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
