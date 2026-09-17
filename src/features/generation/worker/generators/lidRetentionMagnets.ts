/**
 * Lid-side retention magnets.
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

import { cylinder, unwrap, fuse, cutAll, translate } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import { magnetChamferFits } from '@/shared/generation/magnetHoleStyle';
import { buildMagnetHoleCutter } from './magnetHoleCutter';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import {
  retentionBossRadius,
  retentionBossFaceZ,
  retentionInterfaceZ,
  retentionMagnetInset,
  retentionMagnetPositions,
  retentionMagnetPlacementsFor,
} from './retentionMagnetGeometry';
import type { LidInputs } from './lidInputs';
import { buildRetentionMagnetBoss } from './retentionMagnetBoss';

export function addLidRetentionMagnets(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>,
  wallSupportedCorners = false
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
  // both sides inset from the same overhang-shifted footprint.
  const allPositions = retentionMagnetPositions(
    cellsX,
    cellsY,
    gridUnitMm,
    gridUnitMmY,
    inset,
    retentionMagnetEdgeMagnets,
    bossRadius,
    { addW: overhangAddW, addD: overhangAddD, offsetX: outerOffsetX, offsetY: outerOffsetY }
  );
  // Filtered through the SAME call the bin's pads make, so the two halves of
  // the joint cannot land on different walls. A magnetic lid keeps all four
  // corners; a hinged lid's magnet catch keeps only the free edge's pair.
  const positions = retentionMagnetPlacementsFor(
    inputs.retentionMagnetSide,
    allPositions,
    outerOffsetX,
    outerOffsetY
  );

  // The boss is anchored to the BOTTOM of the cavity, not to the floor plate,
  // and reaches past the mating skirt so the bin's pad can pass under it —
  // `retentionInterfaceZ` owns both bounds, and the bin's pad reads the same
  // helper, so the pair cannot drift.
  //
  // The pocket is still only `retentionMagnetDepth` deep at the tip, so the
  // rest of the pillar is solid. It prints as a vertical column (the lid
  // exports floor-down, bosses up), needing no supports.
  // A seated lid drops `mateRelief * √2` onto the lip, so its boss is built one
  // settle high (`retentionBossFaceZ`) to land at the right gap. A tray bottom is
  // anchored to the bed and never takes that drop; its boss stays on the nominal
  // plane, matching the skirt `trayBottomSkirtDepth` sizes off `retentionInterfaceZ`.
  const interfaceZ = inputs.floorAtBed ? retentionInterfaceZ(inputs) : retentionBossFaceZ(inputs);
  // Weld up into the floor plate by a coplanar margin so the fuse is solid.
  const bossTopZ = -topThickness + LID_COPLANAR_MARGIN;
  const bossHeight = bossTopZ - interfaceZ;

  // 1. Fuse every boss onto the floor (welds along the floor plate). Four
  // corners, plus any mid-edge magnets.
  let result = body;
  for (const { x: px, y: py, anchor } of positions) {
    const boss = scope.register(
      wallSupportedCorners && anchor === 'corner'
        ? buildRetentionMagnetBoss(scope, inputs, px, py, bossRadius, interfaceZ, bossHeight)
        : cylinder(bossRadius, bossHeight, { at: [px, py, interfaceZ], axis: [0, 0, 1] })
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
  // The boss wall is all the solid around this bore, so the chamfer only
  // opens when it can leave that wall standing; the ribs always apply.
  const style: MagnetHoleStyle = {
    crushRibs: inputs.magnetHoleStyle.crushRibs,
    chamfer: inputs.magnetHoleStyle.chamfer && magnetChamferFits(bossRadius - magnetRadius),
  };
  const cutters: Shape3D[] = [];
  for (const { x: px, y: py } of positions) {
    const cutter = scope.register(
      buildMagnetHoleCutter({
        radius: magnetRadius,
        height: cutterHeight,
        style,
        mouth: { end: 'bottom', inset: LID_COPLANAR_MARGIN },
      })
    );
    cutters.push(scope.register(translate(cutter, [px, py, cutterZ])));
  }

  scope.register(result);
  return unwrap(cutAll(result as ValidSolid, cutters as ValidSolid[]));
}
