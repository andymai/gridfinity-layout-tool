/**
 * 2D outline + 3D shell/floor builders for the lid.
 *
 * - `buildOutlineDrawing`: lid outer perimeter at a given inset (rounded rect
 *   for plain bins, polygon for cellMask bins).
 * - `buildMatingShell`: inverted-lip wall built via outer/inner lofts and a
 *   boolean cut, mirroring the boxBuilder shell strategy.
 * - `buildLidFloor`: flat plate at Z ∈ [-topThickness, 0].
 */

import { drawRoundedRectangle, unwrap, cut } from 'brepjs';
import type { Shape3D, DisposalScope, Sketch, Drawing } from 'brepjs';
import { LIP_BIG_TAPER } from './generatorConstants';
import { LID_COPLANAR_MARGIN, LID_MIN_CORNER_RADIUS } from './lidConstants';
import { buildMaskDrawingAtInset } from './maskPolygon';
import type { LidInputs } from './lidInputs';

/**
 * Build a 2D outline at the requested inset from the lid's outer perimeter.
 * Returns either a rounded-rectangle drawing (rectangular bins) or a polygon
 * drawing (cellMask bins). Corner radius decreases with inset so all
 * loft sections in the same series remain topologically consistent.
 */
export function buildOutlineDrawing(inputs: LidInputs, outerInset: number): Drawing {
  const { lidOuterW, lidOuterD, lidCornerR, gridUnitMm, fitClearance, cellMask } = inputs;
  const radius = Math.max(lidCornerR - outerInset, LID_MIN_CORNER_RADIUS);

  if (cellMask) {
    // Polygon path: total inset from the base (full grid) polygon =
    // fitClearance + outerInset. The polygon helper handles the inset and
    // corner rounding in closed form for axis-aligned polygons.
    return buildMaskDrawingAtInset(cellMask, gridUnitMm, fitClearance + outerInset, radius);
  }

  // Rectangular path
  const w = lidOuterW - 2 * outerInset;
  const d = lidOuterD - 2 * outerInset;
  return drawRoundedRectangle(w, d, radius);
}

function sectionAt(inputs: LidInputs, z: number, outerInset: number): Sketch {
  return buildOutlineDrawing(inputs, outerInset).sketchOnPlane('XY', z) as Sketch;
}

/**
 * Mating shell — inverted-lip wall that wraps the bin's stacking lip.
 *
 * Cross-section (Y vertical, going up from wall bottom to floor top):
 *   - Y ∈ [anchor, 0]: wall thickness = lidCornerR (full corner-radius)
 *   - Y ∈ [anchor - LIP_BIG_TAPER, anchor]: outer face chamfers inward by
 *     LIP_BIG_TAPER (matches the lip's top chamfer)
 *   - Y ∈ [wallBottom, anchor - LIP_BIG_TAPER]: wall thickness =
 *     lidCornerR - LIP_BIG_TAPER, matching the lip's vertical part
 *
 * Inner cavity boundary is constant at lidCornerR inset from outer (so the
 * lid corners are solid pillars that don't engage the bin's lip — engagement
 * happens on the straights via the click rails).
 *
 * Built as two lofts (outer + inner) and subtracted, mirroring the
 * `buildTopShapeLoft` strategy from boxBuilder.ts so we stay on the same
 * code path that's been validated against OCCT non-square sweep bugs.
 */
export function buildMatingShell(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { cavityInset, anchorZ, wallBottomZ } = inputs;
  const zVertTop = anchorZ - LIP_BIG_TAPER;

  // OUTER profile — 4 sections in ASCENDING Z (loftWith expects this):
  //  Z=wallBottom and Z=zVertTop : chamfered inward by LIP_BIG_TAPER
  //  Z=anchor and Z=0            : full outer (no chamfer)
  const outerSections: readonly Sketch[] = [
    sectionAt(inputs, wallBottomZ, LIP_BIG_TAPER),
    sectionAt(inputs, zVertTop, LIP_BIG_TAPER),
    sectionAt(inputs, anchorZ, 0),
    sectionAt(inputs, 0, 0),
  ];

  // INNER profile — constant inset at `cavityInset` for every Z. The
  // cavity wall in the lip-mating zone is `cavityInset - LIP_BIG_TAPER =
  // LID_WALL_THICKNESS`. Two sections in ASCENDING Z with COPLANAR margin
  // so the cut bites cleanly through the outer.
  const innerSections: readonly Sketch[] = [
    sectionAt(inputs, wallBottomZ - LID_COPLANAR_MARGIN, cavityInset),
    sectionAt(inputs, LID_COPLANAR_MARGIN, cavityInset),
  ];

  const [oFirst, ...oRest] = outerSections;
  const outerLoft = scope.register(oFirst.loftWith([...oRest], { ruled: true }));
  const [iFirst, ...iRest] = innerSections;
  const innerLoft = scope.register(iFirst.loftWith([...iRest], { ruled: true }));

  return unwrap(cut(outerLoft, innerLoft));
}

/**
 * Floor plate — flat top of the lid.
 *
 * Flat plate at Z ∈ [-topThickness, 0] in the full lid-outer outline. Fuses
 * with the mating shell to seal the cavity at the top.
 */
export function buildLidFloor(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { topThickness } = inputs;
  return scope.register(
    buildOutlineDrawing(inputs, 0).sketchOnPlane('XY', -topThickness).extrude(topThickness)
  );
}
