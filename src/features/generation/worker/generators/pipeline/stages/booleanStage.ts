/**
 * Boolean stage — applies additive fuses and subtractive cuts.
 *
 * Cuts go through brepjs's `cutAllBisect`, which tries a single n-way batch op
 * first, then recursively bisects on failure down to pairwise ops.
 *
 * Fuses fold pairwise. The two-argument fuse carries face history, so each
 * feature keeps its face tags through the union. A target whose step fails is
 * dropped, the same recovery the bisect gives a failed input.
 *
 * booleanPipeline() is still used by socketBuilder and baseplateGenerator
 * for simpler fuse→cut chains where bisect's recovery would be wasted.
 */

import {
  unwrap,
  fuse,
  cutAllBisect,
  translate,
  isErr,
  compound,
  getBounds,
  getSolids,
} from 'brepjs';
import type { Bounds3D, Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { BooleanOpts } from '../../meshUtils';
import { checkCancelled } from '../../utils/abort';
import {
  getBinBodyCache,
  getCarvedSocketCache,
  setBinBodyCache,
  setCarvedSocketCache,
} from '../../shapeCache';
import { compactKey } from '../../cacheKeyUtils';
import { copyFaceOrigins } from '@/features/generation/worker/generators/pipeline/collectOrigins';

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

function boundsTouch(a: Bounds3D, b: Bounds3D): boolean {
  return (
    a.xMin <= b.xMax &&
    b.xMin <= a.xMax &&
    a.yMin <= b.yMax &&
    b.yMin <= a.yMax &&
    a.zMin <= b.zMax &&
    b.zMin <= a.zMax
  );
}

/**
 * Cuts each solid of `socket` with only the tools whose bounds touch it, and
 * gathers the results into a compound. A cut distributes over the cells' union,
 * so this is the whole cut, but each boolean sees one cell and its own hole
 * instead of every hole in the floor. A one-solid socket takes the whole cut.
 */
function carveByCell(
  socket: Shape3D,
  tools: readonly Shape3D[],
  opts: BooleanOpts
): { shape: Shape3D; complete: boolean } {
  const cells = getSolids(socket);
  if (cells.length < 2) {
    const { shape, telemetry } = unwrap(
      cutAllBisect(socket as ValidSolid, [...tools] as ValidSolid[], opts)
    );
    return { shape, complete: telemetry.failedInputs.length === 0 };
  }
  const toolBounds = tools.map((t) => getBounds(t));
  const parts: Shape3D[] = [];
  const carved: Shape3D[] = [];
  let complete = true;
  try {
    for (const cell of cells) {
      const bounds = getBounds(cell);
      const over = tools.filter((_, i) => boundsTouch(bounds, toolBounds[i]));
      if (over.length === 0) {
        parts.push(cell);
        continue;
      }
      // The cell is a borrowed sub-shape with no origins of its own; give it
      // the socket's so the cut carries them onto the carved faces.
      copyFaceOrigins(cell, [socket]);
      const { shape, telemetry } = unwrap(
        cutAllBisect(cell as ValidSolid, over as ValidSolid[], opts)
      );
      if (shape !== cell) carved.push(shape);
      if (telemetry.failedInputs.length > 0) complete = false;
      parts.push(shape);
    }
    const whole = compound(parts);
    copyFaceOrigins(whole, [...carved, socket]);
    return { shape: whole, complete };
  } finally {
    // The compound holds its own references to the carved solids.
    for (const s of carved) s.delete();
  }
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
  const { deferredSolid, deferredCutTargets, deferredSolidKey, deferredCutKey, signal, forExport } =
    ctx;
  if (!deferredSolid || deferredCutTargets.length === 0) {
    return { solid: deferredSolid, key: deferredSolidKey };
  }
  const carveKey =
    deferredSolidKey !== null && deferredCutKey !== null
      ? compactKey(
          JSON.stringify(['carved-socket-v1', deferredSolidKey, deferredCutKey, forExport])
        )
      : null;
  if (carveKey !== null) {
    const cached = getCarvedSocketCache(carveKey);
    if (cached) {
      deferredSolid.delete();
      return { solid: cached, key: carveKey };
    }
  }
  let carved: { shape: Shape3D; complete: boolean };
  try {
    carved = carveByCell(deferredSolid, deferredCutTargets, { signal });
  } catch {
    // The cut produced no shape, so this is the original socket untouched — its
    // key still describes it, and dropping it would only cost a re-tessellation.
    return { solid: deferredSolid, key: deferredSolidKey };
  }
  const { shape, complete } = carved;
  if (shape !== deferredSolid) deferredSolid.delete();
  // A tool the bisect had to drop leaves a carve the key does not describe.
  if (carveKey === null || !complete) return { solid: shape, key: null };
  setCarvedSocketCache(carveKey, shape);
  return { solid: translate(shape, [0, 0, 0]), key: carveKey };
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
    // shell identity, the feature geometry (`featuresKey`), and `forExport`,
    // which keeps preview and export bodies apart. Disabled when `featuresKey` is null (solid mode / wall patterns,
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
        // and the now-unused feature tools; the socket from the carve above
        // flows through as-is.
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
          deferredCutKey: null,
        };
      }
    }

    // `signal` threads cancellation through the fuse and cut passes. No
    // `simplify`: merging same-domain faces folds flat label text into the
    // tab top it sits flush with, dropping its colour, and opens the exported
    // mesh of some kumiko patterns.
    const boolOpts = { signal } as BooleanOpts;

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
      deferredCutKey: null,
    };
  },
};
