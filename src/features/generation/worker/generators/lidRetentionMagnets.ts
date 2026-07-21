/**
 * Lid-side retention magnets (issue #2694).
 *
 * Fuses a corner boss into each of the lid's four corners, hanging DOWN from
 * the floor into the mating cavity, and cuts a blind pocket that opens downward
 * so the magnet's pole face meets the bin gusset's magnet across a thin gap.
 *
 * Coordinate frame is lid-local (see `lidConstants.ts`, Z=0 is the top surface):
 *   Z = 0                        top of the lid floor (the visible closed face)
 *   Z = -(depth + ceiling) = Zi  boss bottom / magnet mating face
 * The whole boss + magnet stay at or below Z=0, so the top face is flush — no
 * bumps poke through it. The boss sits INBOARD of the lip (see
 * `retentionMagnetInset`) so it drops into the bin mouth without fouling the
 * lip, welding to the floor plate above it. Placement XY is shared with the bin
 * via `retentionMagnetPositions`, keeping the magnets coaxial.
 */

import { cylinder, unwrap, fuse, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
} from './retentionMagnetGeometry';
import type { LidInputs } from './lidInputs';

export function addLidRetentionMagnets(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const {
    cellsX,
    cellsY,
    gridUnitMm,
    gridUnitMmY,
    retentionMagnetDiameter,
    retentionMagnetDepth,
    topThickness,
  } = inputs;

  const magnetRadius = retentionMagnetDiameter / 2;
  const bossRadius = retentionBossRadius(retentionMagnetDiameter);
  const inset = retentionMagnetInset(retentionMagnetDiameter);
  const positions = retentionMagnetPositions(cellsX, cellsY, gridUnitMm, gridUnitMmY, inset);

  // The magnet sits directly under the floor plate: its top face is the floor
  // underside (Z = -topThickness), so the solid floor (>= LID_MAGNET_CEILING
  // thick) hides it — the top surface stays perfectly smooth, no bumps or
  // crease circles. The boss hangs BELOW the floor into the mating cavity to
  // house the rest of the magnet, welding up into the floor by a coplanar
  // margin. `interfaceZ` (magnet mating face) is what the bin gusset mates with.
  const magnetTopZ = -topThickness;
  const interfaceZ = magnetTopZ - retentionMagnetDepth;
  const bossTopZ = magnetTopZ + LID_COPLANAR_MARGIN; // weld up into the floor
  const bossHeight = bossTopZ - interfaceZ;

  // 1. Fuse the four bosses onto the floor (welds along the floor plate).
  let result = body;
  for (const [px, py] of positions) {
    const boss = scope.register(
      cylinder(bossRadius, bossHeight, { at: [px, py, interfaceZ], axis: [0, 0, 1] })
    );
    if (originToTag) {
      collectOrigins(boss, FeatureTag.LID_BODY, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, boss));
  }

  // 2. Cut the downward-opening pockets in one batched pass. The cutter starts
  //    `LID_COPLANAR_MARGIN` below the interface so it bites cleanly through the
  //    open (downward) face, and rises by the magnet depth (leaving the ceiling).
  const cutterZ = interfaceZ - LID_COPLANAR_MARGIN;
  const cutterHeight = retentionMagnetDepth + LID_COPLANAR_MARGIN;
  const cutters: Shape3D[] = [];
  for (const [px, py] of positions) {
    // Place the cutter directly at the magnet position — avoids a `translate`
    // that would leave the pre-translation cylinder as an unreleased WASM handle.
    cutters.push(
      scope.register(
        cylinder(magnetRadius, cutterHeight, { at: [px, py, cutterZ], axis: [0, 0, 1] })
      )
    );
  }

  scope.register(result);
  return unwrap(cutAll(result as ValidSolid, cutters as ValidSolid[]));
}
