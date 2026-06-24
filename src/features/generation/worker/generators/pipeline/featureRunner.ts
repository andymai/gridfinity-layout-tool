/**
 * Generic feature builder runner for the bin generation pipeline.
 *
 * Iterates a composition root array of FeatureBuilder objects, handling:
 * - shouldBuild gate checks
 * - Cache lookup and population (correct clone ownership)
 * - Face provenance tracking via collectOrigins
 * - Target bucket sorting (fuse / cut / patternCut)
 * - Cancellation via AbortSignal
 *
 * Clone ownership contract (matches existing cachedFeature semantics):
 * - Cache miss: cache owns the original, caller gets a clone
 * - Cache hit: caller gets a clone from the cache
 * - One clone per path — never two
 */

import { clone, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext } from './types';
import type { FeatureBuilder } from './featureBuilder';
import { checkCancelled } from '../utils/abort';
import { getFeatureCache, setFeatureCache } from '../shapeCache';
import { collectOrigins } from './collectOrigins';

export interface FeatureTargets {
  fuseTargets: Shape3D[];
  cutTargets: Shape3D[];
  patternCutTargets: Shape3D[];
  /**
   * Composite key over every built feature's own cache key, in builder order.
   * Identifies the exact set of feature geometry produced this run so the
   * post-boolean body can be cached/resumed (see booleanStage).
   */
  featuresKey: string;
}

/**
 * Serialize the per-builder `[name, target, key]` triples into one composite
 * key. Uses JSON so the result is injective: a builder key may embed user text
 * (e.g. a label) containing `|` or `:`, and a flat delimiter join could collide
 * two distinct feature sets into the same string — a false resume-cache hit
 * that returns stale geometry. JSON's quoting/escaping makes that impossible.
 */
export function composeFeaturesKey(parts: ReadonlyArray<readonly string[]>): string {
  return JSON.stringify(parts);
}

/**
 * Run all feature builders against the pipeline context.
 *
 * Each builder's shapes are cached, cloned, origin-tracked, and sorted
 * into the appropriate boolean target bucket.
 */
export function runFeatureBuilders(
  builders: readonly FeatureBuilder[],
  ctx: PipelineContext
): FeatureTargets {
  const targets: FeatureTargets = {
    fuseTargets: [],
    cutTargets: [],
    patternCutTargets: [],
    featuresKey: '',
  };
  const bucketMap: Record<string, Shape3D[]> = {
    fuse: targets.fuseTargets,
    cut: targets.cutTargets,
    patternCut: targets.patternCutTargets,
  };

  const perf = ctx.perfCollector;
  // Each entry is a [name, target, key] triple. Kept structured (not a
  // delimiter-joined string) so the JSON serialization below is injective —
  // a builder key may embed user text (e.g. a label) containing `|` or `:`,
  // which a flat join could collide across builders into a false cache hit.
  const keyParts: string[][] = [];

  for (const builder of builders) {
    if (!builder.shouldBuild(ctx)) continue;
    checkCancelled(ctx.signal);

    const builderStart = perf ? performance.now() : 0;
    const key = builder.cacheKey(ctx);
    // Record the key for every builder that runs, whether or not it yields a
    // shape — the post-boolean resume key must change if any input geometry
    // does. `target` distinguishes fuse vs cut so a builder that flips bucket
    // (same key, different op) still re-keys.
    keyParts.push([builder.name, builder.target, key]);

    // getFeatureCache returns a clone (caller owns it), or null on miss.
    let shape = getFeatureCache(builder.name, key);
    if (!shape) {
      const built = builder.build(ctx);
      if (built && built.length > 0) {
        // Cache owns original, caller gets a clone
        setFeatureCache(builder.name, key, built[0]);
        shape = unwrap(clone(built[0]));
        // Dispose any extra shapes to avoid WASM handle leaks.
        // Current builders always return single shapes; this is defensive.
        for (let i = 1; i < built.length; i++) built[i].delete();
      }
    }

    if (shape) {
      // Apply asymmetric-overhang cavity offset before tagging so
      // collectOrigins maps the face IDs of the final, positioned shape.
      const { innerOffsetX, innerOffsetY } = ctx.dimensions;
      if (innerOffsetX !== 0 || innerOffsetY !== 0) {
        const old = shape;
        shape = translate(old, [innerOffsetX, innerOffsetY, 0]);
        old.delete();
      }
      // `clone()` drops the face-origin WeakMap (shellCache uses
      // `translate([0,0,0])` for that reason), but here it's safe because
      // `collectOrigins` re-tags the freshly cloned shape on every
      // iteration — including cache hits. Don't move this call out of
      // the loop or feature colors will silently collapse.
      collectOrigins(shape, builder.tag, ctx.originToTag);
      bucketMap[builder.target].push(shape);
    }

    if (perf) perf.recordFeatureBuilder(builder.name, performance.now() - builderStart);
  }

  targets.featuresKey = composeFeaturesKey(keyParts);
  return targets;
}
