/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection via computeTessellationTolerances().
 *
 * LOD infrastructure (coarseMesh, CoarseLODData, BinMesh Detailed) is wired
 * through the pipeline but not yet activated here — meshMultiLOD doubles
 * tessellation cost. Enable by setting coarseMesh in the return value.
 */

import { mesh, meshEdges } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { toIndexedMeshData } from '../../utils/mesh';
import { computeTessellationTolerances } from '../../utils/tolerances';
import { setLastSolid } from '../../shapeCache';

export const tessellateStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.9,

  shouldRun(): boolean {
    return true;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { solid, dimensions: dim, forExport } = ctx;
    if (!solid) return ctx;

    setLastSolid(solid);

    const { tolerance, angularTolerance } = computeTessellationTolerances(
      forExport,
      dim.hasLip,
      dim.maxDimension
    );

    const shapeMesh = mesh(solid, { tolerance, angularTolerance });
    const edgeMesh = meshEdges(solid, {
      tolerance,
      angularTolerance: angularTolerance * 0.5,
    });
    ctx.onProgress?.('merge', 1.0);
    const meshData = toIndexedMeshData(shapeMesh, edgeMesh.lines, ctx.originToTag);
    return { ...ctx, mesh: meshData, coarseMesh: null, solid: null };
  },
};
