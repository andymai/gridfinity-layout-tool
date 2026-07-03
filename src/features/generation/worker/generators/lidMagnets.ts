/**
 * Magnet hole pass for the lid.
 *
 * 4 holes per cell at ±13mm from the cell center (Gridfinity standard).
 * Each hole is a BLIND pocket on the floor's UPPER face — opens at lid-local
 * Z = 0 (the visible top surface that an upper bin sits on when stacked) and
 * stops short of the floor BOTTOM by `LID_MAGNET_CEILING` so the magnet sits
 * in a sealed cup. Half-bin sub-cells are skipped (Gridfinity doesn't define
 * fractional-cell magnet positions); polygon bins use `isCellFilled` to skip
 * unfilled cells.
 */

import { drawCircle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { LID_COPLANAR_MARGIN, LID_MAGNET_CEILING } from './lidConstants';
import { forEachCell } from './cellDecomposition';
import { magnetPositionsForCell } from './baseplateMagnets';
import { isCellFilled } from './lidStackGrid';
import type { LidInputs } from './lidInputs';

export function cutMagnetHoles(scope: DisposalScope, body: Shape3D, inputs: LidInputs): Shape3D {
  const {
    cellsX,
    cellsY,
    fractionalEdgeX,
    fractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    magnetDiameter,
    magnetDepth,
    topThickness,
    cellMask,
  } = inputs;
  const radius = magnetDiameter / 2;
  // Magnet cells sit on the (possibly non-square) socket grid; the ±13mm hole
  // offsets themselves stay isotropic (a fixed round feature).
  const pitch = { x: gridUnitMm, y: gridUnitMmY };

  // Capping at `topThickness - ceiling` is defensive in case `topThickness`
  // was bumped up by `lidTopThickness` for an oversize magnet — guarantees
  // we never poke through the cavity face. Floor top gets a small coplanar
  // margin so the cut bites cleanly through the entry face.
  const cappedDepth = Math.max(0.4, Math.min(magnetDepth, topThickness - LID_MAGNET_CEILING));
  // Sketch sits below the floor top by `cappedDepth` so the extruded
  // cylinder reaches Z = 0 (top face) plus a coplanar margin above.
  const holeZ = -cappedDepth;
  const holeHeight = cappedDepth + LID_COPLANAR_MARGIN;

  // Build all cylinder cutters first, then apply them in a single cutAll.
  // Faster than per-magnet cut() for non-trivial lids — a 10×10 polygon lid
  // has ~400 holes; per-cut would be 400 boolean ops vs one batched op here.
  const cutters: Shape3D[] = [];
  // forEachCell handles fractional dimensions (half-bin mode): it decomposes
  // the lid footprint into 1u full cells + a trailing 0.5u half-cell. Skip
  // half-cells — Gridfinity doesn't define magnet positions for fractional
  // cells (matches `socketBuilder.buildBaseSocket`), so the lid magnets line
  // up with the bin's base sockets.
  const halfTotalW = (cellsX * gridUnitMm) / 2;
  const halfTotalD = (cellsY * gridUnitMmY) / 2;
  forEachCell(
    cellsX,
    cellsY,
    (cell) => {
      if (cell.widthUnits !== 1 || cell.depthUnits !== 1) return;
      if (cellMask) {
        const cellX = Math.round((cell.centerX + halfTotalW - gridUnitMm / 2) / gridUnitMm);
        const cellY = Math.round((cell.centerY + halfTotalD - gridUnitMmY / 2) / gridUnitMmY);
        if (!isCellFilled(cellMask, cellX, cellY)) return;
      }
      // Shared placement so the lid magnets land at exactly the positions the
      // bin base sockets use (same wall-distance clamp), letting them mate.
      for (const [px, py] of magnetPositionsForCell(cell, radius, gridUnitMm, gridUnitMmY)) {
        const cylinder = drawCircle(radius).sketchOnPlane('XY', holeZ).extrude(holeHeight);
        cutters.push(scope.register(translate(cylinder, [px, py, 0])));
      }
    },
    { gridUnitMm: pitch, fractionalEdgeX, fractionalEdgeY }
  );

  if (cutters.length === 0) return body;

  scope.register(body);
  return unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
}
