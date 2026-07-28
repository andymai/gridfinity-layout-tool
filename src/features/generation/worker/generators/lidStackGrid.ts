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
import { SOCKET_HEIGHT, SOCKET_BIG_TAPER, SOCKET_TAPER_WIDTH, CLEARANCE } from './generatorTypes';
import { LID_COPLANAR_MARGIN, LID_MIN_CORNER_RADIUS } from './lidConstants';
import { type CellMask } from '@/shared/utils/cellMask';
import { forEachCell } from './cellDecomposition';
import { buildMaskDrawingAtInset } from './maskPolygon';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

/** Insets at each Z breakpoint — same values as `baseplateGenerator`. */
const STACK_INSET_TOP = 0;
const STACK_INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
const STACK_INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/**
 * Z breakpoints of the pocket profile, paired with their inset. The slab's top
 * face sits at `SOCKET_HEIGHT` (5mm above the lid floor) and the breakpoints
 * walk DOWN from there mirroring the baseplate's profile, with a coplanar cap
 * at each end so the cut bites cleanly through both faces. Kept in that
 * descending order because reversing a ruled loft flips the solid's face
 * orientation.
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

/** Loft a pocket cutter from `POCKET_PROFILE`, sketching each section with
 *  `outlineAt(inset)`. Sections must share a vertex topology. */
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
      Math.max(cellW_mm - 2 * inset, 0.1),
      Math.max(cellD_mm - 2 * inset, 0.1),
      Math.max(cornerR - inset, 0.1)
    )
  );
}

/**
 * Build ONE pocket cutter spanning the whole footprint — the lip-only stack
 * top (#2930). Same profile as a per-cell pocket, so the outer lip an upper
 * bin registers against is bit-identical to the grid version's; only the
 * interior cell ridges are gone.
 *
 * Sized from the NOMINAL socket grid rather than `buildOutlineDrawing`'s lid
 * perimeter: that perimeter is shrunk by `fitClearance` and both grown and
 * shifted by asymmetric overhang, none of which the sockets of a bin stacked
 * on top move with. The per-cell path stays on the nominal grid for the same
 * reason (its pockets sit at nominal cell centres).
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
      : // Same 0.1mm floor as the per-cell cutter: the deepest inset is
        // STACK_INSET_BOT (2.95mm per side), which a small enough grid unit
        // would drive to a zero/negative dimension.
        drawRoundedRectangle(
          Math.max(totalW - 2 * inset, 0.1),
          Math.max(totalD - 2 * inset, 0.1),
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
        const pocket = buildLidStackPocketCutter(cellW, cellD);
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
