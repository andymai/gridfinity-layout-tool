/**
 * Magnet hole pass for the lid.
 *
 * 4 holes per cell at ±13mm from the cell center (Gridfinity standard).
 * Each hole is a BLIND pocket on the floor's UPPER face — opens at lid-local
 * Z = 0 (the visible top surface that an upper bin sits on when stacked) and
 * stops short of the floor BOTTOM by `LID_MAGNET_CEILING` so the magnet sits
 * in a sealed cup. A half-bin sub-cell keeps whatever of the pattern its size
 * allows, exactly as the bin base under it does, so the two still mate; polygon
 * bins use the mask to skip unfilled cells.
 */

import { drawCircle, unwrap, translate, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { LID_COPLANAR_MARGIN, LID_MAGNET_CEILING } from './lidConstants';
import { forEachCell } from './cellDecomposition';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './baseplateMagnets';
import { isRegionFilled } from '@/shared/utils/cellMask';
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
    magnetAnchor,
    topThickness,
    cellMask,
  } = inputs;
  const radius = magnetDiameter / 2;
  // Magnet cells sit on the (possibly non-square) socket grid; the ±13mm hole
  // offsets themselves stay isotropic (a fixed round feature).
  const pitch = { x: gridUnitMm, y: gridUnitMmY };

  // Capping at `topThickness - ceiling` is defensive in case `topThickness`
  // was bumped up by `resolveLidPlateThickness` for an oversize magnet — guarantees
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
  // the lid footprint into 1u full cells + a trailing 0.5u half-cell. Both take
  // holes on the same terms `socketBuilder.buildBaseSocket` uses, so the lid
  // magnets line up with the bin's base sockets whatever the decomposition.
  const halfTotalW = (cellsX * gridUnitMm) / 2;
  const halfTotalD = (cellsY * gridUnitMmY) / 2;
  forEachCell(
    cellsX,
    cellsY,
    (cell) => {
      if (!cellHostsAttachmentHoles(cell, radius, gridUnitMm, gridUnitMmY)) return;
      if (cellMask) {
        // The cell's own extent, not a full cell's — a half cell covers one
        // column of mask sub-cells, and asking about four would read past it.
        const leftUnit =
          (cell.centerX + halfTotalW - (cell.widthUnits * gridUnitMm) / 2) / gridUnitMm;
        const bottomUnit =
          (cell.centerY + halfTotalD - (cell.depthUnits * gridUnitMmY) / 2) / gridUnitMmY;
        if (!isRegionFilled(cellMask, leftUnit, bottomUnit, cell.widthUnits, cell.depthUnits)) {
          return;
        }
      }
      // Shared placement so the lid magnets land at exactly the positions the
      // bin base sockets use (same wall-distance clamp), letting them mate.
      for (const [px, py] of magnetPositionsForCell(
        cell,
        radius,
        gridUnitMm,
        gridUnitMmY,
        magnetAnchor
      )) {
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
