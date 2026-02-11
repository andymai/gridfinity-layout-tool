/**
 * Box body and stacking lip builder for Gridfinity bins.
 *
 * Builds the bin box (rounded-rectangle extrusion, shelled from top)
 * and the stacking lip (swept profile around perimeter with fillet).
 *
 * Box coordinate system:
 * - Z=0: socket interface (bottom of box)
 * - Z=wallHeight: top of box walls
 */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  unwrap,
  fuse,
  fillet,
  faceFinder,
  edgeFinder,
  getBounds,
  shell,
} from 'brepjs';
import type { Shape3D, Plane, Vec3, Sketch } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  TOP_FILLET,
  sketch,
} from './generatorTypes';
import { getBoxCache, setBoxCache, getLipCache, setLipCache } from './shapeCache';

// ─── Box Body Builder ────────────────────────────────────────────────────────

/**
 * Build the bin box: a rounded-rectangle extrusion, shelled from the top.
 * The box starts at Z=0 (socket interface) and goes up to wallHeight.
 * Shell removes the top face, leaving walls + solid floor.
 *
 * @param cutoutTopOffset - For solid mode: lowers the interior fill by this amount (mm)
 */
export function buildBinBox(
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  solid: boolean,
  cutoutTopOffset: number = 0
): Shape3D {
  const boxKey = `${gridW}|${gridD}|${wallHeight}|${wallThickness}|${solid}|${cutoutTopOffset}`;
  const cached = getBoxCache(boxKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  const box = sketch(drawRoundedRectangle(outerW, outerD, CORNER_RADIUS)).extrude(wallHeight);

  // Solid mode: return the raw extrusion, optionally with lowered interior fill
  if (solid) {
    if (cutoutTopOffset > 0) {
      // Build hollow walls extending to full wallHeight
      const topFaces = faceFinder().parallelTo('Z').atDistance(wallHeight, [0, 0, 0]).findAll(box);
      const hollowWalls = unwrap(shell(box, topFaces, wallThickness));

      // Build interior solid block stopping at wallHeight - cutoutTopOffset
      const innerW = outerW - 2 * wallThickness;
      const innerD = outerD - 2 * wallThickness;
      const fillHeight = wallHeight - cutoutTopOffset;
      const innerFill = sketch(
        drawRoundedRectangle(innerW, innerD, Math.max(0, CORNER_RADIUS - wallThickness)),
        'XY'
      ).extrude(fillHeight);

      // Combine walls with lowered interior fill
      const result = unwrap(fuse(hollowWalls, innerFill));
      return setBoxCache(boxKey, result);
    } else {
      // Standard solid mode: full solid block
      return setBoxCache(boxKey, box);
    }
  }

  const topFaces = faceFinder().parallelTo('Z').atDistance(wallHeight, [0, 0, 0]).findAll(box);
  const result = unwrap(shell(box, topFaces, wallThickness));
  return setBoxCache(boxKey, result);
}

// ─── Top Shape (Stacking Lip) Builder ────────────────────────────────────────

/**
 * Build the stacking lip at the top of the bin.
 *
 * The lip provides the mating interface that allows bins to stack.
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * The profile sweeps around the bin perimeter, then gets filleted at the peak.
 *
 * Profile traces (in XZ plane, X=outward, Z=up):
 *   Lip taper shape upward (mates with socket cavity when stacked)
 *   + wall extension downward (if includeLip, replaces top wall section)
 *
 * Built at Z=0 locally, caller translates to wallHeight.
 */
export function buildTopShape(gridW: number, gridD: number, includeLip: boolean): Shape3D {
  const lipKey = `${gridW}|${gridD}|${includeLip}`;
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  const topProfile = (plane: Plane, _origin: Vec3): Sketch => {
    // Draw the lip profile (going upward from the sweep path)
    // Per spec: 0.7mm bottom chamfer, 1.8mm vertical, 1.9mm top chamfer
    let sketcher = draw([-LIP_TAPER_WIDTH, 0])
      .line(LIP_SMALL_TAPER, LIP_SMALL_TAPER)
      .vLine(LIP_VERTICAL_PART)
      .line(LIP_BIG_TAPER, LIP_BIG_TAPER);

    if (includeLip) {
      // Extend wall downward with a FIXED depth to create consistent lip geometry.
      // Use 1.2mm (standard wall thickness) for the extension - this ensures the
      // lip profile is identical regardless of actual wall thickness. The overlap
      // with thicker walls is handled by the fuse operation.
      const LIP_EXTENSION = 1.2;
      sketcher = sketcher
        .vLineTo(-(LIP_TAPER_WIDTH + LIP_EXTENSION))
        .lineTo([-LIP_TAPER_WIDTH, -LIP_EXTENSION]);
    } else {
      sketcher = sketcher.vLineTo(0);
    }

    const basicShape = sketcher.close();

    // Per Gridfinity spec, the 0.5mm clearance is already applied to the outer
    // dimensions (SIZE - CLEARANCE). The lip profile itself needs no additional
    // clearance transforms -- only a clip to the valid region.
    let topProfileShape = basicShape.intersect(
      drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5)
    );

    if (includeLip) {
      // Remove the wall portion that the lip replaces
      const LIP_EXTENSION = 1.2;
      topProfileShape = topProfileShape.cut(
        drawRectangle(LIP_EXTENSION, 10).translate(-LIP_EXTENSION / 2, -5)
      );
    }

    // Pass the plane object directly -- brepjs Drawing.sketchOnPlane accepts Plane
    return topProfileShape.sketchOnPlane(plane) as Sketch;
  };

  // Sweep around the bin perimeter (built at Z=0, caller translates)
  const boxSketch = drawRoundedRectangle(outerW, outerD, CORNER_RADIUS).sketchOnPlane() as Sketch;

  const swept = boxSketch.sweepSketch(topProfile, { withContact: true });
  // Find the top edge of the lip at Z=LIP_HEIGHT (4.4mm)
  // EdgeFinderFn has no box filter, so use .when() predicate (official custom filter API)
  const lipEdges = edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      // Select edges that overlap the top 1mm slice of the lip (intersection, not containment)
      return bounds.zMax >= LIP_HEIGHT - 1 && bounds.zMin <= LIP_HEIGHT;
    })
    .findAll(swept);
  const result = unwrap(fillet(swept, lipEdges, TOP_FILLET));

  return setLipCache(lipKey, result);
}
