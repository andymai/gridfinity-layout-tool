/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection via computeTessellationTolerances().
 * In preview mode, generates both fine (primary) and coarse (LOD) meshes
 * via meshMultiLOD for distance-based rendering in the Three.js scene.
 */

import { mesh, meshEdges, meshMultiLOD } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { toIndexedMeshData } from '../../utils/mesh';
import { computeTessellationTolerances } from '../../utils/tolerances';
import { setLastSolid } from '../../shapeCache';

/** Camera distance (mm) beyond which the coarse LOD mesh is used. */
const LOD_COARSE_TOLERANCE_FACTOR = 4;

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

    if (forExport) {
      // Export: single high-quality mesh, no LOD
      const shapeMesh = mesh(solid, { tolerance, angularTolerance });
      const edgeMesh = meshEdges(solid, {
        tolerance,
        angularTolerance: angularTolerance * 0.5,
      });
      ctx.onProgress?.('merge', 1.0);
      const meshData = toIndexedMeshData(shapeMesh, edgeMesh.lines, ctx.originToTag);
      return { ...ctx, mesh: meshData, coarseMesh: null, solid: null };
    }

    // Preview: generate coarse + fine LOD meshes in one call.
    // meshMultiLOD applies angularTolerance * 0.2 to the fine mesh internally,
    // so we scale up by 5× to match our target fine angular tolerance.
    const lod = meshMultiLOD(solid, {
      coarseTolerance: Math.min(tolerance * LOD_COARSE_TOLERANCE_FACTOR, 1.0),
      fineTolerance: tolerance,
      angularTolerance: angularTolerance * 5,
    });

    const edgeMesh = meshEdges(solid, {
      tolerance,
      angularTolerance: angularTolerance * 0.5,
    });
    ctx.onProgress?.('merge', 1.0);

    const meshData = toIndexedMeshData(lod.fine, edgeMesh.lines, ctx.originToTag);
    const coarseMeshData = toIndexedMeshData(lod.coarse);

    return { ...ctx, mesh: meshData, coarseMesh: coarseMeshData, solid: null };
  },
};
