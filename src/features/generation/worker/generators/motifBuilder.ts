/**
 * Motif wall-pattern builder (brepjs layer).
 *
 * Converts a pure {@link MotifCell} — a tiled unit cell of 2D outlines (lines
 * and arcs) — into the 3D cut solid subtracted from the wall:
 *
 *   - `holes`   mode → union of the cell outlines (cut shapes out of the wall)
 *   - `lattice` mode → panel − struts (open everything but the thin struts)
 *
 * This is the documented seam for complex patterns (asanoha, seigaiha,
 * kumiko). It is unit-tested standalone; wiring it into the per-wall cache/clip
 * flow of `buildWallPatterns` is the next step, so no motif pattern ships in
 * the registry yet.
 */

import { draw, drawRoundedRectangle, translate, cut, fuseAll, unwrap } from 'brepjs';
import type { Drawing, Shape3D } from 'brepjs';
import { sketch } from './meshUtils';
import { tileMotifCells } from './patterns/motifTiling';
import type { MotifCell, MotifPath } from './patterns';

/** Convert a pure motif outline (lines + arcs) into a brepjs Drawing. */
function pathToDrawing(path: MotifPath): Drawing {
  let pen = draw([path.start[0], path.start[1]]);
  for (const seg of path.segments) {
    pen =
      seg.kind === 'line'
        ? pen.lineTo([seg.to[0], seg.to[1]])
        : pen.sagittaArcTo([seg.to[0], seg.to[1]], seg.sagitta);
  }
  return pen.close();
}

/**
 * Build the 3D cut solid for a motif tiled across a panelW × panelH wall face,
 * extruded to `cutDepth` and centered on z = 0. Returns null if nothing tiles.
 */
export function buildMotifCut(
  cell: MotifCell,
  panelW: number,
  panelH: number,
  cutDepth: number
): Shape3D | null {
  const tiles = tileMotifCells(cell, panelW, panelH);
  const paths = cell.buildCellPaths();
  if (tiles.length === 0 || paths.length === 0) return null;

  const solids: Shape3D[] = [];
  for (const tile of tiles) {
    for (const path of paths) {
      const prism = sketch(pathToDrawing(path), 'XY').extrude(cutDepth);
      const placed = translate(prism, [tile.x, tile.y, -cutDepth / 2]);
      prism.delete();
      solids.push(placed);
    }
  }

  let struts: Shape3D;
  if (solids.length === 1) {
    struts = solids[0];
  } else {
    struts = unwrap(fuseAll(solids));
    for (const s of solids) s.delete();
  }

  if (cell.mode === 'holes') return struts;

  // lattice: cut = panel − struts, leaving only the thin struts as solid wall.
  const panelExtrude = sketch(drawRoundedRectangle(panelW, panelH, 0), 'XY').extrude(cutDepth);
  const panelPrism = translate(panelExtrude, [0, 0, -cutDepth / 2]);
  panelExtrude.delete();
  const result = unwrap(cut(panelPrism, struts));
  panelPrism.delete();
  struts.delete();
  return result;
}
