/**
 * Pipeline runner — iterates stages, checks cancellation, reports progress.
 */

import { checkCancelled } from '../meshUtils';
import type { PipelineContext, PipelineStage } from './types';

/**
 * Run pipeline stages sequentially, threading context through each.
 * Stages that return shouldRun=false are skipped.
 */
export function runPipeline(
  stages: readonly PipelineStage[],
  initialContext: PipelineContext
): PipelineContext {
  let ctx = initialContext;

  for (const stage of stages) {
    if (!stage.shouldRun(ctx)) continue;
    checkCancelled(ctx.signal);
    ctx.onProgress?.(stage.name, stage.progressValue);
    ctx = stage.execute(ctx);
  }

  return ctx;
}
