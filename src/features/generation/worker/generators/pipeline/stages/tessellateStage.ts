/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection via computeTessellationTolerances().
 *
 * LOD infrastructure (coarseMesh, CoarseLODData, BinMesh Detailed) is wired
 * through the pipeline but not yet activated here — meshMultiLOD doubles
 * tessellation cost. Enable by setting coarseMesh in the return value.
 */

import { mesh, meshEdges, getKernelCapabilities } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { toIndexedMeshData, mergeShapeMeshes, concatFloat32 } from '../../utils/mesh';
import { creaseEdges } from '../../utils';
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

    setLastSolid(solid, forExport);

    const { tolerance, angularTolerance } = computeTessellationTolerances(
      forExport,
      dim.hasLip,
      dim.maxDimension
    );

    const edgeAngular = angularTolerance * 0.5;
    let shapeMesh = mesh(solid, { tolerance, angularTolerance });

    // Build-time kernels (manifold draft) have no B-rep topology, so their
    // meshEdges() returns the full triangle wireframe. Recover clean feature
    // edges from the mesh via dihedral crease detection. Extract-time kernels
    // (occt) keep their native analytic edge extractor.
    const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
    let edgeLines: ArrayLike<number> = buildTime
      ? creaseEdges(shapeMesh)
      : meshEdges(solid, { tolerance, angularTolerance: edgeAngular }).lines;

    // Preview path: the base socket is kept out of `solid` to skip the
    // expensive socket↔body fuse. Tessellate it separately and concatenate —
    // the socket is never feature-cut and only meets the body at a hidden
    // interface, so the merged mesh is visually identical to the fused shell.
    const { deferredSolid } = ctx;
    if (deferredSolid) {
      try {
        const socketMesh = mesh(deferredSolid, { tolerance, angularTolerance });
        shapeMesh = mergeShapeMeshes(shapeMesh, socketMesh);
        const socketEdges = buildTime
          ? creaseEdges(socketMesh)
          : meshEdges(deferredSolid, { tolerance, angularTolerance: edgeAngular }).lines;
        edgeLines = concatFloat32(edgeLines, socketEdges);
      } finally {
        // Dispose even if mesh/meshEdges throws, so the WASM handle never leaks.
        deferredSolid.delete();
      }
    }

    ctx.onProgress?.('merge', 1.0);
    const meshData = toIndexedMeshData(shapeMesh, edgeLines, ctx.originToTag);
    return { ...ctx, mesh: meshData, coarseMesh: null, solid: null, deferredSolid: null };
  },
};
