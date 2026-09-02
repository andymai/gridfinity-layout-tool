/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Cuts go through brepjs's `cutAllBisect`, which tries a single n-way batch op
 * first, then recursively bisects on failure down to pairwise ops.
 *
 * Fuses fold pairwise. occt-wasm's n-way fuse is OCCT's General Fuse: it
 * splits the inputs and keeps every cell rather than unioning them, so a body
 * with a feature comes back as overlapping shells, and the export's outer-shell
 * collapse can then ship the feature carved out. The two-argument fuse is a
 * real union and keeps the face-origin tags. A target whose step fails is
 * dropped, the same recovery the bisect gives a failed input, never handed to
 * the n-way fuse.
 *
 * booleanPipeline() is still used by socketBuilder and baseplateGenerator
 * for simpler fuse→cut chains where bisect's recovery would be wasted.
 */

import { unwrap, fuse, cutAllBisect, translate, isErr } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled } from '../../utils/abort';
import { getBinBodyCache, setBinBodyCache } from '../../shapeCache';
import { compactKey } from '../../cacheKeyUtils';

function applyCutPass(
  bin: Shape3D,
  originalSolid: Shape3D,
  targets: readonly Shape3D[],
  opts: BooleanOpts
): Shape3D {
  const prev = bin;
  const { shape } = unwrap(cutAllBisect(bin as ValidSolid, [...targets] as ValidSolid[], opts));
  if (prev !== originalSolid && prev !== shape) prev.delete();
  return shape;
}

/**
 * Carve the deferred base socket with the tools that must pass through it (the
 * floor pattern's drainage holes —).
 *
 * Runs before the body pass so the tools are still alive; the body pass owns
 * them and disposes them at the end. A failure here degrades to an uncarved
 * socket — the holes then stop at the socket's top face instead of draining —
 * rather than failing the whole generation.
 */
function cutDeferredSolid(ctx: PipelineContext): {
  solid: Shape3D | null;
  key: string | null;
} {
  const { deferredSolid, deferredCutTargets, signal, forExport } = ctx;
  if (!deferredSolid || deferredCutTargets.length === 0) {
    return { solid: deferredSolid, key: ctx.deferredSolidKey };
  }
  try {
    const { shape } = unwrap(
      cutAllBisect(
        deferredSolid as ValidSolid,
        [...deferredCutTargets] as ValidSolid[],
        {
          simplify: forExport,
          signal,
        } as BooleanOpts
      )
    );
    if (shape !== deferredSolid) deferredSolid.delete();
    // The socket's mesh cache is keyed on the SOCKET's own geometry, which says
    // nothing about the pattern carved into it — and the carve also depends on
    // divider/scoop keep-outs that key can't see. Drop it so a CARVED socket
    // always re-tessellates, mirroring how `featuresKey` disables the body's
    // resume cache for pattern cuts.
    return { solid: shape, key: null };
  } catch {
    // The cut produced no shape, so this is the original socket untouched — its
    // key still describes it, and dropping it would only cost a re-tessellation.
    return { solid: deferredSolid, key: ctx.deferredSolidKey };
  }
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
    const originalSolid = ctx.solid;
    if (!originalSolid) return ctx;
    let bin: Shape3D = originalSolid;

    checkCancelled(signal);

    const deferred = cutDeferredSolid(ctx);

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
        // and the now-unused feature tools; the freshly built socket flows
        // through as-is (a floor-patterned bin can't reach here — it disables
        // the resume key — but the carve above is still honoured if it did).
        originalSolid.delete();
        for (const t of allTargets) t.delete();
        return {
          ...ctx,
          solid: cached,
          deferredSolid: deferred.solid,
          deferredSolidKey: deferred.key,
          fuseTargets: [],
          cutTargets: [],
          patternCutTargets: [],
          deferredCutTargets: [],
        };
      }
    }

    // Shared by fuse and cut passes — `simplify: forExport` merges
    // same-domain faces left behind by the n-way boolean, and `signal`
    // threads cancellation through. Fuse used to drop both, accumulating
    // duplicate / coincident faces from additive features (label tabs,
    // scoop ramps) that share a face with the shell; slicers (BambuStudio)
    // flag the resulting duplicate triangles as non-manifold (—
    // partial fix; see labelTab gusset-back-face follow-up).
    const boolOpts = { simplify: forExport, signal } as BooleanOpts;

    if (ctx.fuseTargets.length > 0) {
      for (const target of ctx.fuseTargets) {
        checkCancelled(signal);
        const fused = fuse(bin as ValidSolid, target as ValidSolid, boolOpts);
        if (isErr(fused) || fused.value === bin) continue;
        if (bin !== originalSolid) bin.delete();
        bin = fused.value;
      }
    }

    if (ctx.cutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.cutTargets, boolOpts);
    }

    if (ctx.patternCutTargets.length > 0) {
      checkCancelled(signal);
      bin = applyCutPass(bin, originalSolid, ctx.patternCutTargets, boolOpts);
    }

    if (bin !== originalSolid) originalSolid.delete();
    for (const t of allTargets) t.delete();

    // Populate the resume cache and hand the pipeline a metadata-preserving
    // clone — the cache owns `bin`, exactly like shellStage/getShellCache.
    if (resumeKey !== null) {
      setBinBodyCache(resumeKey, bin);
      bin = translate(bin, [0, 0, 0]);
    }

    return {
      ...ctx,
      solid: bin,
      deferredSolid: deferred.solid,
      deferredSolidKey: deferred.key,
      fuseTargets: [],
      cutTargets: [],
      patternCutTargets: [],
      deferredCutTargets: [],
    };
  },
};
