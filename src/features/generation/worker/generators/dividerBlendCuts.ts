/**
 * brepjs cut-solid builders for the three divider/cutout blend cases.
 *
 *   Case 1 — `buildEndTrimCut`: divider ends within cutout span;
 *           trim end to match the cutout profile.
 *   Case 2 — `buildRampCut`: divider just outside the cutout edge;
 *           ~45° wedge ramps from cutout-bottom up to full wall height.
 *   Case 3 — `buildParallelTrimCut`: divider runs parallel to a wall
 *           with a cutout; flat horizontal trim across the overlap.
 */

import { box, draw, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { WallCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
// Import directly from wallCutoutBuilder rather than the featureBuilder
// barrel so only the cutout-shape builder is pulled in — the barrel
// otherwise re-exports every builder, inflating this module's transitive deps.
import { buildSingleCutout } from './wallCutoutBuilder';
import { LIP_HEIGHT, COPLANAR_MARGIN } from './generatorConstants';
import { type DividerInfo, type OuterWallCutoutInfo, MIN_DIM } from './dividerBlendTypes';

/**
 * Case 1: Trim divider end to match cutout profile.
 *
 * When a perpendicular divider terminates within the cutout's horizontal span,
 * cut its end to follow the same profile shape as the outer-wall cutout.
 */
export function buildEndTrimCut(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  cutoutShape: WallCutoutShape,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + 2;
  // Extrude deep enough to cut through divider thickness + margins
  const extrudeDepth = divider.thickness + 2 * COPLANAR_MARGIN;

  // Position at the cutout center (not the divider) so the profile shape
  // matches the outer wall cutout exactly. The narrow extrusion only intersects
  // the divider end where it's coplanar with the wall face.
  const isVertical = divider.axis === 'vertical';

  return buildSingleCutout(
    cutoutShape,
    cutout.cutWidth,
    cutout.userCutHeight,
    overshoot,
    extrudeDepth,
    wallHeight,
    {
      x: isVertical ? cutout.centerOffset : cutout.wallFaceCoord,
      y: isVertical ? cutout.wallFaceCoord : cutout.centerOffset,
      rotateZ: isVertical ? 0 : 90,
    }
  );
}

/**
 * Case 2: Ramp from full height to cutout bottom.
 *
 * A straight-slope wedge cut where a perpendicular divider is adjacent to
 * (just outside) the cutout span. Ramp length = userCutHeight, capped at
 * half the divider's span length. Creates a ~45° slope.
 */
export function buildRampCut(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  wallHeight: number
): Shape3D | null {
  const segLength = divider.spanEnd - divider.spanStart;
  const rampLen = Math.min(cutout.userCutHeight, segLength / 2);
  if (rampLen < MIN_DIM) return null;

  const rampHeight = cutout.userCutHeight;
  if (rampHeight < MIN_DIM) return null;

  // Triangular profile on XZ plane: X = distance from wall (inward), Z = height.
  // At X=0 (wall face) the cut goes down to cutBottom; at X=rampLen (inward)
  // the cut is at wallHeight (full height). The triangle removes the wedge
  // from the divider top near the wall face.
  const profile = draw([0, wallHeight])
    .lineTo([rampLen, wallHeight])
    .lineTo([0, wallHeight - rampHeight])
    .close();

  const extrudeLen = divider.thickness + 2 * COPLANAR_MARGIN;
  // Each transform allocates a new WASM handle while the previous becomes
  // garbage. Dispose intermediates so only the final positioned shape lives.
  const extruded = sketch(profile, 'XZ').extrude(extrudeLen);
  const centered = translate(extruded, [0, extrudeLen / 2, 0]);
  extruded.delete();
  let shape = centered;

  // Rotate and translate so X (inward) maps to the correct bin axis.
  // Rotation around Z: +90° maps (x,y) → (-y, x), -90° maps (x,y) → (y, -x).
  const isVertical = divider.axis === 'vertical';

  if (isVertical) {
    // Vertical divider near front/back wall.
    // Profile X (inward) must map to bin Y direction.
    // Extrusion Y must map to bin X (divider thickness axis).
    const wallEnd = cutout.inwardSign > 0 ? divider.spanStart : divider.spanEnd;

    // Front wall (inwardSign=+1): inward = +Y → rotate +90° maps X → +Y
    // Back wall (inwardSign=-1): inward = -Y → rotate -90° maps X → -Y (via y=-x flip)
    const rotated = rotate(shape, cutout.inwardSign > 0 ? 90 : -90, { axis: [0, 0, 1] });
    shape.delete();
    const positioned = translate(rotated, [divider.posAlongPerp, wallEnd, 0]);
    rotated.delete();
    return positioned;
  }

  // Horizontal divider near left/right wall.
  // Profile X (inward) stays as bin X for left wall (+X inward).
  // For right wall (-X inward), rotate 180° to flip.
  const wallEnd = cutout.inwardSign > 0 ? divider.spanStart : divider.spanEnd;

  if (cutout.inwardSign < 0) {
    const rotated = rotate(shape, 180, { axis: [0, 0, 1] });
    shape.delete();
    shape = rotated;
  }
  const positioned = translate(shape, [wallEnd, divider.posAlongPerp, 0]);
  shape.delete();
  return positioned;
}

/**
 * Case 3: Flat horizontal trim for parallel divider visible through cutout.
 *
 * When a divider runs parallel to a wall with a cutout, and the divider's
 * span overlaps the cutout's horizontal span, trim the divider top down to
 * the cutout bottom height within the overlapping region.
 */
export function buildParallelTrimCut(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo
): Shape3D | null {
  // Compute overlap between divider span and cutout span (both in global coords)
  const overlapStart = Math.max(divider.spanStart, cutout.cutLeft);
  const overlapEnd = Math.min(divider.spanEnd, cutout.cutRight);
  const overlapWidth = overlapEnd - overlapStart;
  if (overlapWidth < MIN_DIM) return null;

  const trimHeight = cutout.userCutHeight;
  if (trimHeight < MIN_DIM) return null;

  const overlapCenter = (overlapStart + overlapEnd) / 2;
  const boxThickness = divider.thickness + 2 * COPLANAR_MARGIN;
  const boxHeight = trimHeight + COPLANAR_MARGIN; // extend above wall top

  const isHorizontalDivider = divider.axis === 'horizontal';

  if (isHorizontalDivider) {
    // Horizontal divider runs along X, parallel to front/back wall.
    // cutout.spanAxis === 'x', so overlap is along X.
    return box(overlapWidth, boxThickness, boxHeight, {
      at: [overlapCenter, divider.posAlongPerp, cutout.cutBottom + boxHeight / 2],
    });
  }

  // Vertical divider runs along Y, parallel to left/right wall.
  // cutout.spanAxis === 'y', so overlap is along Y.
  return box(boxThickness, overlapWidth, boxHeight, {
    at: [divider.posAlongPerp, overlapCenter, cutout.cutBottom + boxHeight / 2],
  });
}
