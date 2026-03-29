/**
 * Corrugated wall geometry builder for Gridfinity bins.
 *
 * Replaces flat wall sections with sinusoidal corrugated profiles.
 * The wave folds inward (outer face stays at grid boundary), maintaining
 * uniform wall thickness along the sine curve.
 *
 * Returns { cut, fuse } pairs per wall:
 *   - cut: flat wall slab to remove from the shell
 *   - fuse: corrugated wall solid to add back
 *
 * Per-wall caching and cutout/handle/ramp clear-zone clipping are handled
 * similarly to wallPatternBuilder.ts.
 */

import { draw, drawRectangle, unwrap, cut, clone, translate, rotate } from 'brepjs';
import type { Shape3D, Drawing } from 'brepjs';
import type { PipelineContext } from './pipeline/types';
import { getSlotFreeWalls, CUTOUT_BORDER_WIDTH, getExpandedCutoutDimensions } from './wallPatterns';
import { LIP_HEIGHT, LIP_TAPER_WIDTH, COPLANAR_MARGIN } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { checkCancelled, isAbortError } from './utils/abort';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { computeRampZones } from './dividerBlendBuilder';
import { buildSingleCutout } from './featureBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import {
  buildHandleWallDefs,
  computeHandleHoleGeometry,
  computeWallHandleSegments,
  U_SHAPE_OVERSHOOT,
} from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { createCorrugatedSpec, generateInnerFacePoints } from './patterns/corrugatedPattern';
import type { CorrugatedWallSpec } from './patterns/corrugatedPattern';

/** Wall side identifier. */
type WallSide = 'front' | 'back' | 'left' | 'right';

/** Positioning data for a single wall face. */
interface WallPosition {
  readonly side: WallSide;
  readonly wallSpan: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly zRotation?: number;
}

/** A cut/fuse pair for one wall replacement. */
interface WallReplacePair {
  readonly cut: Shape3D;
  readonly fuse: Shape3D;
}

/**
 * Build a corrugated wall profile as a closed 2D drawing in the XZ plane.
 *
 * The profile represents the wall cross-section looking along the wall's
 * depth (perpendicular) axis:
 * - X axis = span position along the wall
 * - Z (mapped to Y in the drawing) = depth into wall from outer face
 *
 * Outer face is at Y=0 (flat line), inner face follows the sine wave.
 */
function buildCorrugatedProfile(spec: CorrugatedWallSpec): Drawing {
  const innerPoints = generateInnerFacePoints(spec);
  const halfSpan = spec.wallSpan / 2;

  // In the bin's coordinate system, walls extend outward (negative Y from
  // the inner face for the front wall). The profile Y axis is negated so
  // the geometry occupies the wall region, not the bin cavity.
  //
  // Y=0 = inner face (wall anchor point)
  // Y=-wallThickness = outer face (flat, at grid boundary)
  // Y=-wallThickness-amplitude = deepest corrugation point

  // Start at bottom-left of inner face
  let pen = draw([-halfSpan, 0]);

  // Inner face: left to right (flat line at Y=0, the inner face boundary)
  pen = pen.lineTo([halfSpan, 0]);

  // Right edge: step outward to outer sinusoidal face
  const lastInner = innerPoints[innerPoints.length - 1];
  pen = pen.lineTo([lastInner[0], -lastInner[1]]);

  // Outer face: right to left (sinusoidal wave, negated Y)
  for (let i = innerPoints.length - 2; i >= 0; i--) {
    pen = pen.lineTo([innerPoints[i][0], -innerPoints[i][1]]);
  }

  // Close: left edge back to start
  return pen.close();
}

/**
 * Build the corrugated wall solid for a single wall.
 *
 * Profile is sketched in XY plane at the bottom of the pattern zone,
 * then extruded upward by patternH. The profile's Y axis maps to the
 * wall's depth (perpendicular) direction.
 */
function buildCorrugatedSolid(spec: CorrugatedWallSpec, wallPos: WallPosition): Shape3D {
  const profile = buildCorrugatedProfile(spec);

  // Sketch in XY plane at Z=bottomZ, extrude upward by patternH
  let solid = sketch(profile, 'XY', spec.bottomZ).extrude(spec.patternH);

  // The profile is centered on the wall span. The Y axis in the profile
  // maps to the wall's perpendicular direction. For the front wall,
  // the outer face (Y=0) should be at -innerD/2 (the wall position).
  // We need to shift so outer face aligns with the wall's inner surface.

  // Rotate and translate to wall position
  if (wallPos.zRotation !== undefined) {
    solid = rotate(solid, wallPos.zRotation, { axis: [0, 0, 1] });
  }
  solid = translate(solid, [wallPos.translateX, wallPos.translateY, 0]);

  return solid;
}

/**
 * Build a flat wall slab that covers the corrugated zone.
 *
 * This slab is cut from the bin shell to remove the flat wall section
 * before the corrugated replacement is fused in.
 */
function buildFlatWallSlab(spec: CorrugatedWallSpec, wallPos: WallPosition): Shape3D {
  // The slab must be slightly oversized in depth to ensure a clean cut
  // through the entire wall thickness, and slightly oversized in Z
  // to avoid coplanar faces at the keep-out boundaries.
  const slabDepth = spec.wallThickness + spec.amplitude + COPLANAR_MARGIN;
  const slabHeight = spec.patternH + 2 * COPLANAR_MARGIN;

  const profile = drawRectangle(spec.wallSpan, slabDepth);
  let slab = sketch(profile, 'XY', spec.bottomZ - COPLANAR_MARGIN).extrude(slabHeight);

  // Position slab to cover the wall region in negative Y direction.
  // Y=0 = inner face, slab extends to -(wallThickness + amplitude + margin)
  slab = translate(slab, [0, -slabDepth / 2, 0]);

  if (wallPos.zRotation !== undefined) {
    slab = rotate(slab, wallPos.zRotation, { axis: [0, 0, 1] });
  }
  slab = translate(slab, [wallPos.translateX, wallPos.translateY, 0]);

  return slab;
}

/**
 * Apply clear-zone clipping to both corrugated and cut-slab shapes.
 *
 * Uses the same CUTOUT_BORDER_WIDTH clipping approach as wallPatternBuilder:
 * builds expanded clip solids around cutouts/handles/ramps and removes
 * those regions from both shapes (preserving flat wall at those locations).
 */
function applyClipZones(
  corrugated: Shape3D,
  cutSlab: Shape3D,
  wallPos: WallPosition,
  ctx: PipelineContext
): WallReplacePair | null {
  const { params, dimensions: dim } = ctx;
  let corrResult = corrugated;
  let cutResult = cutSlab;

  const cutoutCfg = params.walls.enabled ? params.walls[wallPos.side] : undefined;
  const { hasLip } = dim;
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const maxThickness = Math.max(params.wallThickness, params.compartments.thickness);
  const clipExtrudeDepth = (maxThickness + lipOverhang) * 2 + 1;
  const clipOvershoot = (hasLip ? LIP_HEIGHT : 0) + 2;

  // --- Cutout clear zone ---
  if (cutoutCfg?.enabled) {
    const cutWidth =
      cutoutCfg.widthMm !== null
        ? Math.min(cutoutCfg.widthMm, wallPos.wallSpan)
        : wallPos.wallSpan * (cutoutCfg.width / 100);
    const interiorWallHeight = dim.wallHeight - params.wallThickness;
    const userCutHeight = interiorWallHeight * (cutoutCfg.depth / 100);

    if (cutWidth >= 0.1 && userCutHeight >= 0.1) {
      const { expandedWidth, expandedHeight } = getExpandedCutoutDimensions(
        cutWidth,
        userCutHeight,
        CUTOUT_BORDER_WIDTH
      );

      // If expanded cutout covers the entire span, skip this wall entirely
      if (expandedWidth >= wallPos.wallSpan) {
        corrResult.delete();
        cutResult.delete();
        return null;
      }

      const rotateZ = wallPos.side === 'left' || wallPos.side === 'right' ? 90 : 0;
      const centerOffset = computeCutoutCenter(
        wallPos.wallSpan,
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
          x: rotateZ === 0 ? wallPos.translateX + centerOffset : wallPos.translateX,
          y: rotateZ !== 0 ? wallPos.translateY + centerOffset : wallPos.translateY,
          rotateZ,
        }
      );

      const clipClone = unwrap(clone(clipSolid));
      try {
        const clippedCorr = unwrap(cut(corrResult, clipSolid));
        corrResult.delete();
        corrResult = clippedCorr;
        const clippedCut = unwrap(cut(cutResult, clipClone));
        cutResult.delete();
        cutResult = clippedCut;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          corrResult.delete();
          cutResult.delete();
          throw err;
        }
      } finally {
        try {
          clipSolid.delete();
        } catch {
          /* already consumed or disposed */
        }
        try {
          clipClone.delete();
        } catch {
          /* already consumed or disposed */
        }
      }
    }
  }

  // --- Handle clear zone ---
  const { innerW, innerD, interiorHeight, isSlotted } = dim;
  const handleWallDefs = params.handles.enabled ? buildHandleWallDefs(innerW, innerD) : [];
  const handleWall = handleWallDefs.find((d) => d.side === wallPos.side);

  if (
    params.handles.enabled &&
    !isSlotted &&
    handleWall &&
    params.handles[wallPos.side]?.enabled &&
    !(wallPos.side === 'back' && params.label.enabled)
  ) {
    const isUShape = params.handles.shape === 'u-shape';
    const side = params.handles[wallPos.side];
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
      const handleCutoutCfg = params.walls.enabled ? params.walls[wallPos.side] : undefined;
      const baseSegments = computeWallHandleSegments(
        wallPos.wallSpan,
        sideWidth,
        params.wallThickness,
        handleCutoutCfg
      );

      if (baseSegments && baseSegments.length > 0) {
        const handleWidthMm = wallPos.wallSpan * (sideWidth / 100);
        const offsets = computeMultiHandleOffsets(
          params.handles.count,
          wallPos.wallSpan,
          handleWidthMm
        );

        const border = CUTOUT_BORDER_WIDTH;
        for (const handleOffset of offsets) {
          for (const seg of baseSegments) {
            const boxW = seg.width + 2 * border;
            const boxH = handleEffHeight + 2 * border;
            const profile = drawRectangle(boxW, boxH);
            let hbox = sketch(profile, 'XZ').extrude(clipExtrudeDepth);
            hbox = translate(hbox, [
              seg.offset + handleOffset,
              clipExtrudeDepth / 2,
              handleCenterZ,
            ]);
            if (handleWall.rotateZ !== 0) {
              hbox = rotate(hbox, handleWall.rotateZ, { axis: [0, 0, 1] });
            }
            hbox = translate(hbox, [handleWall.x, handleWall.y, 0]);

            const hboxClone = unwrap(clone(hbox));
            try {
              const clippedCorr = unwrap(cut(corrResult, hbox));
              corrResult.delete();
              corrResult = clippedCorr;
              const clippedCut = unwrap(cut(cutResult, hboxClone));
              cutResult.delete();
              cutResult = clippedCut;
            } catch (err: unknown) {
              if (isAbortError(err)) {
                corrResult.delete();
                cutResult.delete();
                throw err;
              }
            } finally {
              try {
                hbox.delete();
              } catch {
                /* already consumed or disposed */
              }
              try {
                hboxClone.delete();
              } catch {
                /* already consumed or disposed */
              }
            }
          }
        }
      }
    }
  }

  // --- Ramp zone clear zone ---
  const rampZones = computeRampZones(wallPos.side, params, innerW, innerD, dim.wallHeight);
  if (rampZones.length > 0) {
    const border = CUTOUT_BORDER_WIDTH;
    for (const zone of rampZones) {
      const rboxW = zone.width + 2 * border;
      const rboxH = zone.height + 2 * border;
      const profile = drawRectangle(rboxW, rboxH);
      let rbox = sketch(profile, 'XZ').extrude(clipExtrudeDepth);
      const centerZ = dim.wallHeight - zone.height / 2;
      rbox = translate(rbox, [zone.offsetAlongWall, clipExtrudeDepth / 2, centerZ]);
      if (wallPos.zRotation !== undefined) {
        rbox = rotate(rbox, wallPos.zRotation, { axis: [0, 0, 1] });
      }
      rbox = translate(rbox, [wallPos.translateX, wallPos.translateY, 0]);

      const rboxClone = unwrap(clone(rbox));
      try {
        const clippedCorr = unwrap(cut(corrResult, rbox));
        corrResult.delete();
        corrResult = clippedCorr;
        const clippedCut = unwrap(cut(cutResult, rboxClone));
        cutResult.delete();
        cutResult = clippedCut;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          corrResult.delete();
          cutResult.delete();
          throw err;
        }
      } finally {
        try {
          rbox.delete();
        } catch {
          /* already consumed or disposed */
        }
        try {
          rboxClone.delete();
        } catch {
          /* already consumed or disposed */
        }
      }
    }
  }

  return { cut: cutResult, fuse: corrResult };
}

/**
 * Build corrugated wall replacements for all eligible walls.
 *
 * Returns arrays of cut/fuse shape pairs to be applied in the boolean stage.
 */
export function buildCorrugatedWalls(ctx: PipelineContext): { cuts: Shape3D[]; fuses: Shape3D[] } {
  const { params, dimensions: dim, signal, originToTag } = ctx;
  const { innerW, innerD, wallHeight } = dim;
  const cuts: Shape3D[] = [];
  const fuses: Shape3D[] = [];

  const slotFree = getSlotFreeWalls(params);

  const wallPositions: WallPosition[] = [];
  if (slotFree.front)
    wallPositions.push({ side: 'front', wallSpan: innerW, translateX: 0, translateY: -innerD / 2 });
  if (slotFree.back)
    wallPositions.push({
      side: 'back',
      wallSpan: innerW,
      translateX: 0,
      translateY: innerD / 2,
      zRotation: 180,
    });
  if (slotFree.left)
    wallPositions.push({
      side: 'left',
      wallSpan: innerD,
      translateX: -innerW / 2,
      translateY: 0,
      zRotation: 90,
    });
  if (slotFree.right)
    wallPositions.push({
      side: 'right',
      wallSpan: innerD,
      translateX: innerW / 2,
      translateY: 0,
      zRotation: -90,
    });

  for (const wallPos of wallPositions) {
    checkCancelled(signal);

    const spec = createCorrugatedSpec(
      params.wallThickness,
      wallHeight,
      wallPos.wallSpan,
      params.height
    );
    if (!spec) continue;

    // Cache key
    const wallKey = compactKey(
      buildCacheKey(
        'v1',
        'corrugated',
        quantize(spec.amplitude),
        quantize(spec.wavelength),
        quantize(spec.patternH),
        quantize(spec.bottomZ),
        quantize(spec.wallSpan),
        quantize(spec.wallThickness),
        spec.waveCount,
        quantize(wallPos.translateX),
        quantize(wallPos.translateY),
        wallPos.zRotation ?? 0,
        // Include cutout/handle config in cache key for clear zones
        params.walls.enabled && params.walls[wallPos.side]?.enabled
          ? buildCacheKey(
              'clip',
              params.walls.shape,
              quantize(params.walls[wallPos.side].width),
              quantize(params.walls[wallPos.side].depth),
              params.walls[wallPos.side].alignment,
              quantize(params.walls[wallPos.side].offset)
            )
          : 'noclip',
        params.handles.enabled && params.handles[wallPos.side]?.enabled
          ? buildCacheKey(
              'hdl',
              params.handles.shape,
              params.handles.count,
              quantize(params.handles[wallPos.side].width ?? params.handles.width),
              quantize(params.handles[wallPos.side].height ?? params.handles.height),
              quantize(params.handles.verticalPosition ?? 0)
            )
          : 'nohdl'
      )
    );

    // Check cache — cache stores [cutShape, fuseShape] as a compound
    const cachedFuse = getFeatureCache('corrugatedWall', wallKey);
    const cachedCut = getFeatureCache('corrugatedCut', wallKey);
    if (cachedFuse && cachedCut) {
      const fuseClone = unwrap(clone(cachedFuse));
      const cutClone = unwrap(clone(cachedCut));
      collectOrigins(fuseClone, FeatureTag.WALL_PATTERN, originToTag);
      fuses.push(fuseClone);
      cuts.push(cutClone);
      continue;
    }

    // Build fresh
    try {
      const corrugated = buildCorrugatedSolid(spec, wallPos);
      const cutSlab = buildFlatWallSlab(spec, wallPos);
      const pair = applyClipZones(corrugated, cutSlab, wallPos, ctx);

      if (pair) {
        // Cache the originals, return clones
        setFeatureCache('corrugatedWall', wallKey, pair.fuse);
        setFeatureCache('corrugatedCut', wallKey, pair.cut);
        const fuseClone = unwrap(clone(pair.fuse));
        const cutClone = unwrap(clone(pair.cut));
        collectOrigins(fuseClone, FeatureTag.WALL_PATTERN, originToTag);
        fuses.push(fuseClone);
        cuts.push(cutClone);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
      // On geometry failure, skip this wall silently
    }
  }

  return { cuts, fuses };
}
