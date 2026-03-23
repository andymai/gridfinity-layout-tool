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
  buildSingleCutout,
} from '../../featureBuilder';
import { buildSlotCuts } from '../../slotBuilder';
import type { WallPatternDescriptor } from '../../wallPatterns';
import {
  getPatternDescriptors,
  CUTOUT_BORDER_WIDTH,
  getExpandedCutoutDimensions,
} from '../../wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

/**
 * Build a compound of positioned hex prisms for a single wall.
 *
 * Creates one transformCopy per hex center, then groups them with compound()
 * (O(n) topology grouping, not O(n²) fuseAll). Returns null if no elements.
 */
function buildWallPatternCompound(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number
): Shape3D | null {
  const elements: Shape3D[] = [];
  try {
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
        elements.push(transformCopy(shapeTemplate, trsf));
      } finally {
        trsf.cleanup();
      }
    }

    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0];

    const grouped = compound(elements);
    // Dispose individual handles — compound shares the underlying
    // OCCT TShape references, so the geometry stays alive.
    for (const el of elements) el.delete();
    return grouped;
  } catch (e: unknown) {
    for (const el of elements) el.delete();
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return null;
  }
}

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
  // getFeatureCache returns a clone (caller owns it), or null on miss.
  let shape = getFeatureCache(kind, key);
  if (!shape) {
    const built = build();
    if (built) {
      setFeatureCache(kind, key, built); // Cache owns the original
      shape = unwrap(clone(built)); // Clone for the targets array
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

    // Wall patterns — build per-wall compounds with caching.
    // Each wall gets its own compound and cache entry, so:
    // (a) unrelated param changes (label, color) don't rebuild hex geometry
    // (b) OCCT processes 4 smaller tool shapes instead of one massive compound
    //
    // When a wall also has a cutout, the hex compound is clipped by an expanded
    // cutout solid (cutout profile + CUTOUT_BORDER_WIDTH) to create a clean
    // solid border around the cutout opening.
    if (params.wallPattern.enabled) {
      const patternResult = getPatternDescriptors(params, innerW, innerD, interiorHeight);
      if (patternResult) {
        const { descriptors: wallDescriptors, calculator } = patternResult;
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
        let shapeTemplate = getPatternTemplateCache(templateKey);
        if (!shapeTemplate) {
          const sides = calculator.getSidesCount();
          shapeTemplate = sketch(drawPolysides(shapeRadius, sides), 'XY').extrude(cutDepth);
          setPatternTemplateCache(templateKey, shapeTemplate);
        }

        // Precompute wall spans for cutout clipping
        const wallSpanForSide: Record<string, number> = {
          front: innerW,
          back: innerW,
          left: innerD,
          right: innerD,
        };

        // Cutout clipping constants (loop-invariant)
        const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
        const maxThickness = Math.max(params.wallThickness, params.compartments.thickness);
        const clipExtrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
        const clipOvershoot = (hasLip ? LIP_HEIGHT : 0) + 2;

        for (const wall of wallDescriptors) {
          checkCancelled(signal);

          // Check if this wall's cutout should suppress or clip the pattern
          const cutoutCfg = params.walls.enabled ? params.walls[wall.side] : undefined;
          const wallSpan = wallSpanForSide[wall.side];

          // Compute cutout dimensions once (used for both suppression check and clipping)
          let cutWidth = 0;
          let userCutHeight = 0;
          let expandedWidth = 0;
          let expandedHeight = 0;
          if (cutoutCfg?.enabled) {
            cutWidth =
              cutoutCfg.widthMm !== null
                ? Math.min(cutoutCfg.widthMm, wallSpan)
                : wallSpan * (cutoutCfg.width / 100);
            const interiorWallHeight = dim.wallHeight - params.wallThickness;
            userCutHeight = interiorWallHeight * (cutoutCfg.depth / 100);

            const expanded = getExpandedCutoutDimensions(
              cutWidth,
              userCutHeight,
              CUTOUT_BORDER_WIDTH
            );
            expandedWidth = expanded.expandedWidth;
            expandedHeight = expanded.expandedHeight;

            // Full-width cutout: skip pattern entirely for this wall
            if (expandedWidth >= wallSpan) continue;
          }

          // Cache key captures everything that affects this wall's hex compound.
          // c0.x encodes fillW (wall span) which isn't in the translate values
          // for front/back walls. c0.y encodes fillH similarly. Together with
          // centers.length they uniquely identify the staggered grid layout.
          const c0 = wall.centers[0];

          // Include cutout config in cache key when clipping is active,
          // since the same hex grid produces different results with different cutouts.
          // Key on the effective width input only: either absolute mm or
          // percentage, not both. Avoids cache misses when the unused field
          // changes (e.g. width% while widthMm is set).
          const cutoutKeyPart = cutoutCfg?.enabled
            ? buildCacheKey(
                'clip',
                params.walls.shape,
                cutoutCfg.widthMm !== null ? 'mm' : 'pct',
                cutoutCfg.widthMm !== null
                  ? quantize(cutoutCfg.widthMm)
                  : quantize(cutoutCfg.width),
                quantize(cutoutCfg.depth),
                cutoutCfg.alignment,
                quantize(cutoutCfg.offset),
                hasLip,
                quantize(params.compartments.thickness),
                // wallThickness affects interiorWallHeight → userCutHeight and
                // computeCutoutCenter margin. Also covered by cutDepth in outer
                // key, but included explicitly for defensive cache correctness.
                quantize(params.wallThickness)
              )
            : 'noclip';

          const wallKey = compactKey(
            buildCacheKey(
              'v3',
              patternType,
              quantize(shapeRadius),
              quantize(cutDepth),
              wall.centers.length,
              quantize(c0.x),
              quantize(c0.y),
              quantize(wall.translateX),
              quantize(wall.translateY),
              quantize(wall.translateZ),
              wall.zRotation ?? 0,
              cutoutKeyPart
            )
          );

          cachedFeature(
            'wallPattern',
            wallKey,
            () => {
              const hexCompound = buildWallPatternCompound(shapeTemplate, wall, halfDepth);
              if (!hexCompound) return null;

              // Clip hex compound against expanded cutout if this wall has one
              if (!cutoutCfg?.enabled || cutWidth < 0.1 || userCutHeight < 0.1) {
                return hexCompound;
              }

              // Resolve cutout position -- use original cutWidth (not expanded) so
              // the clip solid is centered on the same anchor as the real cutout.
              const rotateZ = wall.side === 'left' || wall.side === 'right' ? 90 : 0;
              const centerOffset = computeCutoutCenter(
                wallSpan,
                cutWidth,
                params.wallThickness,
                cutoutCfg.alignment,
                cutoutCfg.offset
              );

              const clipSolid = buildSingleCutout(
                params.walls.shape,
                expandedWidth,
                expandedHeight,
                clipOvershoot,
                clipExtrudeDepth,
                dim.wallHeight,
                {
                  x: rotateZ === 0 ? wall.translateX + centerOffset : wall.translateX,
                  y: rotateZ !== 0 ? wall.translateY + centerOffset : wall.translateY,
                  rotateZ,
                }
              );

              try {
                const clipped = unwrap(cut(hexCompound, clipSolid));
                hexCompound.delete();
                return clipped;
              } catch (err: unknown) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                  hexCompound.delete();
                  throw err;
                }
                // Boolean cut can fail on edge cases; fall back to unclipped compound
                return hexCompound;
              } finally {
                clipSolid.delete();
              }
            },
            FeatureTag.WALL_PATTERN,
            originToTag,
            patternCutTargets
          );
        }
      }
    }

    return { ...ctx, fuseTargets, cutTargets, patternCutTargets };
  },
};
