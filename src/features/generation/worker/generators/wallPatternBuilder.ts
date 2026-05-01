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
 * Sub-modules:
 *   - `wallPatternTypes`     — shared interfaces + cache name constants
 *   - `wallPatternCompound`  — per-wall hex compound construction + caching
 *   - `wallPatternClips`     — cutout/handle/ramp clipping passes
 */

import { drawPolysides, unwrap, clone } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { checkCancelled } from './utils/abort';
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
import { computeRampZones, computeDividerJunctionZones } from './dividerBlendBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import {
  buildHandleWallDefs,
  computeHandleHoleGeometry,
  computeWallHandleSegments,
  U_SHAPE_OVERSHOOT,
} from '@/shared/utils/handleCutoutClip';
import type { HandleSegment, HandleWallDef } from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolvePolygonSideGeometry } from './maskPolygonEdges';
import {
  WALL_PATTERN_CLIPPED_CACHE,
  type CutoutClipParams,
  type HandleClipParams,
  type RampZoneClipParams,
} from './wallPatternTypes';
import { buildClippedWallPattern } from './wallPatternCompound';

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

  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const maxThickness = Math.max(params.wallThickness, params.compartments.thickness);
  // Clip boxes must be at least as deep as the hex prism extrusion (cutDepth)
  // so they fully envelop hex prisms at junction/cutout boundaries (#1354).
  const clipExtrudeDepth = Math.max((maxThickness + lipOverhang) * 2 + 1, cutDepth + 1);
  const clipOvershoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  // Build handle wall defs for clip positioning. Polygon bins use the
  // outermost edge per cardinal (matches handleBuilder), so clip boxes land
  // on the actual handle cutout location rather than the AABB wall center.
  const cellMask = params.cellMask;
  const isPolygon = isPartialMask(cellMask);
  const handleWallDefs: readonly HandleWallDef[] = !params.handles.enabled
    ? []
    : isPolygon
      ? (['front', 'back', 'left', 'right'] as const)
          .map((side) => {
            const geom = resolvePolygonSideGeometry(
              cellMask,
              params.gridUnitMm,
              params.wallThickness,
              side
            );
            return geom
              ? ({
                  side,
                  wallSpan: geom.wallSpan,
                  x: geom.x,
                  y: geom.y,
                  rotateZ: geom.rotateZ,
                } satisfies HandleWallDef)
              : null;
          })
          .filter((w): w is HandleWallDef => w !== null)
      : buildHandleWallDefs(innerW, innerD);
  const handleWallDefForSide = new Map(handleWallDefs.map((d) => [d.side, d]));

  for (const wall of wallDescriptors) {
    checkCancelled(signal);

    // Polygon non-outermost edges: no cutout/handle/ramp lives there, so
    // emit pure pattern without any clip lookup. Prevents a cardinal-side
    // cutout/handle config from being projected onto an inner step wall.
    const cutoutCfg = wall.allowClip && params.walls.enabled ? params.walls[wall.side] : undefined;
    const wallSpan = wall.wallSpan;

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

    const clip: CutoutClipParams | null = cutoutCfg?.enabled
      ? {
          cutoutCfg,
          cutWidth,
          userCutHeight,
          expandedWidth,
          expandedHeight,
          clipOvershoot,
          clipExtrudeDepth,
          wallHeight: dim.wallHeight,
          wallSpan,
          wallShape: params.walls.shape,
          wallThickness: params.wallThickness,
        }
      : null;

    // Handle border clipping
    let handleClip: HandleClipParams | null = null;
    const handleWall = handleWallDefForSide.get(wall.side);
    if (
      wall.allowClip &&
      params.handles.enabled &&
      !dim.isSlotted &&
      handleWall &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Record<Side, HandleSide> is exhaustive in the type system, but legacy persisted configs may have missing keys
      params.handles[wall.side]?.enabled &&
      !(wall.side === 'back' && params.label.enabled)
    ) {
      const isUShape = params.handles.shape === 'u-shape';
      const side = params.handles[wall.side];
      const sideHeight = side.height ?? params.handles.height;
      const sideWidth = side.width ?? params.handles.width;

      let handleCenterZ: number;
      let handleEffHeight: number;
      if (isUShape) {
        const clampedHeight = Math.min(sideHeight, interiorHeight);
        handleEffHeight = clampedHeight + U_SHAPE_OVERSHOOT;
        handleCenterZ = (clampedHeight - U_SHAPE_OVERSHOOT) / 2;
      } else {
        const geom = computeHandleHoleGeometry(
          interiorHeight,
          sideHeight,
          params.handles.verticalPosition
        );
        handleCenterZ = geom.centerZ;
        handleEffHeight = geom.effectiveHeight;
      }

      if (handleEffHeight >= 1) {
        const handleCutoutCfg = params.walls.enabled ? params.walls[wall.side] : undefined;
        const baseSegments = computeWallHandleSegments(
          wallSpan,
          sideWidth,
          params.wallThickness,
          handleCutoutCfg
        );
        if (baseSegments && baseSegments.length > 0) {
          // Expand segments with multi-handle offsets
          const handleWidthMm = wallSpan * (sideWidth / 100);
          const offsets = computeMultiHandleOffsets(params.handles.count, wallSpan, handleWidthMm);
          const expandedSegments: HandleSegment[] = [];
          for (const handleOffset of offsets) {
            for (const seg of baseSegments) {
              expandedSegments.push({ offset: seg.offset + handleOffset, width: seg.width });
            }
          }
          if (expandedSegments.length > 0) {
            handleClip = {
              segments: expandedSegments,
              effectiveHeight: handleEffHeight,
              centerZ: handleCenterZ,
              clipExtrudeDepth,
              handleWall,
            };
          }
        }
      }
    }

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

    const handleKeyPart = handleClip
      ? buildCacheKey(
          'hdl',
          params.handles.shape,
          params.handles.count,
          quantize(handleClip.centerZ),
          quantize(handleClip.effectiveHeight),
          handleClip.segments.map((s) => `${quantize(s.offset)}:${quantize(s.width)}`).join(',')
        )
      : 'nohdl';

    // Ramp zone clipping for divider-cutout blends + divider junction blocking (#1345).
    // Polygon bins skip both: dividers are filtered out of the feature pipeline
    // on custom shapes so there's nothing to blend against or block.
    const rampZones = isPolygon
      ? []
      : computeRampZones(wall.side, params, innerW, innerD, dim.wallHeight);
    const junctionZones = isPolygon
      ? []
      : computeDividerJunctionZones(wall.side, params, innerW, innerD, dim.wallHeight);
    // Deduplicate: junction zones (full height) subsume ramp zones at the same offset
    const junctionOffsets = new Set(junctionZones.map((z) => quantize(z.offsetAlongWall)));
    const uniqueRampZones = rampZones.filter(
      (z) => !junctionOffsets.has(quantize(z.offsetAlongWall))
    );
    const combinedZones = [...uniqueRampZones, ...junctionZones];
    // Ensure border is at least shapeRadius so hex prisms can't bleed into divider walls (#1350).
    const zoneBorder = Math.max(CUTOUT_BORDER_WIDTH, shapeRadius);
    const rampClip: RampZoneClipParams | null =
      combinedZones.length > 0
        ? {
            zones: combinedZones,
            clipExtrudeDepth,
            wallHeight: dim.wallHeight,
            border: zoneBorder,
          }
        : null;

    const rampKeyPart = rampClip
      ? buildCacheKey(
          'ramp',
          rampClip.zones
            .map((z) => `${quantize(z.offsetAlongWall)}:${quantize(z.width)}:${quantize(z.height)}`)
            .join(',')
        )
      : 'noramp';

    // Base-compound key: wall geometry + pattern template only. Cutout/handle/
    // ramp nudges MUST NOT affect this key so the expensive hex compound is
    // reused across parameter tweaks (#1422).
    const baseKey = compactKey(
      buildCacheKey(
        'v1',
        patternType,
        quantize(shapeRadius),
        quantize(cutDepth),
        wall.centers.length,
        quantize(c0.x),
        quantize(c0.y),
        quantize(wall.translateX),
        quantize(wall.translateY),
        quantize(wall.translateZ),
        wall.zRotation ?? 0
      )
    );

    // Clipped-result key: derived from baseKey so cache entries for different
    // wall geometries can't collide via matching clip params.
    const clippedKey = compactKey(
      buildCacheKey('v1', baseKey, cutoutKeyPart, handleKeyPart, rampKeyPart)
    );

    let shape = getFeatureCache(WALL_PATTERN_CLIPPED_CACHE, clippedKey);
    if (!shape) {
      const built = buildClippedWallPattern(
        shapeTemplate,
        wall,
        halfDepth,
        baseKey,
        clip,
        handleClip,
        rampClip
      );
      if (built) {
        setFeatureCache(WALL_PATTERN_CLIPPED_CACHE, clippedKey, built);
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
