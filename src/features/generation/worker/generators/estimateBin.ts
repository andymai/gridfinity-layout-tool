/**
 * Cheap cost prediction for the next bin generation, answered by the worker
 * that owns the shape caches — the dominant cost factor is which pipeline
 * stages will be cache hits, and only this worker knows that.
 *
 * The estimate combines two worker-local signals:
 *  - per-stage durations observed on the most recent real generation, and
 *  - non-cloning cache probes (shell key + every enabled feature builder key)
 *    for the requested params.
 *
 * Returns `null` when there is no timing history yet (cold start) or any probe
 * throws — callers must treat unknown as slow. The single-threaded worker also
 * means an ESTIMATE queued behind an in-flight generation is answered late;
 * the bridge treats a timeout the same way, which is self-consistent: a busy
 * worker means generations are outpacing edits, i.e. things ARE slow.
 */

import type { BinParams } from '@/shared/types/bin';
import type { PerfSnapshot } from '../../bridge/types';
import { createInitialContext } from './pipeline/context';
import { BIN_FEATURE_BUILDERS } from './pipeline/featureComposition';
import { hasShellCache, hasFeatureCache } from './shapeCache';

const lastStageMs = new Map<string, number>();

/** Record per-stage durations from a completed generation's perf snapshot. */
export function recordCompletedGeneration(snapshot: PerfSnapshot): void {
  // Baseplate generation bypasses the pipeline and produces an empty stage
  // list — recording it would wipe the bin-stage history.
  if (snapshot.stages.length === 0) return;
  for (const s of snapshot.stages) lastStageMs.set(s.name, s.ms);
}

/** Predicted duration (ms) of generating `params` now, or null when unknown. */
export function estimateBinGeneration(params: BinParams): number | null {
  const base = lastStageMs.get('base');
  if (base === undefined) return null;

  try {
    const ctx = createInitialContext(params);
    const shellHit = hasShellCache(ctx.dimensions.shellKey);
    // The wall pattern runs outside the generic builders with its own
    // two-layer cache; when enabled, conservatively count the features stage
    // as a miss (overestimating only makes a draft more likely).
    const featuresHit =
      !params.wallPattern.enabled &&
      BIN_FEATURE_BUILDERS.every(
        (b) => !b.shouldBuild(ctx) || hasFeatureCache(b.name, b.cacheKey(ctx))
      );
    return (
      (shellHit ? 0 : base) +
      (featuresHit ? 0 : (lastStageMs.get('features') ?? 0)) +
      (lastStageMs.get('boolean') ?? 0) +
      (lastStageMs.get('merge') ?? 0)
    );
  } catch {
    return null;
  }
}
