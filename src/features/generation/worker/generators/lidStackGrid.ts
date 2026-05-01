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
 * `isCellFilled` is also exported because the magnet-hole pass (a separate
 * sibling) needs the same cell-fill predicate for polygon bins.
 */

import { drawRoundedRectangle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, Sketch, ValidSolid } from 'brepjs';
import { pocketCornerRadius } from './generatorConstants';
import { SOCKET_HEIGHT, SOCKET_BIG_TAPER, SOCKET_TAPER_WIDTH, CLEARANCE } from './generatorTypes';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { type CellMask } from '@/shared/utils/cellMask';
import { forEachCell } from './cellDecomposition';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

/** Insets at each Z breakpoint — same values as `baseplateGenerator`. */
const STACK_INSET_TOP = 0;
const STACK_INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
const STACK_INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/**
 * Build a single pocket cutter for one cell. Multi-section loft with
 * the same five sections + two coplanar caps that
 * `baseplateGenerator.buildPocketCutter` uses, just translated UP by
 * `SOCKET_HEIGHT` so the slab sits at Z ∈ [0, SOCKET_HEIGHT] rather
 * than the baseplate's Z ∈ [-SOCKET_HEIGHT, 0].
 */
function buildLidStackPocketCutter(cellW_mm: number, cellD_mm: number): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const section = (z: number, inset: number): Sketch => {
    const w = Math.max(cellW_mm - 2 * inset, 0.1);
    const d = Math.max(cellD_mm - 2 * inset, 0.1);
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Slab top sits at Z=SOCKET_HEIGHT (5mm above the lid floor); pocket
  // breakpoints walk DOWN from there mirroring the baseplate's profile.
  const TOP = SOCKET_HEIGHT;
  const s0 = section(TOP + LID_COPLANAR_MARGIN, STACK_INSET_TOP);
  const sections: Sketch[] = [
    section(TOP, STACK_INSET_TOP),
    section(TOP - CLEARANCE / 2, STACK_INSET_TOP),
    section(TOP - SOCKET_BIG_TAPER, STACK_INSET_MID),
    section(TOP - SOCKET_BIG_TAPER - (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH), STACK_INSET_MID),
    section(0, STACK_INSET_BOT),
    section(-LID_COPLANAR_MARGIN, STACK_INSET_BOT),
  ];
  return s0.loftWith(sections, { ruled: true });
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
  const { cellsX, cellsY, gridUnitMm } = inputs;

  // 1. Slab — lid's outer footprint extruded UP by SOCKET_HEIGHT (5mm,
  //    matching the baseplate's slab depth). `buildOutlineDrawing(inputs, 0)`
  //    gives the full perimeter — rounded for plain bins, polygon for
  //    cellMask bins.
  const slabSketch = buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', 0) as Sketch;
  let slab: Shape3D = scope.register(slabSketch.extrude(SOCKET_HEIGHT));

  // 2. Pocket cutters — one per filled cell. `forEachCell` decomposes
  //    half-bin grids into 1u + 0.5u sub-cells; we cut a pocket sized
  //    to whichever sub-cell appears at each position. Polygon
  //    (cellMask) bins skip pockets in unfilled cells so the lip
  //    pattern only covers material that actually exists.
  const halfTotalW = (cellsX * gridUnitMm) / 2;
  const halfTotalD = (cellsY * gridUnitMm) / 2;
  const pockets: Shape3D[] = [];
  forEachCell(
    cellsX,
    cellsY,
    (cell) => {
      const cellW = cell.widthUnits * gridUnitMm;
      const cellD = cell.depthUnits * gridUnitMm;
      if (inputs.cellMask) {
        const cellX = Math.round((cell.centerX + halfTotalW - gridUnitMm / 2) / gridUnitMm);
        const cellY = Math.round((cell.centerY + halfTotalD - gridUnitMm / 2) / gridUnitMm);
        if (!isCellFilled(inputs.cellMask, cellX, cellY)) return;
      }
      const pocket = buildLidStackPocketCutter(cellW, cellD);
      const positioned = scope.register(translate(pocket, [cell.centerX, cell.centerY, 0]));
      pocket.delete();
      pockets.push(positioned);
    },
    { gridUnitMm }
  );

  if (pockets.length > 0) {
    scope.register(slab);
    slab = unwrap(cutAll(slab as ValidSolid, pockets as ValidSolid[]));
  }
  return slab;
}
