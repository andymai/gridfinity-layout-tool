/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Uses batch operations (fuseAll / cutAll) with sequential fallback
 * for OCCT edge cases where batched operations fail.
 */

import { unwrap, fuse, fuseAll, cut, cutAll } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled } from '../../meshUtils';

/** Returns true if the error is an AbortError that should be rethrown. */
function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

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
        result = pairwise(result, target);
      } catch (inner: unknown) {
        if (isAbortError(inner)) throw inner;
      }
    }
    return result;
  }
}

export const booleanStage: PipelineStage = {
  name: 'features',
  progressValue: 0.6,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.fuseTargets.length > 0 || ctx.cutTargets.length > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { signal, forExport } = ctx;
    let bin = ctx.solid;
    if (!bin) return ctx;

    if (ctx.fuseTargets.length > 0) {
      checkCancelled(signal);
      bin = batchWithFallback(
        bin,
        ctx.fuseTargets,
        (b, targets) => unwrap(fuseAll([b, ...targets])),
        (b, t) => unwrap(fuse(b, t))
      );
    }

    if (ctx.cutTargets.length > 0) {
      checkCancelled(signal);
      bin = batchWithFallback(
        bin,
        ctx.cutTargets,
        (b, targets) =>
          unwrap(cutAll(b, [...targets], { simplify: forExport, signal } as BooleanOpts)),
        (b, t) => unwrap(cut(b, t))
      );
    }

    return { ...ctx, solid: bin, fuseTargets: [], cutTargets: [] };
  },
};
