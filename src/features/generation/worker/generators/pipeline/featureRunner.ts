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

import { clone, unwrap } from 'brepjs';
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
  };
  const bucketMap: Record<string, Shape3D[]> = {
    fuse: targets.fuseTargets,
    cut: targets.cutTargets,
    patternCut: targets.patternCutTargets,
  };

  const perf = ctx.perfCollector;

  for (const builder of builders) {
    if (!builder.shouldBuild(ctx)) continue;
    checkCancelled(ctx.signal);

    const builderStart = perf ? performance.now() : 0;
    const key = builder.cacheKey(ctx);

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

  return targets;
}
