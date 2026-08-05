/**
 * Translate stage — offsets bin so Z=0 = absolute bottom.
 *
 * Bins are built with Z=0 at the floor bottom, so anything that sits UNDER the
 * floor — a Gridfinity socket, or a tray bin's lid skirt (#3036) — would hang
 * below the bed. This stage lifts by `dimensions.baseOffsetZ`, the depth of
 * whatever that is. Flat bins have nothing underneath and skip the stage.
 */

import { translate } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';

export const translateStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.8,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.dimensions.baseOffsetZ > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    const offset = ctx.dimensions.baseOffsetZ;
    const newSolid = translate(ctx.solid, [0, 0, offset]);
    ctx.solid.delete();
    // Shift the deferred socket (preview path) by the same offset so it stays
    // aligned with the body.
    let newDeferred = ctx.deferredSolid;
    if (ctx.deferredSolid) {
      newDeferred = translate(ctx.deferredSolid, [0, 0, offset]);
      ctx.deferredSolid.delete();
    }
    return { ...ctx, solid: newSolid, deferredSolid: newDeferred };
  },
};
