/**
 * Features stage — builds all interior feature tool shapes.
 *
 * Standard mode: delegates to the generic feature runner for compartment
 * walls, inserts, slots, label tabs, scoop ramps, wall cutouts. Wall
 * patterns are handled as a special case with per-wall caching.
 *
 * Solid mode: only cutout cuts (top-down cavity carving).
 *
 * Populates fuseTargets (additive), cutTargets (subtractive), and
 * patternCutTargets (pattern cuts — separate boolean pass) arrays
 * for the subsequent boolean stage.
 */

import { isPartialMask } from '@/shared/utils/cellMask';
import type { PipelineContext, PipelineStage } from '../types';
import { buildCutoutCuts } from '../../featureBuilder';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';
import { runFeatureBuilders } from '../featureRunner';
import { BIN_FEATURE_BUILDERS } from '../featureComposition';
import { buildWallPatterns } from '../../wallPatternBuilder';

export const featuresStage: PipelineStage = {
  name: 'features',
  progressValue: 0.5,

  shouldRun(ctx: PipelineContext): boolean {
    const { innerW, innerD } = ctx.dimensions;
    return innerW > 0 && innerD > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { params, dimensions: dim, originToTag } = ctx;

    // Solid mode: cutouts are the only feature. Hand each cutout tool to
    // booleanStage as an independent cutTarget so cutAllBisect can recover
    // from a single bad tool instead of dropping the whole set, and so
    // export passes pick up the `simplify` topology cleanup that the rest
    // of the pipeline already benefits from.
    if (dim.solid) {
      // booleanStage early-returns when ctx.solid is null; building tools
      // we'd never apply would just leak their WASM shapes.
      if (!ctx.solid) return ctx;
      const cutoutTools = buildCutoutCuts(params, dim.innerW, dim.innerD, dim.wallHeight);
      for (const tool of cutoutTools) {
        collectOrigins(tool, FeatureTag.CUTOUT, originToTag);
      }
      return { ...ctx, cutTargets: cutoutTools };
    }

    // For non-rectangular (cellMask) bins, run only builders that have
    // opted in. Most interior features still assume a rectangular interior
    // (compartments, inserts, slots, label tabs, handles, scoops); each gets
    // polygon support in its own follow-up PR.
    const isPolygon = isPartialMask(params.cellMask);
    const builders = isPolygon
      ? BIN_FEATURE_BUILDERS.filter((b) => b.supportsCellMask === true)
      : BIN_FEATURE_BUILDERS;

    const targets = runFeatureBuilders(builders, ctx);

    // Wall patterns: special case with per-wall caching + cutout clipping.
    // Polygon bins enumerate outer polygon edges (see wallPatterns.ts) and
    // only bind clipping to the outermost edge per cardinal — non-outermost
    // step walls get pure pattern.
    if (params.wallPattern.enabled) {
      const patternShapes = buildWallPatterns(ctx);
      targets.patternCutTargets.push(...patternShapes);
    }

    return {
      ...ctx,
      fuseTargets: targets.fuseTargets,
      cutTargets: targets.cutTargets,
      patternCutTargets: targets.patternCutTargets,
    };
  },
};
