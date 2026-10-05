/**
 * Lid fill — a plug filling the lid's hollow down to its mating edge,
 * just above the divider tops, so small parts cannot hop between compartments
 * with the lid on.
 *
 * One prism, from that edge up into the floor plate, overlapping the mating
 * shell's inner wall so both welds are volumetric. On a magnetic lid the edge
 * is the bosses' face, which clears the bin's pads by a seat gap; the bosses
 * fuse after the plug so their pockets still cut into them.
 */

import { unwrap, fuse } from 'brepjs';
import type { Shape3D, DisposalScope } from 'brepjs';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs, LidFillInputs } from './lidInputs';

export function addLidFill(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  fill: LidFillInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const topZ = -inputs.topThickness + LID_COPLANAR_MARGIN;
  const plug = scope.register(
    buildOutlineDrawing(inputs, fill.outlineInset)
      .sketchOnPlane('XY', fill.bottomZ)
      .extrude(topZ - fill.bottomZ)
  );
  if (originToTag) collectOrigins(plug, FeatureTag.LID_BODY, originToTag);
  scope.register(body);
  return unwrap(fuse(body, plug));
}
