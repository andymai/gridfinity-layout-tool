/**
 * Features stage — builds all interior feature tool shapes.
 *
 * Standard mode: compartment walls, inserts, slots, label tabs, scoop ramps,
 * wall cutouts, wall patterns. Each feature is independently cached.
 *
 * Solid mode: only cutout cuts (top-down cavity carving).
 *
 * Populates fuseTargets (additive) and cutTargets (subtractive) arrays
 * for the subsequent boolean stage.
 */

import { drawPolysides, unwrap, cut, composeTransforms, transformCopy } from 'brepjs';
import type { Shape3D, TransformOp } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from '../../generatorConstants';
import { checkCancelled, sketch } from '../../meshUtils';
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
          return { ...ctx, solid: unwrap(cut(ctx.solid, cutoutCuts)) };
        } catch {
          // Cut operation can fail on complex geometries; skip if it does
        }
      }
      return ctx;
    }

    // Standard mode: all interior features
    const fuseTargets: Shape3D[] = [];
    const cutTargets: Shape3D[] = [];

    // Compartment walls
    if (!isSlotted) {
      checkCancelled(signal);
      const cwKey = `${shellKey}|${innerW}|${innerD}|${interiorHeight}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.thickness}|${params.compartments.cells.join(',')}`;
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
    const icKey = `${shellKey}|${JSON.stringify(params.inserts)}`;
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
      const scKey = `${shellKey}|${JSON.stringify(params.slotConfig)}|${innerW}|${innerD}|${interiorHeight}|${lipInfo ? `${lipInfo.wallHeight}|${lipInfo.lipHeight}|${lipInfo.lipTaperWidth}` : 'none'}`;
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
      const ltKey = `${shellKey}|${JSON.stringify(params.label)}|${innerW}|${innerD}|${interiorHeight}|${params.wallThickness}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
      cachedFeature(
        'labelTabs',
        ltKey,
        () => buildLabelTabs(params, innerW, innerD, interiorHeight, params.wallThickness),
        FeatureTag.LABEL_TAB,
        originToTag,
        fuseTargets
      );
    }

    // Scoop ramps
    if (!isSlotted) {
      checkCancelled(signal);
      const srKey = `${shellKey}|${JSON.stringify(params.scoop)}|${params.style}|${innerW}|${innerD}|${dim.wallHeight}|${params.wallThickness}|${hasLip}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
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
      const wcKey = `${shellKey}|${JSON.stringify(params.walls)}|${innerW}|${innerD}|${dim.wallHeight}|${hasLip}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
      cachedFeature(
        'wallCutoutCuts',
        wcKey,
        () => buildWallCutoutCuts(params, innerW, innerD, dim.wallHeight, hasLip),
        FeatureTag.WALL_CUTOUT,
        originToTag,
        cutTargets
      );
    }

    // Wall patterns
    if (params.wallPattern.enabled) {
      const patternResult = getPatternDescriptors(params, innerW, innerD, interiorHeight);
      if (patternResult) {
        const { descriptors: wallDescriptors, calculator } = patternResult;
        try {
          const cutDepth = params.wallThickness * 4;
          const halfDepth = cutDepth / 2;
          const patternType = calculator.getPatternType();
          const shapeRadius = calculator.getShapeRadius();

          const templateKey = `${patternType}|${shapeRadius}|${cutDepth}`;
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
                ...(wall.zRotation !== undefined
                  ? [
                      {
                        type: 'rotate' as const,
                        angle: wall.zRotation,
                        axis: [0, 0, 1] as [number, number, number],
                      },
                    ]
                  : []),
                { type: 'translate', v: [wall.translateX, wall.translateY, wall.translateZ] },
              ];
              const trsf = composeTransforms(ops);
              try {
                cutTargets.push(transformCopy(shapeTemplate, trsf));
              } finally {
                trsf.cleanup();
              }
            }
          }
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          // Pattern generation can fail on complex geometries; skip if it does
        }
      }
    }

    return { ...ctx, fuseTargets, cutTargets };
  },
};
