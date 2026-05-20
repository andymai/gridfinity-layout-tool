/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Uses batch fuseAll/cutAll passes with sequential pairwise fallback.
 * cutAll() compounds tools into a single boolean, which preserves better
 * face topology for complex bins than booleanPipeline()'s sequential approach.
 *
 * booleanPipeline() is used by socketBuilder and baseplateGenerator for
 * simpler fuse→cut chains where topology differences are negligible.
 */

import { unwrap, fuse, fuseAll, cut, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled, isAbortError } from '../../utils/abort';

export type BooleanFallbackCategory = 'fuse' | 'cut' | 'pattern_cut';

/**
 * Records one batch→sequential fallback event. The histogram of `targetCount`
 * vs `successfulCount` is what tells us whether failures are concentrated
 * (1 bad tool → `successfulCount = targetCount - 1`) or structural
 * (`successfulCount = 0` → every sequential op also failed).
 */
export interface BooleanFallbackRecord {
  readonly category: BooleanFallbackCategory;
  readonly targetCount: number;
  readonly successfulCount: number;
  readonly errorCategory: string;
}

let fallbackRecords: BooleanFallbackRecord[] = [];

export function getBooleanFallbackStats(): readonly BooleanFallbackRecord[] {
  return fallbackRecords.slice();
}

export function resetBooleanFallbackStats(): void {
  fallbackRecords = [];
}

/**
 * Strip identifier-like digits and trim so OCCT-style messages
 * ("BRepAlgoAPI: face 42 incompatible with face 17") collapse to a
 * stable categorical key in PostHog without exploding cardinality.
 */
export function categorizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Try a batch boolean, falling back to sequential pairwise operations.
 * AbortErrors always propagate; other errors are swallowed per-pair.
 * Records the fallback (if any) for diagnostics — see #1792.
 */
function batchWithFallback(
  bin: Shape3D,
  targets: readonly Shape3D[],
  category: BooleanFallbackCategory,
  batch: (bin: Shape3D, targets: readonly Shape3D[]) => Shape3D,
  pairwise: (bin: Shape3D, target: Shape3D) => Shape3D
): Shape3D {
  try {
    return batch(bin, targets);
  } catch (e: unknown) {
    if (isAbortError(e)) throw e;
    const errorCategory = categorizeError(e);
    let result = bin;
    let successfulCount = 0;
    for (const target of targets) {
      try {
        const prev = result;
        result = pairwise(result, target);
        if (prev !== bin) prev.delete();
        successfulCount++;
      } catch (inner: unknown) {
        if (isAbortError(inner)) throw inner;
      }
    }
    fallbackRecords.push({
      category,
      targetCount: targets.length,
      successfulCount,
      errorCategory,
    });
    return result;
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
  const result = batchWithFallback(
    bin,
    targets,
    category,
    (b, ts) => unwrap(cutAll(b as ValidSolid, [...ts] as ValidSolid[], opts)),
    (b, t) => unwrap(cut(b as ValidSolid, t as ValidSolid))
  );
  if (prev !== originalSolid && prev !== result) prev.delete();
  return result;
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
    const { signal, forExport } = ctx;
    let bin = ctx.solid;
    if (!bin) return ctx;
    const originalSolid = bin;

    checkCancelled(signal);

    const cutOpts = { simplify: forExport, signal } as BooleanOpts;

    if (ctx.fuseTargets.length > 0) {
      checkCancelled(signal);
      bin = batchWithFallback(
        bin,
        ctx.fuseTargets,
        'fuse',
        (b, targets) => unwrap(fuseAll([b, ...targets] as ValidSolid[])),
        (b, t) => unwrap(fuse(b as ValidSolid, t as ValidSolid))
      );
    }

    if (ctx.cutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.cutTargets, 'cut', cutOpts);
    }

    if (ctx.patternCutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.patternCutTargets, 'pattern_cut', cutOpts);
    }

    if (bin !== originalSolid) originalSolid.delete();
    const allTargets = [...ctx.fuseTargets, ...ctx.cutTargets, ...ctx.patternCutTargets];
    for (const t of allTargets) t.delete();

    return { ...ctx, solid: bin, fuseTargets: [], cutTargets: [], patternCutTargets: [] };
  },
};
