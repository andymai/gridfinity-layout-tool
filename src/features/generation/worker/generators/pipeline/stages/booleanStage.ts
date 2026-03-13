/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Uses batch operations (fuseAll / cutAll) with sequential fallback
 * for OCCT edge cases where batched operations fail.
 */

import { unwrap, fuse, fuseAll, cut, cutAll } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled } from '../../meshUtils';

export const booleanStage: PipelineStage = {
  name: 'boolean',
  progressValue: 0.6,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.fuseTargets.length > 0 || ctx.cutTargets.length > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { signal, forExport } = ctx;
    let bin = ctx.solid;
    if (!bin) return ctx;

    checkCancelled(signal);
    if (ctx.fuseTargets.length > 0) {
      try {
        bin = unwrap(fuseAll([bin, ...ctx.fuseTargets]));
      } catch (batchError: unknown) {
        if (batchError instanceof DOMException && batchError.name === 'AbortError')
          throw batchError;
        // Fallback: apply fuses sequentially
        for (const target of ctx.fuseTargets) {
          try {
            bin = unwrap(fuse(bin, target));
          } catch (e: unknown) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e;
          }
        }
      }
    }

    checkCancelled(signal);
    if (ctx.cutTargets.length > 0) {
      try {
        bin = unwrap(
          cutAll(bin, [...ctx.cutTargets], { simplify: forExport, signal } as BooleanOpts)
        );
      } catch (batchError: unknown) {
        if (batchError instanceof DOMException && batchError.name === 'AbortError')
          throw batchError;
        // Fallback: apply cuts sequentially
        for (const target of ctx.cutTargets) {
          try {
            bin = unwrap(cut(bin, target));
          } catch (e: unknown) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e;
          }
        }
      }
    }

    return { ...ctx, solid: bin, fuseTargets: [], cutTargets: [] };
  },
};
