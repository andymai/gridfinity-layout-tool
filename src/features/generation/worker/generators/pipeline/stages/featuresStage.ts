/**
 * Features stage — builds all interior feature tool shapes.
 *
 * Standard mode: compartment walls, inserts, slots, label tabs, scoop ramps,
 * wall cutouts, wall patterns. Each feature is independently cached.
 *
 * Solid mode: only cutout cuts (top-down cavity carving).
 *
 * Populates fuseTargets (additive), cutTargets (subtractive), and
 * patternCutTargets (pattern cuts — separate boolean pass) arrays
 * for the subsequent boolean stage.
 */

import {
  drawPolysides,
  unwrap,
  cut,
  compound,
  composeTransforms,
  transformCopy,
  clone,
} from 'brepjs';
import type { Shape3D, TransformOp } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from '../../generatorConstants';
import { checkCancelled, sketch } from '../../meshUtils';
import { buildCacheKey, quantize, stableSerialize, compactKey } from '../../cacheKeyUtils';
import {
  getFeatureCache,
  setFeatureCache,
  getPatternTemplateCache,
  setPatternTemplateCache,
} from '../../shapeCache';
import {
  buildCompartmentWalls,
  buildInsertCuts,
  buildCutoutCuts,
  buildLabelTabs,
  buildHandles,
  buildScoopRamps,
  buildWallCutoutCuts,
} from '../../featureBuilder';
import { buildSlotCuts } from '../../slotBuilder';
import { getPatternDescriptors } from '../../wallPatterns';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

/**
 * Get-or-build a cached feature shape and, if present, collect its
 * face origins and push it into the target array.
 */
function cachedFeature(
  kind: string,
  key: string,
  build: () => Shape3D | null,
  tag: FeatureTag,
  originToTag: Map<number, number>,
  targets: Shape3D[]
): void {
  let shape = getFeatureCache(kind, key);
  if (!shape) {
    shape = build();
    if (shape) {
      setFeatureCache(kind, key, shape);
      shape = clone(shape); // Clone so targets array holds independent handle
    }
  }
  if (shape) {
    collectOrigins(shape, tag, originToTag);
    targets.push(shape);
  }
}

export const featuresStage: PipelineStage = {
  name: 'features',
  progressValue: 0.5,

  shouldRun(ctx: PipelineContext): boolean {
    const { innerW, innerD } = ctx.dimensions;
    return innerW > 0 && innerD > 0;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const { params, dimensions: dim, signal, originToTag } = ctx;
    const { shellKey, innerW, innerD, interiorHeight, isSlotted, hasLip } = dim;

    // Solid mode: apply cutout cut directly (not via booleanStage).
    // The original code used a bare cut() without simplify options,
    // so we preserve that behavior by cutting here instead of routing
    // through the batch boolean stage which applies simplify: forExport.
    if (dim.solid) {
      const cutoutCuts = buildCutoutCuts(params, innerW, innerD, dim.wallHeight);
      if (cutoutCuts && ctx.solid) {
        collectOrigins(cutoutCuts, FeatureTag.CUTOUT, originToTag);
        try {
          const oldSolid = ctx.solid;
          const newSolid = unwrap(cut(ctx.solid, cutoutCuts));
          oldSolid.delete();
          cutoutCuts.delete();
          return { ...ctx, solid: newSolid };
        } catch {
          cutoutCuts.delete();
          // Cut operation can fail on complex geometries; skip if it does
        }
      }
      return ctx;
    }

    // Standard mode: all interior features
    const fuseTargets: Shape3D[] = [];
    const cutTargets: Shape3D[] = [];
    const patternCutTargets: Shape3D[] = [];

    // Compartment walls
    if (!isSlotted) {
      checkCancelled(signal);
      const cwKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          quantize(innerW),
          quantize(innerD),
          quantize(interiorHeight),
          params.compartments.cols,
          params.compartments.rows,
          quantize(params.compartments.thickness),
          params.compartments.cells.join(',')
        )
      );
      cachedFeature(
        'compartmentWalls',
        cwKey,
        () => buildCompartmentWalls(params, innerW, innerD, interiorHeight),
        FeatureTag.DIVIDER,
        originToTag,
        fuseTargets
      );
    }

    // Insert cuts
    checkCancelled(signal);
    const icKey = compactKey(buildCacheKey('v1', shellKey, stableSerialize(params.inserts)));
    cachedFeature(
      'insertCuts',
      icKey,
      () => buildInsertCuts(params),
      FeatureTag.INSERT,
      originToTag,
      cutTargets
    );

    // Slot cuts
    if (isSlotted) {
      checkCancelled(signal);
      const lipInfo = hasLip
        ? { wallHeight: dim.wallHeight, lipHeight: LIP_HEIGHT, lipTaperWidth: LIP_TAPER_WIDTH }
        : undefined;
      const scKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          stableSerialize(params.slotConfig),
          quantize(innerW),
          quantize(innerD),
          quantize(interiorHeight),
          lipInfo
            ? buildCacheKey(
                'lip',
                quantize(lipInfo.wallHeight),
                quantize(lipInfo.lipHeight),
                quantize(lipInfo.lipTaperWidth)
              )
            : 'none'
        )
      );
      cachedFeature(
        'slotCuts',
        scKey,
        () => buildSlotCuts(params, innerW, innerD, interiorHeight, lipInfo),
        FeatureTag.SLOT,
        originToTag,
        cutTargets
      );
    }

    // Label tabs
    if (!isSlotted) {
      checkCancelled(signal);
      const ltKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          stableSerialize(params.label),
          quantize(innerW),
          quantize(innerD),
          quantize(interiorHeight),
          quantize(params.wallThickness),
          params.compartments.cols,
          params.compartments.rows,
          params.compartments.cells.join(',')
        )
      );
      cachedFeature(
        'labelTabs',
        ltKey,
        () => buildLabelTabs(params, innerW, innerD, interiorHeight, params.wallThickness),
        FeatureTag.LABEL_TAB,
        originToTag,
        fuseTargets
      );
    }

    // Handle ledges (solid mode returns early above, so !dim.solid is implicit here)
    if (params.handles.enabled && !isSlotted) {
      checkCancelled(signal);
      const hKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          stableSerialize(params.handles),
          quantize(innerW),
          quantize(innerD),
          quantize(interiorHeight),
          quantize(params.wallThickness),
          params.label.enabled,
          hasLip
        )
      );
      cachedFeature(
        'handles',
        hKey,
        () => buildHandles(params, innerW, innerD, interiorHeight, params.wallThickness, hasLip),
        FeatureTag.HANDLE,
        originToTag,
        fuseTargets
      );
    }

    // Scoop ramps
    if (!isSlotted) {
      checkCancelled(signal);
      const srKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          stableSerialize(params.scoop),
          params.style,
          quantize(innerW),
          quantize(innerD),
          quantize(dim.wallHeight),
          quantize(params.wallThickness),
          hasLip,
          params.compartments.cols,
          params.compartments.rows,
          params.compartments.cells.join(',')
        )
      );
      cachedFeature(
        'scoopRamps',
        srKey,
        () => buildScoopRamps(params, innerW, innerD, dim.wallHeight, params.wallThickness),
        FeatureTag.SCOOP,
        originToTag,
        fuseTargets
      );
    }

    // Wall cutouts
    if (params.walls.enabled) {
      checkCancelled(signal);
      const wcKey = compactKey(
        buildCacheKey(
          'v1',
          shellKey,
          stableSerialize(params.walls),
          quantize(innerW),
          quantize(innerD),
          quantize(dim.wallHeight),
          hasLip,
          params.compartments.cols,
          params.compartments.rows,
          params.compartments.cells.join(',')
        )
      );
      cachedFeature(
        'wallCutoutCuts',
        wcKey,
        () => buildWallCutoutCuts(params, innerW, innerD, dim.wallHeight, hasLip),
        FeatureTag.WALL_CUTOUT,
        originToTag,
        cutTargets
      );
    }

    // Wall patterns — pre-fuse all hex elements into a single compound shape
    // to avoid O(n²) boolean degradation from hundreds of individual cuts.
    if (params.wallPattern.enabled) {
      const patternResult = getPatternDescriptors(params, innerW, innerD, interiorHeight);
      if (patternResult) {
        const { descriptors: wallDescriptors, calculator } = patternResult;
        const patternElements: Shape3D[] = [];
        try {
          const cutDepth = params.wallThickness * 4;
          const halfDepth = cutDepth / 2;
          const patternType = calculator.getPatternType();
          const shapeRadius = calculator.getShapeRadius();

          const templateKey = buildCacheKey(
            'v1',
            patternType,
            quantize(shapeRadius),
            quantize(cutDepth)
          );
          const shapeTemplate =
            getPatternTemplateCache(templateKey) ??
            (() => {
              const sides = calculator.getSidesCount();
              const template = sketch(drawPolysides(shapeRadius, sides), 'XY').extrude(cutDepth);
              setPatternTemplateCache(templateKey, template);
              return template;
            })();

          for (const wall of wallDescriptors) {
            for (const center of wall.centers) {
              const ops: TransformOp[] = [
                { type: 'translate', v: [center.x, center.y, -halfDepth] },
                { type: 'rotate', angle: 90, axis: [1, 0, 0] },
              ];
              if (wall.zRotation !== undefined) {
                ops.push({ type: 'rotate', angle: wall.zRotation, axis: [0, 0, 1] });
              }
              ops.push({
                type: 'translate',
                v: [wall.translateX, wall.translateY, wall.translateZ],
              });
              const trsf = composeTransforms(ops);
              try {
                patternElements.push(transformCopy(shapeTemplate, trsf));
              } finally {
                trsf.cleanup();
              }
            }
          }

          if (patternElements.length > 0) {
            checkCancelled(signal);
            // Use compound() (O(n) topology grouping) instead of fuseAll()
            // (O(n²) boolean union). cutAll() already handles compounds.
            // Routed to patternCutTargets for a separate boolean pass —
            // cutting patterns and cutouts in one batch forces OCCT to
            // compute pairwise intersections between tool shapes.
            if (patternElements.length === 1) {
              const single = patternElements[0];
              collectOrigins(single, FeatureTag.WALL_PATTERN, originToTag);
              patternCutTargets.push(single);
            } else {
              const grouped = compound(patternElements);
              // Dispose individual handles — compound shares the underlying
              // OCCT TShape references, so the geometry stays alive.
              for (const el of patternElements) el.delete();
              patternElements.length = 0;
              collectOrigins(grouped, FeatureTag.WALL_PATTERN, originToTag);
              patternCutTargets.push(grouped);
            }
          }
        } catch (e: unknown) {
          // Dispose any pattern elements not handed off to patternCutTargets
          for (const el of patternElements) el.delete();
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          // Pattern generation can fail on complex geometries; skip if it does
        }
      }
    }

    return { ...ctx, fuseTargets, cutTargets, patternCutTargets };
  },
};
