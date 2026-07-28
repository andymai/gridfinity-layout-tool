/**
 * Stack-grid pocket cutter for the lid's optional Gridfinity-spec top
 * surface.
 *
 * Builds a `socketHeightMm`-tall slab over the lid outline, then cuts the
 * baseplate-style tapered pocket per cell. Pocket dimensions match
 * `baseplateGenerator.buildPocketCutter` exactly so an upper bin's base
 * socket engages the lid the same way it engages a baseplate. The
 * remaining slab material between pockets forms the ring + dividers.
 *
 * `stackLipOnly` (#2930) swaps the per-cell pockets for one footprint-wide
 * pocket, so only the perimeter ring survives — the same lip an upper bin
 * registers on, without the interior dividers.
 *
 * `isCellFilled` is also exported because the magnet-hole pass (a separate
 * sibling) needs the same cell-fill predicate for polygon bins.
 */

import { drawRoundedRectangle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing, Sketch, ValidSolid } from 'brepjs';
import { pocketCornerRadius } from './generatorConstants';
import {
  socketProfileSections,
  socketBottomInset,
  PROFILE_INSET_TOP,
  PROFILE_INSET_BOT,
} from './socketProfile';
import { LID_COPLANAR_MARGIN, LID_MIN_CORNER_RADIUS } from './lidConstants';
import { type CellMask } from '@/shared/utils/cellMask';
import { forEachCell } from './cellDecomposition';
import { buildMaskDrawingAtInset } from './maskPolygon';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

/** Inset at the pocket floor, per side — on a lip-only top this is how far the
 *  lip's inner face sits inside the nominal socket grid. `lidTextBuilder` sizes
 *  the text fit box from it. Equals the standard (H=5) bottom inset; low
 *  profiles taper differently but the lip text stays on the nominal grid. */
export const STACK_INSET_BOT = PROFILE_INSET_BOT; // 2.95mm

/** Floor for every inset-derived pocket dimension. The deepest inset is
 *  STACK_INSET_BOT (2.95mm per side), which a small enough cell or grid unit
 *  would otherwise drive to zero or negative. */
const MIN_POCKET_MM = 0.1;

/**
 * Loft a pocket from a per-inset outline, walking the shared
 * {@link socketProfileSections} (the same profile the baseplate pocket and bin
 * socket use) translated UP by `socketHeightMm` so the slab sits at
 * Z ∈ [0, socketHeightMm] rather than the baseplate's Z ∈ [-socketHeightMm, 0].
 * Sharing the profile guarantees an upper bin's socket engages the lid at any
 * base-profile depth.
 *
 * `outlineAt` must return sections that share a vertex topology at every inset —
 * a ruled loft can't bridge differing curve counts, which is why both callers
 * floor their corner radius rather than let it reach zero.
 */
function loftPocket(socketHeightMm: number, outlineAt: (inset: number) => Drawing): Shape3D {
  const TOP = socketHeightMm;
  const sketchAt = (z: number, inset: number): Sketch =>
    outlineAt(inset).sketchOnPlane('XY', z) as Sketch;

  const s0 = sketchAt(TOP + LID_COPLANAR_MARGIN, PROFILE_INSET_TOP);
  const sections: Sketch[] = [
    ...socketProfileSections(socketHeightMm).map((sec) => sketchAt(sec.z + TOP, sec.inset)),
    // Extend below the lid floor from the truncated profile's real bottom inset
    // (not a hardcoded PROFILE_INSET_BOT) so a low profile doesn't leave a ledge.
    sketchAt(-LID_COPLANAR_MARGIN, socketBottomInset(socketHeightMm)),
  ];
  return s0.loftWith(sections, { ruled: true });
}

/**
 * Build a single pocket cutter for one cell. Uses the shared socket profile
 * translated up by the base-profile depth so an upper bin's socket engages the
 * lid the same way it engages a baseplate.
 */
function buildLidStackPocketCutter(
  cellW_mm: number,
  cellD_mm: number,
  socketHeightMm: number
): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  return loftPocket(socketHeightMm, (inset) =>
    drawRoundedRectangle(
      Math.max(cellW_mm - 2 * inset, MIN_POCKET_MM),
      Math.max(cellD_mm - 2 * inset, MIN_POCKET_MM),
      Math.max(cornerR - inset, MIN_POCKET_MM)
    )
  );
}

/**
 * ONE pocket spanning the whole footprint (#2930) — only the perimeter lip
 * survives.
 *
 * Sized from the NOMINAL socket grid, not `buildOutlineDrawing`'s lid
 * perimeter: that perimeter is shrunk by `fitClearance` and both grown and
 * shifted by asymmetric overhang, none of which the sockets of a bin stacked
 * on top move with. The per-cell path stays on the nominal grid for the same
 * reason.
 */
function buildStackLipCutter(inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, gridUnitMmY, cellMask, socketHeightMm } = inputs;
  const totalW = cellsX * gridUnitMm;
  const totalD = cellsY * gridUnitMmY;
  const cornerR = pocketCornerRadius(totalW, totalD);

  return loftPocket(socketHeightMm, (inset) => {
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

/**
 * Each whole grid cell maps to a 2×2 mask region. Treat the whole cell as
 * filled only when ALL four mask cells are set; otherwise skip pockets/
 * magnets to avoid a hole that would clip the polygon boundary.
 */
export function isCellFilled(mask: CellMask, cellX: number, cellY: number): boolean {
  const baseCol = cellX * 2;
  const baseRow = cellY * 2;
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const c = baseCol + dc;
      const r = baseRow + dr;
      if (c < 0 || c >= mask.cols || r < 0 || r >= mask.rows) return false;
      if (mask.cells[r * mask.cols + c] !== 1) return false;
    }
  }
  return true;
}

export function buildStackGrid(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, gridUnitMmY, socketHeightMm } = inputs;
  // Non-square grids scale columns by X and rows by Y; the pocket cells must
  // mate with the (equally non-square) sockets of a bin stacked on top.
  const pitch = { x: gridUnitMm, y: gridUnitMmY };

  // 1. Slab — lid's outer footprint extruded UP by the base-profile depth
  //    (matching the baseplate's slab depth). `buildOutlineDrawing(inputs, 0)`
  //    gives the full perimeter — rounded for plain bins, polygon for
  //    cellMask bins.
  const slabSketch = buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', 0) as Sketch;
  let slab: Shape3D = scope.register(slabSketch.extrude(socketHeightMm));

  // 2. Pocket cutters. Lip-only (#2930) cuts a single footprint-wide pocket,
  //    leaving just the perimeter lip. Otherwise one per filled cell:
  //    `forEachCell` decomposes half-bin grids into 1u + 0.5u sub-cells and we
  //    cut a pocket sized to whichever sub-cell appears at each position.
  //    Polygon (cellMask) bins skip pockets in unfilled cells so the lip
  //    pattern only covers material that actually exists.
  const pockets: Shape3D[] = [];
  if (inputs.stackLipOnly) {
    pockets.push(scope.register(buildStackLipCutter(inputs)));
  } else {
    const halfTotalW = (cellsX * gridUnitMm) / 2;
    const halfTotalD = (cellsY * gridUnitMmY) / 2;
    forEachCell(
      cellsX,
      cellsY,
      (cell) => {
        const cellW = cell.widthUnits * gridUnitMm;
        const cellD = cell.depthUnits * gridUnitMmY;
        if (inputs.cellMask) {
          const cellX = Math.round((cell.centerX + halfTotalW - gridUnitMm / 2) / gridUnitMm);
          const cellY = Math.round((cell.centerY + halfTotalD - gridUnitMmY / 2) / gridUnitMmY);
          if (!isCellFilled(inputs.cellMask, cellX, cellY)) return;
        }
        const pocket = buildLidStackPocketCutter(cellW, cellD, socketHeightMm);
        const positioned = scope.register(translate(pocket, [cell.centerX, cell.centerY, 0]));
        pocket.delete();
        pockets.push(positioned);
      },
      { gridUnitMm: pitch }
    );
  }

  if (pockets.length > 0) {
    scope.register(slab);
    slab = unwrap(cutAll(slab as ValidSolid, pockets as ValidSolid[]));
  }
  return slab;
}
