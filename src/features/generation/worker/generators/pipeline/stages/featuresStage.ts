/**
 * Features stage — builds all interior feature tool shapes.
 *
 * Standard mode: delegates to the generic feature runner for compartment
 * walls, inserts, slots, label tabs, scoop ramps, wall cutouts. Wall
 * patterns are handled as a special case with per-wall caching.
 *
 * Solid mode: cutout cuts (top-down cavity carving), plus wall text — the
 * outer face of a solid block is the same wall a hollow bin engraves.
 *
 * Populates fuseTargets (additive), cutTargets (subtractive), and
 * patternCutTargets (pattern cuts — separate boolean pass) arrays
 * for the subsequent boolean stage.
 */

import { translate } from 'brepjs';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { PipelineContext, PipelineStage } from '../types';
import { buildCutoutCuts } from '../../featureBuilder';
import { buildCutoutLabelSocketTools } from '../../cutoutLabelSocketBuilder';
import { buildIntegratedKnifeRestTools } from '../../knifeRestBuilder';
import { runFeatureBuilders } from '../featureRunner';
import { BIN_FEATURE_BUILDERS, SOLID_FEATURE_BUILDERS } from '../featureComposition';
import { buildWallPatterns } from '../../wallPatternBuilder';
import { buildKumikoWallPatterns } from '../../kumikoWrapBuilder';
import { buildDividerPatterns } from '../../dividerPatternBuilder';
import { buildFloorPattern } from '../../floorPatternBuilder';

export const featuresStage: PipelineStage = {
  name: 'features',
  progressValue: 0.5,

  shouldRun(ctx: PipelineContext): boolean {
    const { innerW, innerD } = ctx.dimensions;
    return innerW > 0 && innerD > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { params, dimensions: dim } = ctx;

    // Solid mode: cutouts are the only feature. Hand each cutout tool to
    // booleanStage as an independent cutTarget so cutAllBisect can recover
    // from a single bad tool instead of dropping the whole set, and so
    // export passes pick up the `simplify` topology cleanup that the rest
    // of the pipeline already benefits from.
    if (dim.solid) {
      // booleanStage early-returns when ctx.solid is null; building tools
      // we'd never apply would just leak their WASM shapes.
      if (!ctx.solid) return ctx;
      // A tapered outer wall narrows toward the floor, so the interior clip has
      // to narrow with it or a pocket near a flared side cuts straight through
      //. Dimensions must match the box builder's: it extrudes to
      // `wallHeight + collarHeight`, and the band is clamped against that.
      const { taper } = dim.overhang;
      const interiorTaper = taper
        ? {
            outerW: dim.innerW + 2 * params.wallThickness,
            outerD: dim.innerD + 2 * params.wallThickness,
            wallHeight: dim.wallHeight + dim.collarHeight,
            wallThickness: params.wallThickness,
            taper,
          }
        : undefined;
      const { cutTools, fuseTools } = buildCutoutCuts(
        params,
        dim.innerW,
        dim.innerD,
        dim.wallHeight,
        interiorTaper
      );
      // Swappable-label sockets are planned separately: they are bounded by
      // the fill surface and their own clear-space test, not by the interior
      // clip the cavity tools go through, whose box would shear the margin
      // that keeps the pocket's mouth off a coincident face.
      cutTools.push(...buildCutoutLabelSocketTools(params, dim.innerW, dim.innerD, dim.wallHeight));
      // Integrated knife rest: the rear shelf + saddle grooves carve the block
      // itself. Skipped under a tapered wall along with the breach channels —
      // a shelf whose exit stayed enclosed would be a cradle behind a wall.
      if (!taper) {
        cutTools.push(
          ...buildIntegratedKnifeRestTools(params, {
            innerW: dim.innerW,
            innerD: dim.innerD,
            wallHeight: dim.wallHeight,
            collarHeight: dim.collarHeight,
          })
        );
      }
      const { innerOffsetX, innerOffsetY } = dim;
      const shiftToInterior = (tool: (typeof cutTools)[number]): (typeof cutTools)[number] => {
        if (innerOffsetX === 0 && innerOffsetY === 0) return tool;
        const shifted = translate(tool, [innerOffsetX, innerOffsetY, 0]);
        tool.delete();
        return shifted;
      };
      // Tools arrive pre-tagged from buildCutoutCuts: each cavity carries its
      // per-unit color tag (CUTOUT_COLOR_TAG_BASE + ordinal) and label text
      // carries FeatureTag.TEXT. Tags survive this interior shift, so re-tagging
      // here would clobber them — just translate.
      const cutoutTools = cutTools.map(shiftToInterior);
      const embossTools = fuseTools.map(shiftToInterior);
      // Wall text is the one generic feature a solid body can still take: it
      // works the outer face, which a solid bin has exactly like a hollow one.
      // Run through the shared runner rather than called directly, so engrave
      // and emboss keep landing in the right pile and stay on the same cache
      // key as everywhere else. Deliberately NOT shifted: the tools are built
      // in the outer-wall frame, which the asymmetric-overhang offset above
      // does not apply to.
      const wallText = runFeatureBuilders(SOLID_FEATURE_BUILDERS, ctx);
      // Solid-mode cutout tools aren't keyed through feature builders, so the
      // post-boolean resume cache can't safely identify them — disable it.
      return {
        ...ctx,
        cutTargets: [...cutoutTools, ...wallText.cutTargets],
        fuseTargets: [...embossTools, ...wallText.fuseTargets],
        // Empty for the two wall-text builders, and passed on anyway so a
        // builder added to the solid set later cannot leak its shapes here.
        patternCutTargets: wallText.patternCutTargets,
        featuresKey: null,
      };
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

    // Floor pattern: drainage/ventilation holes through the floor slab
    // AND the base socket, so they're handed to the boolean stage twice — once
    // for the body, once for the deferred socket.
    const floorPatternShapes = buildFloorPattern(ctx);
    targets.patternCutTargets.push(...floorPatternShapes);

    // Wall patterns: special case with per-wall caching + cutout clipping.
    // Polygon bins enumerate outer polygon edges (see wallPatterns.ts) and
    // only bind clipping to the outermost edge per cardinal — non-outermost
    // step walls get pure pattern.
    const wallPatternEnabled = params.wallPattern.enabled;
    const wallPatternKeys: string[] = [];
    if (wallPatternEnabled) {
      // Stamp patterns and kumiko wrapped-lattice patterns are mutually
      // exclusive per pattern type; each builder no-ops for the other's types.
      const patterns = buildWallPatterns(ctx);
      // Stamp shapes carry a per-shape identity in lockstep; a mismatch would
      // mean a shape whose identity is missing from the resume key, which is the
      // one failure that surfaces as wrong geometry rather than a slow rebuild.
      if (patterns.keys.length !== patterns.shapes.length) {
        throw new Error('wall pattern targets and keys are misaligned');
      }
      targets.patternCutTargets.push(...patterns.shapes);
      wallPatternKeys.push(...patterns.keys);

      // Kumiko and divider cuts each report a single key that fully identifies
      // their whole set (see the builders). A blank key means no cut was emitted,
      // so there is nothing to fold in. Divider walls carry the same pattern when
      // opted in; both stamp and kumiko divider panels are handled inside.
      const kumiko = buildKumikoWallPatterns(ctx);
      targets.patternCutTargets.push(...kumiko.shapes);
      if (kumiko.key) wallPatternKeys.push(kumiko.key);

      const dividers = buildDividerPatterns(ctx);
      targets.patternCutTargets.push(...dividers.shapes);
      if (dividers.key) wallPatternKeys.push(dividers.key);
    }

    // The floor pattern stays unkeyed: its shapes also carve the deferred
    // socket, and a resume hit would be worse than stale (the cached body would
    // come back with holes while the freshly built socket flowed through uncut).
    // Every other pattern cut now reports its identity.
    const resumable = floorPatternShapes.length === 0;

    return {
      ...ctx,
      fuseTargets: targets.fuseTargets,
      cutTargets: targets.cutTargets,
      patternCutTargets: targets.patternCutTargets,
      deferredCutTargets: floorPatternShapes,
      // Wall-pattern cuts ride in `featuresKey` via the same per-wall identity
      // the pattern cache trusts, so a patterned bin can resume the post-boolean
      // body like any other. That matters most here: the honeycomb-plus-cutouts
      // bins are both the slowest to boolean and, until now, the only ones
      // barred from the cache that exists to skip it.
      featuresKey: resumable
        ? wallPatternKeys.length > 0
          ? JSON.stringify(['wallpattern-v1', targets.featuresKey, wallPatternKeys])
          : targets.featuresKey
        : null,
    };
  },
};
