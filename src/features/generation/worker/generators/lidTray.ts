/**
 * Tray-top recess for the lid.
 *
 * Shells a shallow, rim-bounded tray into the lid's top face so small items
 * rest on the closed lid without sliding off. Only used when the lid is not
 * stackable (a stack grid owns the top otherwise) — `resolveLidInputs`
 * enforces that, so this builder trusts `inputs.tray.enabled`.
 *
 * The recess is the lid outline inset by the rim wall, cut downward from the
 * top face (Z=0) by the tray depth. `resolveLidPlateThickness` grows the plate so
 * the recess never breaks through into the mating cavity below.
 */

import { unwrap, cut } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';

export function cutTrayRecess(scope: DisposalScope, body: Shape3D, inputs: LidInputs): Shape3D {
  const { depthMm, wallMm } = inputs.tray;

  // Recess footprint = lid outline inset by the rim wall. Extruded from just
  // below the recess floor up past the top face so the cut bites cleanly.
  const recess = scope.register(
    buildOutlineDrawing(inputs, wallMm)
      .sketchOnPlane('XY', -depthMm)
      .extrude(depthMm + LID_COPLANAR_MARGIN)
  );

  scope.register(body);
  return unwrap(cut(body as ValidSolid, recess as ValidSolid));
}
