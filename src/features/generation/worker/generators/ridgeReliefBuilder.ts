/**
 * Underside relief that lets a low-profile bin seat in a STANDARD baseplate.
 *
 * A stock foot lands on the pocket floor with its shoulder
 * `SOCKET_HEIGHT - PLATE_PROFILE_HEIGHT` above the crest between two pockets.
 * A low-profile foot is too short to reach that floor: it settles on the pocket
 * taper instead, and once the tapers have closed their half-clearance the plate
 * stands above the bin's underside wherever two feet meet — along the shared
 * edge, and wider still where the pockets' rounded corners leave a flat cusp. A
 * multi-cell bin then rests on that material rather than on its tapers and
 * rocks on it. `lowProfileBase.kernel.test` measures the seat.
 *
 * The relief is that plate material itself, plus the same headroom a stock foot
 * keeps over the crest: per cell, the pocket's upper taper with its own corner
 * radius, taken out of the body's underside. Inside the feet's outlines it
 * removes nothing, so no foot loses any surface it bears on. In a low-profile
 * plate the crest sits that headroom below the underside and never reaches it.
 */

import {
  box,
  clone,
  cutAll,
  drawRoundedRectangle,
  fuseAll,
  translate,
  unwrap,
  withScope,
} from 'brepjs';
import type { DisposalScope, Shape3D, Sketch, ValidSolid } from 'brepjs';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  CLEARANCE,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  PLATE_PROFILE_HEIGHT,
  SOCKET_HEIGHT,
  footCornerRadius,
  pocketCornerRadius,
  safeSectionRect,
} from './generatorConstants';
import { resolvePitch, type GridUnitInput } from './gridPitch';
import { filledSocketCells, type FractionalEdge, type SocketCellPlan } from './socketBuilder';

/** How far the relief reaches above the underside, in mm. */
export const RIDGE_RELIEF_MM = CLEARANCE / 2 + (SOCKET_HEIGHT - PLATE_PROFILE_HEIGHT);

/**
 * One cell's relief at the origin: its cell box less the pocket's upper taper,
 * which leaves a frame hugging the cell edge. The taper runs on down past the
 * underside so its walls cross that plane rather than sit on it.
 *
 * The frame's inner 0.1mm overlaps the foot's top face, where the foot's own
 * taper already lies on the pocket's, so the foot's top is taken out of it too.
 * Left in, that strip is a groove above every foot's top edge, all the way
 * round the outer wall.
 */
function buildCellRelief(scope: DisposalScope, cellW: number, cellD: number): Shape3D {
  const cornerR = pocketCornerRadius(cellW, cellD);
  const section = (z: number, inset: number): Sketch => {
    const { width, depth, radius } = safeSectionRect(
      cellW - 2 * inset,
      cellD - 2 * inset,
      cornerR - inset
    );
    return drawRoundedRectangle(width, depth, radius).sketchOnPlane('XY', z) as Sketch;
  };
  const h = RIDGE_RELIEF_MM;
  const m = COPLANAR_MARGIN;
  const below = section(-m, h + m);
  const taper = scope.register(below.loftWith([section(h, 0), section(h + m, 0)], { ruled: true }));
  below.delete();
  const frame = scope.register(box(cellW, cellD, h + m, { at: [0, 0, (h - m) / 2] }));
  // The foot's own top section, clamped as the socket clamps it: on a narrow
  // cell that comes out squarer than `footCornerRadius` alone, and a rounder
  // keepout leaves the foot's corners to the cut. Grown past the foot so its
  // side never lies in the bin's outer wall, which the cut would imprint as a
  // seam 0.1mm above the feet.
  const footW = cellW - CLEARANCE;
  const footD = cellD - CLEARANCE;
  const foot = safeSectionRect(footW, footD, footCornerRadius(footW, footD));
  const o = COPLANAR_OVERLAP;
  const footTop = scope.register(
    (
      drawRoundedRectangle(foot.width + 2 * o, foot.depth + 2 * o, foot.radius + o).sketchOnPlane(
        'XY',
        -m
      ) as Sketch
    ).extrude(h + 2 * m)
  );
  return unwrap(cutAll(frame, [taper, footTop] as ValidSolid[]));
}

/**
 * The relief as one cutting tool in the body frame (underside at Z=0), or null
 * for a single foot, which has no neighbour to share a crest with. Caller owns
 * the result.
 */
export function buildRidgeReliefTool(
  gridW: number,
  gridD: number,
  cellMask: CellMask | undefined,
  gridUnitMm: GridUnitInput,
  plan: SocketCellPlan,
  fractionalEdge?: FractionalEdge
): Shape3D | null {
  const cells = filledSocketCells(gridW, gridD, cellMask, gridUnitMm, plan, fractionalEdge);
  if (cells.length < 2) return null;
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);

  return withScope((scope: DisposalScope) => {
    const templates = new Map<string, Shape3D>();
    const placed: Shape3D[] = [];
    for (const cell of cells) {
      const cellW = cell.widthUnits * unitX;
      const cellD = cell.depthUnits * unitY;
      const key = `${cellW.toFixed(4)}x${cellD.toFixed(4)}`;
      let template = templates.get(key);
      if (template === undefined) {
        template = scope.register(buildCellRelief(scope, cellW, cellD));
        templates.set(key, template);
      }
      placed.push(scope.register(translate(template, [cell.centerX, cell.centerY, 0])));
    }
    const fused = unwrap(fuseAll(placed as ValidSolid[]));
    // Every input is scope-owned, so a fuse that hands one back must not
    // return it to be freed on the way out.
    return placed.includes(fused) ? unwrap(clone(fused)) : fused;
  });
}
