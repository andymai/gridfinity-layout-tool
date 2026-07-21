/**
 * Lid-side retention magnets (issue #2694).
 *
 * Fuses a corner boss into each of the lid's four corners, hanging from the
 * floor down to the seated interface (the bin's lip-top plane, at lid-local
 * `anchorZ`), then cuts a blind pocket that opens DOWNWARD so the magnet's
 * pole face meets the bin post's magnet across a thin seat gap.
 *
 * Coordinate frame is lid-local (see `lidConstants.ts`):
 *   Z = 0            top of the lid floor
 *   Z = anchorZ      the seated interface (bin lip top maps here)
 * The boss bottom sits `LID_MAGNET_SEAT_GAP` above `anchorZ` so the four posts
 * don't bottom out and lift the lid off its lip.
 *
 * Placement XY is shared with the bin via `retentionMagnetPositions`, so the
 * lid holes always line up with the bin's posts.
 */

import { cylinder, unwrap, fuse, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_COPLANAR_MARGIN, LID_MAGNET_CEILING, LID_MAGNET_SEAT_GAP } from './lidConstants';
import { retentionBossRadius, retentionMagnetPositions } from './retentionMagnetGeometry';
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
    anchorZ,
  } = inputs;

  const magnetRadius = retentionMagnetDiameter / 2;
  const bossRadius = retentionBossRadius(retentionMagnetDiameter);
  const positions = retentionMagnetPositions(cellsX, cellsY, gridUnitMm, gridUnitMmY, bossRadius);

  // Boss bottom sits a hair above the interface; the magnet pocket opens there
  // and extends up. Boss top clears the pocket plus a sealed ceiling — reaching
  // at least Z=0 so it always welds to the full floor plate (a small bump above
  // 0 for deep magnets is acceptable and matches typical corner-holder lids).
  const bossBottomZ = anchorZ + LID_MAGNET_SEAT_GAP;
  const pocketTopZ = bossBottomZ + retentionMagnetDepth;
  const bossTopZ = Math.max(0, pocketTopZ + LID_MAGNET_CEILING);
  const bossHeight = bossTopZ - bossBottomZ;

  // 1. Fuse the four bosses onto the floor (welds along the floor plate).
  let result = body;
  for (const [px, py] of positions) {
    const boss = scope.register(
      cylinder(bossRadius, bossHeight, { at: [px, py, bossBottomZ], axis: [0, 0, 1] })
    );
    if (originToTag) {
      collectOrigins(boss, FeatureTag.LID_BODY, originToTag);
    }
    scope.register(result);
    result = unwrap(fuse(result, boss));
  }

  // 2. Cut the downward-opening pockets in one batched pass. The cutter starts
  //    `LID_COPLANAR_MARGIN` below the boss bottom so it bites cleanly through
  //    the open (downward) face, and rises by the magnet depth.
  const cutterZ = bossBottomZ - LID_COPLANAR_MARGIN;
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
