/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Uses brepjs's `fuseAllBisect` / `cutAllBisect` primitives, which try a
 * single n-way batch op first, then recursively bisect on failure down to
 * pairwise ops — strictly better than the prior `batchWithFallback`
 * sequential fallback (2.4× faster at N=16 per the upstream bench), and
 * the recovery surfaces structured telemetry instead of opaque exceptions.
 *
 * booleanPipeline() is still used by socketBuilder and baseplateGenerator
 * for simpler fuse→cut chains where bisect's recovery would be wasted.
 */

import { unwrap, fuseAllBisect, cutAllBisect, translate } from 'brepjs';
import type { Shape3D, ValidSolid, BatchBisectTelemetry } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled } from '../../utils/abort';
import { getBinBodyCache, setBinBodyCache } from '../../shapeCache';
import { compactKey } from '../../cacheKeyUtils';

export type BooleanFallbackCategory = 'fuse' | 'cut' | 'pattern_cut';

/**
 * One record per boolean op that needed bisect recovery. `batchAttempts > 1`
 * or `singletonFallbacks > 0` means the first n-way attempt failed and
 * recovery kicked in; the histogram of `failedInputCount` vs `totalInputs`
 * separates concentrated failures (1-2 bad tools → bisect wins big) from
 * structural failures (all tools fail → bisect bottoms out at pairwise).
 */
export interface BooleanFallbackRecord {
  readonly category: BooleanFallbackCategory;
  readonly totalInputs: number;
  readonly batchAttempts: number;
  readonly batchSucceeded: number;
  readonly singletonFallbacks: number;
  readonly failedInputCount: number;
}

let fallbackRecords: BooleanFallbackRecord[] = [];

export function getBooleanFallbackStats(): readonly BooleanFallbackRecord[] {
  return fallbackRecords.slice();
}

export function resetBooleanFallbackStats(): void {
  fallbackRecords = [];
}

export function recordIfRecovered(
  category: BooleanFallbackCategory,
  telemetry: BatchBisectTelemetry
): void {
  if (telemetry.batchAttempts > 1 || telemetry.singletonFallbacks > 0) {
    fallbackRecords.push({
      category,
      totalInputs: telemetry.totalInputs,
      batchAttempts: telemetry.batchAttempts,
      batchSucceeded: telemetry.batchSucceeded,
      singletonFallbacks: telemetry.singletonFallbacks,
      failedInputCount: telemetry.failedInputs.length,
    });
  }
}

function applyCutPass(
  bin: Shape3D,
  originalSolid: Shape3D,
  targets: readonly Shape3D[],
  category: BooleanFallbackCategory,
  opts: BooleanOpts
): Shape3D {
  const prev = bin;
  const { shape, telemetry } = unwrap(
    cutAllBisect(bin as ValidSolid, [...targets] as ValidSolid[], opts)
  );
  recordIfRecovered(category, telemetry);
  if (prev !== originalSolid && prev !== shape) prev.delete();
  return shape;
}

export const booleanStage: PipelineStage = {
  name: 'boolean',
  progressValue: 0.6,

  shouldRun(ctx: PipelineContext): boolean {
    return (
      ctx.fuseTargets.length > 0 || ctx.cutTargets.length > 0 || ctx.patternCutTargets.length > 0
    );
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { signal, forExport, featuresKey } = ctx;
    let bin = ctx.solid;
    if (!bin) return ctx;
    const originalSolid = bin;

    checkCancelled(signal);

    const allTargets = [...ctx.fuseTargets, ...ctx.cutTargets, ...ctx.patternCutTargets];

    // Resume cache: a metadata-only edit (label text, notes, category) leaves
    // the shell and every feature's geometry key unchanged, so the post-boolean
    // body is identical — skip the whole boolean stage. The key composes the
    // shell identity, the feature geometry (`featuresKey`), and `forExport`
    // (which drives `simplify`), so it changes whenever the booleaned body
    // would. Disabled when `featuresKey` is null (solid mode / wall patterns,
    // whose tools aren't captured by the key — see featuresStage).
    // JSON.stringify keeps the composition injective end-to-end: `shellKey` and
    // `featuresKey` can both contain `|`, which a flat `buildCacheKey` join could
    // collide across segment boundaries into a false hit (stale geometry).
    // `compactKey` then hashes long keys, the same as every other cache here.
    const resumeKey =
      featuresKey !== null
        ? compactKey(
            JSON.stringify(['binbody-v1', ctx.dimensions.shellKey, forExport, featuresKey])
          )
        : null;

    if (resumeKey !== null) {
      const cached = getBinBodyCache(resumeKey);
      if (cached) {
        // The cached body already has features fused/cut in and carries their
        // face-origin tags (preserved by the metadata clone). Drop the shell
        // and the now-unused feature tools; the freshly built deferredSolid
        // (socket) flows through unchanged.
        originalSolid.delete();
        for (const t of allTargets) t.delete();
        return { ...ctx, solid: cached, fuseTargets: [], cutTargets: [], patternCutTargets: [] };
      }
    }

    // Shared by fuse and cut passes — `simplify: forExport` merges
    // same-domain faces left behind by the n-way boolean, and `signal`
    // threads cancellation through. Fuse used to drop both, accumulating
    // duplicate / coincident faces from additive features (label tabs,
    // scoop ramps) that share a face with the shell; slicers (BambuStudio)
    // flag the resulting duplicate triangles as non-manifold (#1822 —
    // partial fix; see labelTab gusset-back-face follow-up).
    const boolOpts = { simplify: forExport, signal } as BooleanOpts;

    if (ctx.fuseTargets.length > 0) {
      checkCancelled(signal);
      const { shape, telemetry } = unwrap(
        fuseAllBisect([bin, ...ctx.fuseTargets] as ValidSolid[], boolOpts)
      );
      recordIfRecovered('fuse', telemetry);
      bin = shape;
    }

    if (ctx.cutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.cutTargets, 'cut', boolOpts);
    }

    if (ctx.patternCutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.patternCutTargets, 'pattern_cut', boolOpts);
    }

    if (bin !== originalSolid) originalSolid.delete();
    for (const t of allTargets) t.delete();

    // Populate the resume cache and hand the pipeline a metadata-preserving
    // clone — the cache owns `bin`, exactly like shellStage/getShellCache.
    if (resumeKey !== null) {
      setBinBodyCache(resumeKey, bin);
      bin = translate(bin, [0, 0, 0]);
    }

    return { ...ctx, solid: bin, fuseTargets: [], cutTargets: [], patternCutTargets: [] };
  },
};
