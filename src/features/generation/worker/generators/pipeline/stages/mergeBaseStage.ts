/**
 * Merge stage — concatenates the deferred socket's mesh onto the body mesh.
 *
 * Runs LAST so the mesh imprint sees the body alone: see
 * `PipelineContext.deferredMesh`. Same `merge` name as the tessellate stage,
 * since this is the concatenation that used to live there.
 */

import type { PipelineContext, PipelineStage } from '../types';
import { mergeMeshData } from '../../utils/mesh';

export const mergeBaseStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.99,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.deferredMesh !== null;
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.mesh || !ctx.deferredMesh) return ctx;
    return { ...ctx, mesh: mergeMeshData(ctx.mesh, ctx.deferredMesh), deferredMesh: null };
  },
};
