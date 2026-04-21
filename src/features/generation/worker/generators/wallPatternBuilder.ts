/**
 * Wall pattern geometry builder for Gridfinity bins.
 *
 * Builds per-wall hex pattern compounds with individual caching and
 * optional cutout clipping. NOT a FeatureBuilder — wall patterns have
 * per-wall caching, a separate pattern template cache, and cutout
 * clipping logic that don't fit the single cacheKey/build interface.
 *
 * Called as a special case after the generic feature runner in featuresStage.
 */

import {
  drawPolysides,
  drawRectangle,
  unwrap,
  cut,
  fuse,
  clone,
  compound,
  composeTransforms,
  transformCopy,
  translate,
  rotate,
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
import { computeRampZones, computeDividerJunctionZones } from './dividerBlendBuilder';
import type { RampZone } from './dividerBlendBuilder';
import type { WallCutoutShape } from '@/shared/types/bin';
import { buildSingleCutout } from './featureBuilder';
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

/**
 * Build a compound of positioned hex prisms for a single wall.
 *
 * Creates one transformCopy per hex center, then groups them with compound()
 * (O(n) topology grouping, not O(n²) fuseAll). Returns null if no elements.
 *
 * This is the expensive part of wall pattern construction (up to ~1000 hex
 * prisms on tall, wide bins). The result is cached in
 * `feature-wallPatternBase` keyed on wall geometry only, so cutout/handle/ramp
 * clip-parameter nudges don't force a rebuild — see buildWallPatterns.
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

/** Cache name for the uncut per-wall hex compound (shared across cutout/handle/ramp nudges). */
const WALL_PATTERN_BASE_CACHE = 'wallPatternBase';
/** Cache name for the post-clip per-wall compound (varies with cutout/handle/ramp params). */
const WALL_PATTERN_CLIPPED_CACHE = 'wallPatternClipped';

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

/**
 * Return the base (uncut) hex compound for a wall, cached by wall geometry.
 *
 * The caller receives an owned clone; the cache retains the original. When the
 * compound has no clips to apply, the clipped pipeline will cache this same
 * clone directly — two cache hits for the price of one.
 */
function getCachedBaseCompound(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  baseKey: string
): Shape3D | null {
  const cached = getFeatureCache(WALL_PATTERN_BASE_CACHE, baseKey);
  if (cached) return cached;

  const built = buildWallPatternCompound(shapeTemplate, wall, halfDepth);
  if (!built) return null;
  setFeatureCache(WALL_PATTERN_BASE_CACHE, baseKey, built);
  return unwrap(clone(built));
}

/**
 * Build a fully-clipped wall pattern by cloning the cached base compound and
 * applying cutout, handle, and ramp-zone cuts. Returns null when the base
 * compound can't be built (degenerate wall).
 */
function buildClippedWallPattern(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  baseKey: string,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null,
  rampClip: RampZoneClipParams | null
): Shape3D | null {
  const base = getCachedBaseCompound(shapeTemplate, wall, halfDepth, baseKey);
  if (!base) return null;
  return applyWallPatternClips(base, wall, clip, handleClip, rampClip);
}

/** Pre-computed cutout clipping parameters passed to buildWallPatternShape. */
interface CutoutClipParams {
  readonly cutoutCfg: {
    enabled: boolean;
    widthMm: number | null;
    width: number;
    depth: number;
    alignment: 'left' | 'center' | 'right';
    offset: number;
  };
  readonly cutWidth: number;
  readonly userCutHeight: number;
  readonly expandedWidth: number;
  readonly expandedHeight: number;
  readonly clipOvershoot: number;
  readonly clipExtrudeDepth: number;
  readonly wallHeight: number;
  readonly wallSpan: number;
  readonly wallShape: WallCutoutShape;
  readonly wallThickness: number;
}

/** Pre-computed handle clipping parameters for a single wall. */
interface HandleClipParams {
  readonly segments: HandleSegment[];
  readonly effectiveHeight: number;
  readonly centerZ: number;
  readonly clipExtrudeDepth: number;
  /** Handle wall positioning (uses handleBuilder convention, not pattern descriptor). */
  readonly handleWall: HandleWallDef;
}

/** Pre-computed ramp zone clipping parameters for a single wall. */
interface RampZoneClipParams {
  readonly zones: readonly RampZone[];
  readonly clipExtrudeDepth: number;
  readonly wallHeight: number;
  /** Border width for clip boxes — max(CUTOUT_BORDER_WIDTH, shapeRadius)
   *  so hex prisms don't extend into divider walls at junctions. */
  readonly border: number;
}

/**
 * Apply optional cutout/handle/ramp clipping to an owned base hex compound.
 *
 * Takes ownership of `base` and returns either `base` itself (no clips) or a
 * new shape with `base` disposed. Callers must not reuse the original handle.
 */
function applyWallPatternClips(
  base: Shape3D,
  wall: WallPatternDescriptor,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null,
  rampClip: RampZoneClipParams | null
): Shape3D | null {
  // --- Cutout border clipping ---
  let result = base;
  if (clip && clip.cutWidth >= 0.1 && clip.userCutHeight >= 0.1) {
    const rotateZ = wall.side === 'left' || wall.side === 'right' ? 90 : 0;
    const centerOffset = computeCutoutCenter(
      clip.wallSpan,
      clip.cutWidth,
      clip.wallThickness,
      clip.cutoutCfg.alignment,
      clip.cutoutCfg.offset
    );

    const clipSolid = buildSingleCutout(
      clip.wallShape,
      clip.expandedWidth,
      clip.expandedHeight,
      clip.clipOvershoot,
      clip.clipExtrudeDepth,
      clip.wallHeight,
      {
        x: rotateZ === 0 ? wall.translateX + centerOffset : wall.translateX,
        y: rotateZ !== 0 ? wall.translateY + centerOffset : wall.translateY,
        rotateZ,
      }
    );

    try {
      const clipped = unwrap(cut(result, clipSolid));
      result.delete();
      result = clipped;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
      // On non-abort failure, keep result as-is
    } finally {
      clipSolid.delete();
    }
  }

  // --- Handle border clipping ---
  if (handleClip && handleClip.segments.length > 0) {
    const border = CUTOUT_BORDER_WIDTH;
    const clipBoxes: Shape3D[] = [];

    const hw = handleClip.handleWall;
    try {
      for (const seg of handleClip.segments) {
        const boxW = seg.width + 2 * border;
        const boxH = handleClip.effectiveHeight + 2 * border;
        const profile = drawRectangle(boxW, boxH);
        // Each transform allocates a new WASM handle while the previous
        // becomes garbage. Dispose the intermediates explicitly so only
        // the final handle survives in clipBoxes.
        const extruded = sketch(profile, 'XZ').extrude(handleClip.clipExtrudeDepth);
        const centered = translate(extruded, [
          seg.offset,
          handleClip.clipExtrudeDepth / 2,
          handleClip.centerZ,
        ]);
        extruded.delete();
        let hbox = centered;
        if (hw.rotateZ !== 0) {
          const rotated = rotate(hbox, hw.rotateZ, { axis: [0, 0, 1] });
          hbox.delete();
          hbox = rotated;
        }
        const positioned = translate(hbox, [hw.x, hw.y, 0]);
        hbox.delete();
        clipBoxes.push(positioned);
      }

      let handleClipSolid: Shape3D;
      if (clipBoxes.length === 1) {
        handleClipSolid = clipBoxes[0];
      } else {
        handleClipSolid = unwrap(fuse(clipBoxes[0], clipBoxes[1]));
        clipBoxes[0].delete();
        clipBoxes[1].delete();
        for (let i = 2; i < clipBoxes.length; i++) {
          const merged = unwrap(fuse(handleClipSolid, clipBoxes[i]));
          handleClipSolid.delete();
          clipBoxes[i].delete();
          handleClipSolid = merged;
        }
      }

      try {
        const handleClipped = unwrap(cut(result, handleClipSolid));
        result.delete();
        result = handleClipped;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          result.delete();
          throw err;
        }
        // On non-abort failure, keep result as-is
      } finally {
        handleClipSolid.delete();
      }
    } catch (err: unknown) {
      for (const b of clipBoxes) {
        try {
          b.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
    }
  }

  // --- Ramp zone border clipping ---
  if (rampClip && rampClip.zones.length > 0) {
    const { border, clipExtrudeDepth: rampExtrudeDepth, wallHeight, zones } = rampClip;
    const rampBoxes: Shape3D[] = [];

    try {
      for (const zone of zones) {
        const rboxW = zone.width + 2 * border;
        const rboxH = zone.height + 2 * border;
        const profile = drawRectangle(rboxW, rboxH);
        // Dispose intermediates from each transform.
        const extruded = sketch(profile, 'XZ').extrude(rampExtrudeDepth);
        const centerZ = wallHeight - zone.height / 2;
        const centered = translate(extruded, [zone.offsetAlongWall, rampExtrudeDepth / 2, centerZ]);
        extruded.delete();
        let rbox = centered;
        if (wall.zRotation !== undefined) {
          const rotated = rotate(rbox, wall.zRotation, { axis: [0, 0, 1] });
          rbox.delete();
          rbox = rotated;
        }
        const positioned = translate(rbox, [wall.translateX, wall.translateY, 0]);
        rbox.delete();
        rampBoxes.push(positioned);
      }

      if (rampBoxes.length > 0) {
        let rampClipSolid = rampBoxes[0];
        for (let i = 1; i < rampBoxes.length; i++) {
          const merged = unwrap(fuse(rampClipSolid, rampBoxes[i]));
          rampClipSolid.delete();
          rampBoxes[i].delete();
          rampClipSolid = merged;
        }

        try {
          const rampClipped = unwrap(cut(result, rampClipSolid));
          result.delete();
          result = rampClipped;
        } catch (err: unknown) {
          if (isAbortError(err)) {
            result.delete();
            throw err;
          }
        } finally {
          rampClipSolid.delete();
        }
      }
    } catch (err: unknown) {
      for (const b of rampBoxes) {
        try {
          b.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
    }
  }

  return result;
}
