/**
 * Mesh imprint stage — subtracts imported STL tools from the tessellated bin
 * as contoured pockets. Runs after tessellateStage in the mesh domain (raw
 * manifold-3d), so it works identically for draft and exact quality.
 *
 * Requires the async `prepareMeshImprints()` pre-pass (worker handlers await
 * it before generation); without prepared tools the stage is a safe no-op.
 */

import type { PipelineContext, PipelineStage } from '../types';
import { applyMeshImprints, hasMeshImprints } from '../../meshImprint';
import { checkCancelled } from '../../utils/abort';

export const meshImprintStage: PipelineStage = {
  // Distinct name (like booleanStage's 'boolean') so the perf breakdown gets
  // its own row instead of folding into the translate/tessellate 'merge' bucket.
  name: 'meshImprint',
  progressValue: 0.98,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.dimensions.solid && hasMeshImprints(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.mesh) return ctx;
    checkCancelled(ctx.signal);
    return { ...ctx, mesh: applyMeshImprints(ctx.mesh, ctx.params, ctx.dimensions) };
  },
};
