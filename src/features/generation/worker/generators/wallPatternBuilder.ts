/**
 * Wall pattern geometry builder for Gridfinity bins.
 *
 * Builds per-wall hex pattern compounds with individual caching and
 * optional cutout clipping. NOT a FeatureBuilder — wall patterns have
 * per-wall caching, a separate pattern template cache, and cutout
 * clipping logic that don't fit the single cacheKey/build interface.
 *
 * Called as a special case after the generic feature runner in featuresStage.
 *
 * Extracted from featuresStage.ts for code organization; the actual
 * migration to use this module happens in Phase 4.
 */

import {
  drawPolysides,
  unwrap,
  cut,
  clone,
  compound,
  composeTransforms,
  transformCopy,
} from 'brepjs';
import type { Shape3D, TransformOp } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import type { WallPatternDescriptor } from './wallPatterns';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { checkCancelled, isAbortError } from './utils/abort';
import {
  getFeatureCache,
  setFeatureCache,
  getPatternTemplateCache,
  setPatternTemplateCache,
} from './shapeCache';
import {
  getPatternDescriptors,
  CUTOUT_BORDER_WIDTH,
  getExpandedCutoutDimensions,
} from './wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { buildSingleCutout } from './featureBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';

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
    for (const el of elements) el.delete();
    return grouped;
  } catch (e: unknown) {
    for (const el of elements) el.delete();
    if (isAbortError(e)) throw e;
    return null;
  }
}

/**
 * Build wall pattern shapes for all walls with per-wall caching
 * and optional cutout clipping.
 *
 * Returns shapes to be pushed into patternCutTargets. Each shape
 * is a clone owned by the caller (cache owns the originals).
 */
export function buildWallPatterns(ctx: PipelineContext): Shape3D[] {
  const { params, dimensions: dim, signal, originToTag } = ctx;
  const { innerW, innerD, interiorHeight, hasLip } = dim;
  const patternCutTargets: Shape3D[] = [];

  const patternResult = getPatternDescriptors(params, innerW, innerD, interiorHeight);
  if (!patternResult) return patternCutTargets;

  const { descriptors: wallDescriptors, calculator } = patternResult;
  const cutDepth = params.wallThickness * 4;
  const halfDepth = cutDepth / 2;
  const patternType = calculator.getPatternType();
  const shapeRadius = calculator.getShapeRadius();

  const templateKey = buildCacheKey('v1', patternType, quantize(shapeRadius), quantize(cutDepth));
  let shapeTemplate = getPatternTemplateCache(templateKey);
  if (!shapeTemplate) {
    const sides = calculator.getSidesCount();
    shapeTemplate = sketch(drawPolysides(shapeRadius, sides), 'XY').extrude(cutDepth);
    setPatternTemplateCache(templateKey, shapeTemplate);
  }

  const wallSpanForSide: Record<string, number> = {
    front: innerW,
    back: innerW,
    left: innerD,
    right: innerD,
  };

  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const maxThickness = Math.max(params.wallThickness, params.compartments.thickness);
  const clipExtrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
  const clipOvershoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  for (const wall of wallDescriptors) {
    checkCancelled(signal);

    const cutoutCfg = params.walls.enabled ? params.walls[wall.side] : undefined;
    const wallSpan = wallSpanForSide[wall.side];

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

      const expanded = getExpandedCutoutDimensions(cutWidth, userCutHeight, CUTOUT_BORDER_WIDTH);
      expandedWidth = expanded.expandedWidth;
      expandedHeight = expanded.expandedHeight;

      if (expandedWidth >= wallSpan) continue;
    }

    const c0 = wall.centers[0];

    const cutoutKeyPart = cutoutCfg?.enabled
      ? buildCacheKey(
          'clip',
          params.walls.shape,
          cutoutCfg.widthMm !== null ? 'mm' : 'pct',
          cutoutCfg.widthMm !== null ? quantize(cutoutCfg.widthMm) : quantize(cutoutCfg.width),
          quantize(cutoutCfg.depth),
          cutoutCfg.alignment,
          quantize(cutoutCfg.offset),
          hasLip,
          quantize(params.compartments.thickness),
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

    // Use the existing cachedFeature-style pattern: cache owns original, caller gets clone
    let shape = getFeatureCache('wallPattern', wallKey);
    if (!shape) {
      const built = buildWallPatternShape(
        shapeTemplate,
        wall,
        halfDepth,
        cutoutCfg,
        cutWidth,
        userCutHeight,
        expandedWidth,
        expandedHeight,
        clipOvershoot,
        clipExtrudeDepth,
        dim.wallHeight,
        wallSpan,
        params
      );
      if (built) {
        setFeatureCache('wallPattern', wallKey, built);
        shape = unwrap(clone(built));
      }
    }
    if (shape) {
      collectOrigins(shape, FeatureTag.WALL_PATTERN, originToTag);
      patternCutTargets.push(shape);
    }
  }

  return patternCutTargets;
}

/** Build a single wall's pattern compound with optional cutout clipping. */
function buildWallPatternShape(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  cutoutCfg:
    | {
        enabled: boolean;
        widthMm: number | null;
        width: number;
        depth: number;
        alignment: 'left' | 'center' | 'right';
        offset: number;
      }
    | undefined,
  cutWidth: number,
  userCutHeight: number,
  expandedWidth: number,
  expandedHeight: number,
  clipOvershoot: number,
  clipExtrudeDepth: number,
  wallHeight: number,
  wallSpan: number,
  params: PipelineContext['params']
): Shape3D | null {
  const hexCompound = buildWallPatternCompound(shapeTemplate, wall, halfDepth);
  if (!hexCompound) return null;

  if (!cutoutCfg?.enabled || cutWidth < 0.1 || userCutHeight < 0.1) {
    return hexCompound;
  }

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
    wallHeight,
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
    if (isAbortError(err)) {
      hexCompound.delete();
      throw err;
    }
    return hexCompound;
  } finally {
    clipSolid.delete();
  }
}
