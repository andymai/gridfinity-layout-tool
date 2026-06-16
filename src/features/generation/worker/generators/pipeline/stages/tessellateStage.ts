/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection via computeTessellationTolerances().
 *
 * LOD infrastructure (coarseMesh, CoarseLODData, BinMesh Detailed) is wired
 * through the pipeline but not yet activated here — meshMultiLOD doubles
 * tessellation cost. Enable by setting coarseMesh in the return value.
 */

import { mesh, meshEdges, getKernelCapabilities, unwrap, fuse } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { toIndexedMeshData, mergeShapeMeshes, concatFloat32 } from '../../utils/mesh';
import { creaseEdges } from '../../utils';
import { computeTessellationTolerances } from '../../utils/tolerances';
import { setLastSolid } from '../../shapeCache';
import { getSocketMesh, setSocketMesh, socketMeshKey } from '../../socketMeshCache';
import { keepOuterShell } from '../../utils/outerShell';

export const tessellateStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.9,

  shouldRun(): boolean {
    return true;
  },

  execute(ctx: PipelineContext): PipelineContext {
    let rawSolid = ctx.solid;
    const { dimensions: dim, forExport } = ctx;
    if (!rawSolid) return ctx;

    // EXPORT: fuse the deferred base socket into the featured body for a single
    // watertight solid. The socket is deferred past the feature stage (see
    // shellStage) so feature fuses run on the socket-less body — fusing it
    // earlier made additive features like the label bracket non-manifold
    // (GH #2085). On failure, leave the socket deferred so the separate-mesh
    // path below still produces a complete (if seam-split) export rather than
    // throwing. PREVIEW keeps the socket deferred and meshes it separately.
    if (forExport && ctx.deferredSolid) {
      try {
        const fused = unwrap(fuse(rawSolid, ctx.deferredSolid));
        rawSolid.delete();
        ctx.deferredSolid.delete();
        rawSolid = fused;
        ctx = { ...ctx, solid: fused, deferredSolid: null };
      } catch {
        // Fuse failed — fall through with the socket still deferred.
      }
    }

    // Additive feature fuses can leave interior void shells inside an otherwise
    // valid export solid; STL tessellates them as doubled (non-manifold) faces.
    // Collapse to the single outer shell so the exported mesh is watertight.
    // Export only — the preview path meshes the body and deferred socket
    // separately and never feeds this solid to an exporter.
    const solid = forExport ? keepOuterShell(rawSolid) : rawSolid;
    if (solid !== rawSolid) rawSolid.delete();

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

    // Socket still deferred — the preview path (which skips the expensive
    // socket↔body fuse) or an export whose fuse failed above. Tessellate it
    // separately and concatenate: the socket is never feature-cut and only
    // meets the body at a hidden interface, so the merged mesh is visually
    // identical to the fused shell (though not watertight at the seam).
    const { deferredSolid, deferredSolidKey } = ctx;
    if (deferredSolid) {
      try {
        // Reuse the socket's mesh across edits that don't change its geometry or
        // the tessellation tolerance — the dominant case during interactive
        // design, where the body's features change but the base does not. A null
        // key (lightweight base) always re-meshes.
        const cacheKey = deferredSolidKey
          ? socketMeshKey(deferredSolidKey, tolerance, angularTolerance, buildTime)
          : null;
        let cached = cacheKey ? getSocketMesh(cacheKey) : null;
        if (!cached) {
          const socketMesh = mesh(deferredSolid, { tolerance, angularTolerance });
          const socketEdges = buildTime
            ? creaseEdges(socketMesh)
            : meshEdges(deferredSolid, { tolerance, angularTolerance: edgeAngular }).lines;
          cached = { mesh: socketMesh, edgeLines: socketEdges };
          if (cacheKey) setSocketMesh(cacheKey, cached);
        }
        shapeMesh = mergeShapeMeshes(shapeMesh, cached.mesh);
        edgeLines = concatFloat32(edgeLines, cached.edgeLines);
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
