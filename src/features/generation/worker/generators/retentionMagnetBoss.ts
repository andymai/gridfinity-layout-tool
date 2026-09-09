/** Wall-supported corner boss for lids and Nesting bodies, in lid-local coordinates. */
import { draw, intersect, unwrap } from 'brepjs';
import type { DisposalScope, Shape3D } from 'brepjs';
import type { LidInputs } from './lidInputs';
import { buildOutlineDrawing } from './lidProfile';
import { LID_COPLANAR_MARGIN } from './lidConstants';

/** Straight wall tangents with only the cavity-facing corner rounded.
 * Clipping the outward corner to the mating shell keeps thin walls and the
 * stacking taper intact, including on an overhang-shifted footprint. */
export function buildRetentionMagnetBoss(
  scope: DisposalScope,
  inputs: LidInputs,
  x: number,
  y: number,
  radius: number,
  bottom: number,
  height: number
): Shape3D {
  const sx = Math.sign(x - inputs.outerOffsetX);
  const sy = Math.sign(y - inputs.outerOffsetY);
  const wallInset = inputs.cavityInset - LID_COPLANAR_MARGIN;
  const wallX = inputs.outerOffsetX + sx * (inputs.lidOuterW / 2 - wallInset);
  const wallY = inputs.outerOffsetY + sy * (inputs.lidOuterD / 2 - wallInset);
  const innerX = x - sx * radius;
  const innerY = y - sy * radius;
  const sagitta = -radius * (1 - Math.SQRT1_2);
  // Both traversals are counterclockwise; mirroring one path would reverse
  // the normals on two of the four corners.
  const footprint =
    sx * sy > 0
      ? draw([wallX, wallY])
          .lineTo([innerX, wallY])
          .lineTo([innerX, y])
          .sagittaArcTo([x, innerY], sagitta)
          .lineTo([wallX, innerY])
          .close()
      : draw([wallX, wallY])
          .lineTo([wallX, innerY])
          .lineTo([x, innerY])
          .sagittaArcTo([innerX, y], sagitta)
          .lineTo([innerX, wallY])
          .close();
  const boss = scope.register(footprint.sketchOnPlane('XY', bottom).extrude(height));
  const envelope = scope.register(
    buildOutlineDrawing(inputs, wallInset).sketchOnPlane('XY', bottom).extrude(height)
  );
  return unwrap(intersect(boss, envelope));
}
