/**
 * Worker-side accumulator for per-generation performance timings.
 *
 * Pipeline stages and the wall-pattern builder record timings into the
 * collector; the worker emits the final `PerfSnapshot` with `MESH_RESULT`
 * for the dev-only PerfOverlay.
 *
 * Overhead is intentionally small — a handful of `performance.now()` calls
 * per generation, no allocations on the hot path beyond pushing into a
 * short array.
 */

import type { PerfSnapshot, PerfStageEntry, PerfSubstepEntry } from '../../../bridge/types';

export class PerfCollector {
  private readonly stages: PerfStageEntry[] = [];
  private readonly featureBuilders: PerfSubstepEntry[] = [];
  private readonly wallPatternSubsteps: PerfSubstepEntry[] = [];
  private hexCenterCount = 0;
  private patternCutToolCount = 0;

  recordStage(name: string, ms: number): void {
    this.stages.push({ name, ms });
  }

  recordFeatureBuilder(name: string, ms: number): void {
    this.featureBuilders.push({ name, ms });
  }

  recordWallPatternSubstep(name: string, ms: number, count?: number): void {
    this.wallPatternSubsteps.push(count === undefined ? { name, ms } : { name, ms, count });
  }

  addHexCenters(n: number): void {
    this.hexCenterCount += n;
  }

  setPatternCutToolCount(n: number): void {
    this.patternCutToolCount = n;
  }

  snapshot(totalMs: number): PerfSnapshot {
    return {
      totalMs,
      stages: this.stages.slice(),
      featureBuilders: this.featureBuilders.slice(),
      wallPatternSubsteps: this.wallPatternSubsteps.slice(),
      hexCenterCount: this.hexCenterCount,
      patternCutToolCount: this.patternCutToolCount,
    };
  }
}
