/** Close a lid-compatible base at the bed instead of bridging its whole mouth.
 * All coordinates are lid-local: the bin body begins at Z=0. */
import { cut, fuse, intersect, translate, unwrap } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import type { LidInputs } from './lidInputs';
import { buildOutlineDrawing } from './lidProfile';
import { LIP_BIG_TAPER } from './generatorConstants';
import {
  buildCompartmentCavityDrawings,
  buildCompartmentWalls,
  compartmentsAreRectangular,
} from './compartmentBuilder';

export function addStackingFloor(
  scope: DisposalScope,
  skirt: Shape3D,
  body: Shape3D,
  inputs: LidInputs,
  ctx: PipelineContext
): Shape3D {
  const { dimensions: dim, params } = ctx;
  const bottom = -dim.baseOffsetZ;
  // Fill the tapered plug before hollowing it. This also leaves material under
  // divider walls, so no part of their floor has to bridge the box's width.
  const fill = scope.register(
    buildOutlineDrawing(inputs, LIP_BIG_TAPER + inputs.mateRelief)
      .sketchOnPlane('XY', bottom)
      .extrude(dim.baseOffsetZ + 0.01)
  );
  let local = scope.register(unwrap(fuse(skirt as ValidSolid, fill as ValidSolid)));
  const localBody = scope.register(translate(body, [0, 0, -dim.baseOffsetZ]));
  local = scope.register(unwrap(fuse(local, localBody as ValidSolid)));

  if (!dim.solid) {
    const start = bottom + dim.floorThickness;
    const depth = dim.floorThickness + 0.02 - start;
    const mouth = scope.register(
      buildOutlineDrawing(inputs, inputs.cavityInset).sketchOnPlane('XY', start).extrude(depth)
    );
    // Rectangular compartment cavities leave their dividers supported to the bed.
    if (compartmentsAreRectangular(params)) {
      for (const drawing of buildCompartmentCavityDrawings(params, dim.innerW, dim.innerD)) {
        const cavity = scope.register(
          drawing
            .translate(dim.innerOffsetX, dim.innerOffsetY)
            .sketchOnPlane('XY', start)
            .extrude(depth)
        );
        const tool = scope.register(unwrap(intersect(mouth, cavity)));
        local = scope.register(unwrap(cut(local, tool as ValidSolid)));
      }
    } else {
      // Merged compartments use wall segments instead of rectangular cavities.
      // Subtract their supports from the opening tool, not from the floor.
      const walls = buildCompartmentWalls(params, dim.innerW, dim.innerD, depth);
      let tool: Shape3D = mouth;
      if (walls) {
        scope.register(walls);
        const supports = scope.register(
          translate(walls, [dim.innerOffsetX, dim.innerOffsetY, start])
        );
        tool = scope.register(unwrap(cut(mouth as ValidSolid, supports as ValidSolid)));
      }
      local = scope.register(unwrap(cut(local, tool as ValidSolid)));
    }
  }
  return local;
}
