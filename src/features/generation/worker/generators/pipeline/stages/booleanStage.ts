/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Uses batch operations (fuseAll / cutAll) with sequential fallback
 * for OCCT edge cases where batched operations fail.
 */

import { unwrap, fuse, fuseAll, cut, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled, isAbortError } from '../../utils/abort';

/**
 * Try a batch boolean, falling back to sequential pairwise operations.
 * AbortErrors always propagate; other errors are swallowed per-pair.
 */
function batchWithFallback(
  bin: Shape3D,
  targets: readonly Shape3D[],
  batch: (bin: Shape3D, targets: readonly Shape3D[]) => Shape3D,
  pairwise: (bin: Shape3D, target: Shape3D) => Shape3D
): Shape3D {
  try {
    return batch(bin, targets);
  } catch (e: unknown) {
    if (isAbortError(e)) throw e;
    let result = bin;
    for (const target of targets) {
      try {
        const prev = result;
        result = pairwise(result, target);
        if (prev !== bin) prev.delete(); // Dispose fallback intermediates (not original bin)
      } catch (inner: unknown) {
        if (isAbortError(inner)) throw inner;
      }
    }
    return result;
  }
}

/**
 * Apply a cut pass: batch-cut targets from bin, disposing the previous
 * intermediate if it was replaced (and isn't the original solid).
 */
function applyCutPass(
  bin: Shape3D,
  originalSolid: Shape3D,
  targets: readonly Shape3D[],
  opts: BooleanOpts
): Shape3D {
  const prev = bin;
  const result = batchWithFallback(
    bin,
    targets,
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
    const cutOpts = { simplify: forExport, signal } as BooleanOpts;

    if (ctx.fuseTargets.length > 0) {
      checkCancelled(signal);
      bin = batchWithFallback(
        bin,
        ctx.fuseTargets,
        (b, targets) => unwrap(fuseAll([b, ...targets] as ValidSolid[])),
        (b, t) => unwrap(fuse(b as ValidSolid, t as ValidSolid))
      );
    }

    // Cut passes are separated so OCCT doesn't compute pairwise intersections
    // between unrelated tool shapes (e.g. wall cutouts vs pattern elements).
    if (ctx.cutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.cutTargets, cutOpts);
    }

    if (ctx.patternCutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.patternCutTargets, cutOpts);
    }

    if (bin !== originalSolid) originalSolid.delete();
    const allTargets = [...ctx.fuseTargets, ...ctx.cutTargets, ...ctx.patternCutTargets];
    for (const t of allTargets) t.delete();

    return { ...ctx, solid: bin, fuseTargets: [], cutTargets: [], patternCutTargets: [] };
  },
};
