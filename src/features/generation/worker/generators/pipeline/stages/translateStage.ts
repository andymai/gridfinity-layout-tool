/**
 * Translate stage — offsets bin so Z=0 = absolute bottom.
 *
 * Socket-based bins are built with Z=0 at the floor (socket top).
 * This stage shifts them up by the resolved socket depth so Z=0 = socket bottom
 * (standard 5mm, or less under a low-profile layout).
 * Flat floor bins are already at Z=0 and skip this stage.
 */

import { translate } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';

export const translateStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.8,

  shouldRun(ctx: PipelineContext): boolean {
    return !ctx.dimensions.isFlat;
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    const socketH = ctx.dimensions.socketHeightMm;
    const newSolid = translate(ctx.solid, [0, 0, socketH]);
    ctx.solid.delete();
    // Shift the deferred socket (preview path) by the same offset so it stays
    // aligned with the body.
    let newDeferred = ctx.deferredSolid;
    if (ctx.deferredSolid) {
      newDeferred = translate(ctx.deferredSolid, [0, 0, socketH]);
      ctx.deferredSolid.delete();
    }
    return { ...ctx, solid: newSolid, deferredSolid: newDeferred };
  },
};
