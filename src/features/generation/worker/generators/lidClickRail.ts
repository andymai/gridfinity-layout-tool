/**
 * Click rails — snap features extruded along each straight wall of the lid.
 *
 * Cross-section (X = outward from corner-radius line, Y = vertical): the
 * polygon's top sits at Z=wallBottom, flush with the plug wall's outer face,
 * flares back to the shank at 45°, drops past the lip's throat, then puts a nub
 * under the lip's angled support to hook it. `clickRailProfile` solves every
 * one of those from the lip's own spec — see its notes.
 *
 * Each rail is built in a canonical orientation (extrusion along X axis,
 * profile in YZ plane), then translated/rotated to each straight wall.
 * Rails are inset from corners by `lidCornerR` on both ends; where they go
 * is `lidRailPlan`'s.
 */

import { draw, unwrap, fuse, translate, rotate } from 'brepjs';
import type { Shape3D, DisposalScope, Drawing } from 'brepjs';
import {
  clickRailProfile,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  type ClickRailProfile,
} from './lidConstants';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { railPlacements, splitRailsAroundGrip } from '@/shared/utils/lidRailPlan';
import type { LidInputs } from '@/shared/utils/lidInputs';

/** True when at least one side carries a rail, i.e. the lid is not friction-fit. */
export function hasAnyClickRail(rails: LidInputs['clickRails']): boolean {
  return rails.front || rails.back || rails.left || rails.right;
}

/**
 * Top-chamfer apex X for a rail bar, given the cavity wall's rail-local X.
 *
 * The chamfer slopes 45° from the rail's inner-face top corner up to this
 * apex; we want the apex to land on the cavity wall so the rail attaches
 * flush instead of leaving an unsupported tongue hanging into the cavity.
 * When the cavity wall is at or inboard of the spine (LID_WALL_THICKNESS
 * ≳ 1.85mm), the apex falls back to the baseline 0.8mm chamfer width.
 *
 * Exported for unit testing of the geometric relationship.
 */
export function chamferApexXForCavityWall(cavityWallX: number): number {
  return Math.max(LID_CLICK_RAIL_INNER + LID_CLICK_RAIL_TOP_CHAMFER, cavityWallX);
}

/**
 * Build the rail's 2D cross-section.
 *
 * Walks the outer side downward — shank, catch face, nub, lead-in ramp — then
 * returns along the bottom and up the inner face. The outer points come from
 * {@link clickRailProfile}, which solves them against the lip's own undercut;
 * see its notes for why none of them is a free constant.
 *
 * @param wallBottomZ Z of the rail's top face (= bottom of mating wall).
 * @param cavityWallX Rail-local X of the lid's cavity inner face. The rail
 *   spine sits at X=0 and is anchored at the lid's corner-radius line; the
 *   cavity wall sits at `lidCornerR - cavityInset` away from the spine in
 *   the outward (+X) direction. The top chamfer's apex extends to meet
 *   this position so the rail attaches flush to the cavity wall instead
 *   of leaving an unsupported tongue hanging in midair.
 */
function clickShape2D(
  wallBottomZ: number,
  cavityWallX: number,
  profile: ClickRailProfile
): Drawing {
  // Top of polygon = top of rail = bottom of mating wall.
  const yTop = wallBottomZ;
  const chamferApexX = chamferApexXForCavityWall(cavityWallX);
  const chamferTopY = yTop + (chamferApexX - LID_CLICK_RAIL_INNER);

  // A rail the bin leaves no pocket for collapses the catch face to zero
  // length; dropping the coincident pair keeps the wire buildable rather than
  // handing OCCT a degenerate segment.
  const outer = dropCoincidentPoints(
    [
      { x: profile.flareX, y: yTop },
      { x: profile.shankX, y: yTop - profile.flareDrop },
      { x: profile.shankX, y: yTop - profile.catchTopDrop },
      { x: profile.catchX, y: yTop - profile.catchBottomDrop },
      { x: profile.leadInX, y: yTop - profile.bottomDrop },
    ],
    false
  );

  let d = draw([chamferApexX, yTop]);
  for (const p of outer) d = d.lineTo([p.x, p.y]);
  return d
    .lineTo([LID_CLICK_RAIL_INNER, yTop - profile.bottomDrop])
    .lineTo([LID_CLICK_RAIL_INNER, yTop])
    .lineTo([chamferApexX, chamferTopY])
    .close();
}

/**
 * Build a single click rail bar in a canonical orientation: extruded along
 * the X axis (length = wallLength), profile in YZ plane at X=0. The rail's
 * outward direction is +Y (so the bump protrudes in +Y), and its top sits
 * at Z=wallBottomZ.
 */
function buildClickRailBar(
  scope: DisposalScope,
  wallBottomZ: number,
  cavityWallX: number,
  profile: ClickRailProfile,
  length: number
): Shape3D {
  // Build polygon in a 2D plane where local X = outward, local Y = vertical.
  // Sketch on YZ plane (perpendicular to wall direction = X axis).
  const section = clickShape2D(wallBottomZ, cavityWallX, profile);
  const sketch = section.sketchOnPlane('YZ', -length / 2);
  return scope.register(sketch.extrude(length));
}

export function addClickRails(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const placements = splitRailsAroundGrip(railPlacements(inputs), inputs);

  // Cavity wall position in rail-local X (where +X is outward from the
  // spine). The spine sits at `lidCornerR` from the lid outer; the cavity
  // wall sits at `cavityInset`. Their difference tells the rail's chamfer
  // how far outward it needs to climb to meet the wall flush.
  const cavityWallX = inputs.lidCornerR - inputs.cavityInset;
  // One section for every rail on the lid: it is solved against the bin's lip
  // and wall, neither of which varies per wall.
  const profile = clickRailProfile(inputs.lidCornerR, inputs.binWallThickness, inputs.mateRelief);

  let result = body;
  for (const place of placements) {
    const rail = buildClickRailBar(scope, inputs.wallBottomZ, cavityWallX, profile, place.length);
    const oriented =
      place.rotationDeg === 0
        ? rail
        : scope.register(rotate(rail, place.rotationDeg, { axis: [0, 0, 1] }));
    const positioned = scope.register(translate(oriented, [place.centerX, place.centerY, 0]));
    if (originToTag) {
      collectOrigins(positioned, FeatureTag.LID_RAIL, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, positioned));
  }
  return result;
}
