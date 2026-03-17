/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection:
 * - Export: fine tessellation (0.01mm tolerance)
 * - Lip bins: tight tolerance to preserve chamfer profile at corner junctions
 * - Small bins: moderate quality
 * - Large bins: coarser tessellation for speed
 */

import { mesh, meshEdges } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { toIndexedMeshData } from '../../meshUtils';
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

    let tolerance: number;
    let angularTolerance: number;

    if (forExport) {
      tolerance = 0.01;
      angularTolerance = 5;
    } else if (dim.hasLip) {
      tolerance = Math.min(0.1, Math.max(0.05, dim.maxDimension / 2500));
      angularTolerance = 10;
    } else if (dim.maxDimension <= 200) {
      tolerance = Math.min(0.4, Math.max(0.15, dim.maxDimension / 600));
      angularTolerance = 12;
    } else {
      tolerance = Math.min(1.0, Math.max(0.3, dim.maxDimension / 300));
      angularTolerance = 25;
    }

    const shapeMesh = mesh(solid, { tolerance, angularTolerance });
    const edgeMesh = meshEdges(solid, { tolerance, angularTolerance });
    const edgeVertices = new Float32Array(edgeMesh.lines);

    ctx.onProgress?.('merge', 1.0);
    const meshData = toIndexedMeshData(
      shapeMesh,
      !dim.useHighQuality,
      edgeVertices,
      ctx.originToTag
    );

    return { ...ctx, mesh: meshData, solid: null };
  },
};
