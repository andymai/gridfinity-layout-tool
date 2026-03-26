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

/** Coarse tolerance multiplier for LOD mesh generation. */
const LOD_COARSE_TOLERANCE_FACTOR = 4;

/** Skip LOD for bins larger than this (mm) — tessellation cost outweighs LOD benefit. */
const LOD_MAX_DIMENSION = 250;

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

    // LOD only for small/medium preview bins — large bins already use coarse
    // tolerances and the extra mesh call would exceed performance budgets.
    const generateLOD = !forExport && dim.maxDimension <= LOD_MAX_DIMENSION;

    if (generateLOD) {
      // Preview with LOD: generate coarse + fine meshes via meshMultiLOD.
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
    }

    // Single mesh: export mode or large preview bins
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
