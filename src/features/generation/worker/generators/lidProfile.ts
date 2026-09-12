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
import { LIP_BIG_TAPER, safeSectionRect } from './generatorConstants';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { buildMaskDrawingAtInset } from './maskPolygon';
import type { LidInputs } from './lidInputs';

/**
 * Build a 2D outline at the requested inset from the lid's outer perimeter.
 * Returns either a rounded-rectangle drawing (rectangular bins) or a polygon
 * drawing (cellMask bins). Corner radius decreases with inset so all
 * loft sections in the same series remain topologically consistent.
 */
export function buildOutlineDrawing(inputs: LidInputs, outerInset: number): Drawing {
  const { lidOuterW, lidOuterD, lidCornerR, gridUnitMm, gridUnitMmY, fitClearance, cellMask } =
    inputs;
  const { outerOffsetX, outerOffsetY } = inputs;
  const { width, depth, radius } = safeSectionRect(
    lidOuterW - 2 * outerInset,
    lidOuterD - 2 * outerInset,
    lidCornerR - outerInset
  );

  const outline = cellMask
    ? // Polygon path: total inset from the base (full grid) polygon =
      // fitClearance + outerInset. The polygon helper handles the inset and
      // corner rounding in closed form for axis-aligned polygons. Pass the
      // per-axis pitch so a non-square grid stretches rows independently.
      buildMaskDrawingAtInset(
        cellMask,
        { x: gridUnitMm, y: gridUnitMmY },
        fitClearance + outerInset,
        radius
      )
    : // Rectangular path
      drawRoundedRectangle(width, depth, radius);

  // Asymmetric overhang shifts the bin's outer body off the socket grid; the
  // lid's perimeter follows so it wraps the lip. Symmetric/absent overhang
  // (and all polygon bins) leave the offset at zero — a no-op translate.
  return outerOffsetX !== 0 || outerOffsetY !== 0
    ? outline.translate(outerOffsetX, outerOffsetY)
    : outline;
}

function sectionAt(inputs: LidInputs, z: number, outerInset: number): Sketch {
  return buildOutlineDrawing(inputs, outerInset).sketchOnPlane('XY', z) as Sketch;
}

/**
 * Mating shell — inverted-lip wall that wraps the bin's stacking lip.
 *
 * Cross-section (Y vertical, going up from wall bottom to floor top):
 *   - Y ∈ [chamferTop, 0]: wall thickness = lidCornerR (full corner-radius)
 *   - Y ∈ [chamferTop - plugInset, chamferTop]: outer face chamfers inward by
 *     LIP_BIG_TAPER + mateRelief, at 45° — parallel to the lip's top chamfer
 *   - Y ∈ [wallBottom, chamferTop - plugInset]: wall thickness =
 *     lidCornerR - LIP_BIG_TAPER - mateRelief, matching the lip's vertical part
 *
 * `mateRelief` backs the plug off the lip on a snap-fit or magnetic lid so the
 * retention isn't fighting a friction fit. It is a PERPENDICULAR offset of the
 * mating face, which on the 45° chamfer means the break where that face meets
 * the visible vertical skirt rises by `mateRelief * √2` — hence `chamferTopZ`
 * rather than `anchorZ` here.
 *
 * Insetting the bottom of the chamfer without raising its top is what #4235
 * did, and it left the chamfer running at 42.8° against the lip's 45°: the two
 * faces met at the lip's peak and opened to a full `mateRelief` at the bottom,
 * so the "clearance" was a wedge that vanished exactly where the parts touch.
 * A relief only buys tolerance if it is the same everywhere along the face.
 *
 * `anchorZ` itself is untouched — it is the seating datum every other part of
 * the lid is pinned to (rails, magnet bosses, grip reliefs), and moving it
 * would shift all of them.
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
  const { cavityInset, anchorZ, wallBottomZ, mateRelief } = inputs;
  const plugInset = LIP_BIG_TAPER + mateRelief;
  // Where the 45° mating face meets the vertical skirt. Offsetting that face
  // perpendicular by `mateRelief` moves its intercept with the skirt up by
  // `mateRelief * √2`; without this the chamfer's top stays pinned to the lip's
  // peak and the relief only opens at the bottom. Exactly `anchorZ` when there
  // is no relief, so a friction lid is untouched.
  const chamferTopZ = anchorZ + mateRelief * Math.SQRT2;
  // 45°: the horizontal run and the vertical drop are the same number, which is
  // what keeps this face parallel to the lip's chamfer at any relief.
  const zVertTop = chamferTopZ - plugInset;

  // OUTER profile — 4 sections in ASCENDING Z (loftWith expects this):
  //  Z=wallBottom and Z=zVertTop  : chamfered inward by LIP_BIG_TAPER, plus the
  //                                 plug relief when there is one
  //  Z=chamferTop and Z=0         : full outer (no chamfer)
  const outerSections: readonly Sketch[] = [
    sectionAt(inputs, wallBottomZ, plugInset),
    sectionAt(inputs, zVertTop, plugInset),
    sectionAt(inputs, chamferTopZ, 0),
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
