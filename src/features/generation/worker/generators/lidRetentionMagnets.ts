/**
 * Lid-side retention magnets (issue #2694).
 *
 * Fuses a corner boss into each of the lid's four corners, hanging DOWN from
 * the floor into the mating cavity, and cuts a blind pocket that opens downward
 * so the magnet's pole face meets the bin gusset's magnet across a thin gap.
 *
 * Coordinate frame is lid-local (see `lidConstants.ts`, Z=0 is the top surface):
 *   Z = 0                    top of the lid floor (the visible closed face)
 *   Z = -topThickness        floor underside; the boss welds up into it
 *   Z = retentionInterfaceZ  boss bottom / magnet mating face, below the skirt
 *   Z = interfaceZ + depth   magnet TOP (the pocket's ceiling)
 * The whole boss + magnet stay below Z=0, so the top face is flush — no bumps or
 * crease circles. The boss sits INBOARD of the lip (see `retentionMagnetInset`)
 * so it drops into the bin mouth without fouling the lip. Placement XY is shared
 * with the bin via `retentionMagnetPositions` and Z via `retentionInterfaceZ`,
 * keeping the magnets coaxial and one seat gap apart.
 */

import { cylinder, unwrap, fuse, cutAll } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import {
  retentionBossRadius,
  retentionInterfaceZ,
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
    retentionMagnetEdgeMagnets,
    topThickness,
    outerOffsetX,
    outerOffsetY,
    overhangAddW,
    overhangAddD,
  } = inputs;

  const magnetRadius = retentionMagnetDiameter / 2;
  const bossRadius = retentionBossRadius(retentionMagnetDiameter);
  const inset = retentionMagnetInset(retentionMagnetDiameter);
  // Same placement as the bin pads (edge magnets included), so every lid boss
  // lands coaxial with its mating bin post — overhang expansion included, since
  // both sides inset from the same overhang-shifted footprint (#3048).
  const positions = retentionMagnetPositions(
    cellsX,
    cellsY,
    gridUnitMm,
    gridUnitMmY,
    inset,
    retentionMagnetEdgeMagnets,
    bossRadius,
    { addW: overhangAddW, addD: overhangAddD, offsetX: outerOffsetX, offsetY: outerOffsetY }
  );

  // The boss is anchored to the BOTTOM of the cavity, not to the floor plate,
  // and reaches past the mating skirt so the bin's pad can pass under it —
  // `retentionInterfaceZ` owns both bounds, and the bin's pad reads the same
  // helper, so the pair cannot drift.
  //
  // The pocket is still only `retentionMagnetDepth` deep at the tip, so the
  // rest of the pillar is solid. It prints as a vertical column (the lid
  // exports floor-down, bosses up), needing no supports.
  const interfaceZ = retentionInterfaceZ(inputs);
  // Weld up into the floor plate by a coplanar margin so the fuse is solid.
  const bossTopZ = -topThickness + LID_COPLANAR_MARGIN;
  const bossHeight = bossTopZ - interfaceZ;

  // 1. Fuse every boss onto the floor (welds along the floor plate). Four
  // corners, plus any mid-edge magnets.
  let result = body;
  for (const { x: px, y: py } of positions) {
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
  for (const { x: px, y: py } of positions) {
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
