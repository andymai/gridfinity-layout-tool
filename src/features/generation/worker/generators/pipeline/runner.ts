/**
 * Pipeline runner — iterates stages, checks cancellation, reports progress.
 *
 * When `ctx.perfCollector` is set, each stage's wall-clock duration is
 * recorded for the dev PerfOverlay. The `performance.now()` overhead is
 * ~microseconds; the branch elides when the collector is absent (tests +
 * bench).
 */

import { checkCancelled } from '../meshUtils';
import type { PipelineContext, PipelineStage } from './types';

export function runPipeline(
  stages: readonly PipelineStage[],
  initialContext: PipelineContext
): PipelineContext {
  let ctx = initialContext;
  const perf = ctx.perfCollector;

  for (const stage of stages) {
    if (!stage.shouldRun(ctx)) continue;
    checkCancelled(ctx.signal);
    ctx.onProgress?.(stage.name, stage.progressValue);
    const start = perf ? performance.now() : 0;
    ctx = stage.execute(ctx);
    if (perf) perf.recordStage(stage.name, performance.now() - start);
  }

  return ctx;
}
