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
    const wallThickness = params.wallThickness;

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
      let compartmentWalls = getFeatureCache('compartmentWalls', cwKey);
      if (!compartmentWalls) {
        compartmentWalls = buildCompartmentWalls(params, innerW, innerD, interiorHeight);
        if (compartmentWalls) {
          setFeatureCache('compartmentWalls', cwKey, compartmentWalls);
        }
      }
      if (compartmentWalls) {
        collectOrigins(compartmentWalls, FeatureTag.DIVIDER, originToTag);
        fuseTargets.push(compartmentWalls);
      }
    }

    // Insert cuts
    checkCancelled(signal);
    const icKey = `${shellKey}|${JSON.stringify(params.inserts)}`;
    let insertCuts = getFeatureCache('insertCuts', icKey);
    if (!insertCuts) {
      insertCuts = buildInsertCuts(params);
      if (insertCuts) {
        setFeatureCache('insertCuts', icKey, insertCuts);
      }
    }
    if (insertCuts) {
      collectOrigins(insertCuts, FeatureTag.INSERT, originToTag);
      cutTargets.push(insertCuts);
    }

    // Slot cuts
    if (isSlotted) {
      checkCancelled(signal);
      const lipInfo = hasLip
        ? { wallHeight: dim.wallHeight, lipHeight: LIP_HEIGHT, lipTaperWidth: LIP_TAPER_WIDTH }
        : undefined;
      const scKey = `${shellKey}|${JSON.stringify(params.slotConfig)}|${innerW}|${innerD}|${interiorHeight}|${lipInfo ? `${lipInfo.wallHeight}|${lipInfo.lipHeight}|${lipInfo.lipTaperWidth}` : 'none'}`;
      let slotCuts = getFeatureCache('slotCuts', scKey);
      if (!slotCuts) {
        slotCuts = buildSlotCuts(params, innerW, innerD, interiorHeight, lipInfo);
        if (slotCuts) {
          setFeatureCache('slotCuts', scKey, slotCuts);
        }
      }
      if (slotCuts) {
        collectOrigins(slotCuts, FeatureTag.SLOT, originToTag);
        cutTargets.push(slotCuts);
      }
    }

    // Label tabs
    if (!isSlotted) {
      checkCancelled(signal);
      const ltKey = `${shellKey}|${JSON.stringify(params.label)}|${innerW}|${innerD}|${interiorHeight}|${wallThickness}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
      let labelTabs = getFeatureCache('labelTabs', ltKey);
      if (!labelTabs) {
        labelTabs = buildLabelTabs(params, innerW, innerD, interiorHeight, wallThickness);
        if (labelTabs) {
          setFeatureCache('labelTabs', ltKey, labelTabs);
        }
      }
      if (labelTabs) {
        collectOrigins(labelTabs, FeatureTag.LABEL_TAB, originToTag);
        fuseTargets.push(labelTabs);
      }
    }

    // Scoop ramps
    if (!isSlotted) {
      checkCancelled(signal);
      const srKey = `${shellKey}|${JSON.stringify(params.scoop)}|${params.style}|${innerW}|${innerD}|${dim.wallHeight}|${wallThickness}|${hasLip}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
      let scoopRamps = getFeatureCache('scoopRamps', srKey);
      if (!scoopRamps) {
        scoopRamps = buildScoopRamps(params, innerW, innerD, dim.wallHeight, wallThickness);
        if (scoopRamps) {
          setFeatureCache('scoopRamps', srKey, scoopRamps);
        }
      }
      if (scoopRamps) {
        collectOrigins(scoopRamps, FeatureTag.SCOOP, originToTag);
        fuseTargets.push(scoopRamps);
      }
    }

    // Wall cutouts
    if (params.walls.enabled) {
      checkCancelled(signal);
      const wcKey = `${shellKey}|${JSON.stringify(params.walls)}|${innerW}|${innerD}|${dim.wallHeight}|${hasLip}|${params.compartments.cols}|${params.compartments.rows}|${params.compartments.cells.join(',')}`;
      let wallCutoutCuts = getFeatureCache('wallCutoutCuts', wcKey);
      if (!wallCutoutCuts) {
        wallCutoutCuts = buildWallCutoutCuts(params, innerW, innerD, dim.wallHeight, hasLip);
        if (wallCutoutCuts) {
          setFeatureCache('wallCutoutCuts', wcKey, wallCutoutCuts);
        }
      }
      if (wallCutoutCuts) {
        collectOrigins(wallCutoutCuts, FeatureTag.WALL_CUTOUT, originToTag);
        cutTargets.push(wallCutoutCuts);
      }
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
          let shapeTemplate: Shape3D;

          const cachedTemplate = getPatternTemplateCache(templateKey);
          if (cachedTemplate) {
            shapeTemplate = cachedTemplate;
          } else {
            const sides = calculator.getSidesCount();
            shapeTemplate = sketch(drawPolysides(shapeRadius, sides), 'XY').extrude(cutDepth);
            setPatternTemplateCache(templateKey, shapeTemplate);
          }

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
