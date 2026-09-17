/**
 * Merge stage — concatenates the deferred socket's mesh onto the body mesh.
 *
 * Runs LAST so the mesh imprint sees the body alone: see
 * `PipelineContext.deferredMesh`. Shares the tessellate stage's `merge` name
 * so progress and perf reporting see one merge bucket.
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
