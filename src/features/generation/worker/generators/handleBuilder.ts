/**
 * Handle ledge builder for Gridfinity bins.
 *
 * Generates interior handle ledges -- small shelves with concave fillet supports
 * protruding inward from bin walls. Each handle has two fused pieces:
 *
 * 1. Shelf plate: flat rectangular box at the top of the interior wall
 * 2. Fillet support: concave quarter-circle profile extruded along the shelf width
 *
 * When a wall also has a cutout enabled, the handle is split into segments
 * that flank the cutout region, preventing topology gaps from overlapping
 * boolean operations.
 */

import { draw, unwrap, fuse, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, HandleWallSide } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import { buildFilletProfile } from './filletProfile';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleSegments,
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
} from '@/shared/utils/handleCutoutClip';
import type { HandleSegment } from '@/shared/utils/handleCutoutClip';

/** Minimum shelf thickness for FDM printability (mm). */
const MIN_SHELF_THICKNESS = 2.0;

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly depthSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

/**
 * Build a single handle segment (shelf + fillet) at the given offset and width.
 */
function buildHandleSegment(
  segmentWidth: number,
  segmentOffset: number,
  effectiveDepth: number,
  effectiveFilletR: number,
  shelfThickness: number,
  interiorHeight: number,
  wall: WallDef
): Shape3D {
  // Shelf plate
  const shelfDrawing = draw([0, 0])
    .lineTo([segmentWidth, 0])
    .lineTo([segmentWidth, -effectiveDepth])
    .lineTo([0, -effectiveDepth])
    .close();
  const shelf = sketch(shelfDrawing, 'XY', 0).extrude(shelfThickness);

  // Fillet support
  const filletHeight = Math.min(effectiveFilletR, interiorHeight - shelfThickness);
  let solid: Shape3D;
  if (filletHeight > 0) {
    const filletProfile = buildFilletProfile(effectiveFilletR, filletHeight);
    const filletShape = sketch(filletProfile, 'YZ', 0).extrude(segmentWidth);
    solid = unwrap(fuse(shelf, filletShape));
  } else {
    solid = shelf;
  }

  // Center segment on wall at its offset position
  solid = translate(solid, [-segmentWidth / 2 + segmentOffset, 0, 0]);

  // Rotate to wall orientation
  if (wall.rotateZ !== 0) {
    solid = rotate(solid, wall.rotateZ, { axis: [0, 0, 1] });
  }

  // Position at wall, shelf top at interiorHeight
  solid = translate(solid, [wall.x, wall.y, interiorHeight - shelfThickness]);

  return solid;
}

/**
 * Build interior handle ledges for enabled walls.
 *
 * Each ledge is a flat shelf plate with a concave fillet support underneath,
 * positioned at the top of the bin interior wall. When a wall cutout overlaps
 * the handle region, the handle is split into segments that flank the cutout.
 *
 * @param params - Bin parameters (handles config, label config, walls config)
 * @param innerW - Interior width in mm
 * @param innerD - Interior depth in mm
 * @param interiorHeight - Interior wall height in mm (Z extent from floor to wall top)
 * @param wallThickness - Bin wall thickness in mm
 * @param _hasLip - Whether the bin has a stacking lip (reserved for future use)
 * @returns Fused handle geometry, or null if no handles are enabled
 */
export function buildHandles(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  _hasLip: boolean
): Shape3D | null {
  if (!params.handles.enabled) return null;

  const { depth, width, filletRadius } = params.handles;
  const shelfThickness = Math.max(wallThickness, MIN_SHELF_THICKNESS);

  // Each wall is positioned at its center (x, y) with the other axis at 0.
  // rotateZ maps the local shelf (-Y = depth direction) onto the bin interior.
  // After rotation, the local X extrusion axis aligns with the wall's span.
  const walls: readonly WallDef[] = [
    { side: 'front', wallSpan: innerW, depthSpan: innerD, x: 0, y: -innerD / 2, rotateZ: 180 },
    { side: 'back', wallSpan: innerW, depthSpan: innerD, x: 0, y: innerD / 2, rotateZ: 0 },
    { side: 'left', wallSpan: innerD, depthSpan: innerW, x: -innerW / 2, y: 0, rotateZ: 90 },
    { side: 'right', wallSpan: innerD, depthSpan: innerW, x: innerW / 2, y: 0, rotateZ: 270 },
  ];

  const allHandles: Shape3D[] = [];

  for (const wall of walls) {
    // Skip disabled sides
    if (!params.handles[wall.side].enabled) continue;

    // Back-wall suppression: skip back handle when label tabs are active
    if (wall.side === 'back' && params.label.enabled) continue;

    // Clamp depth so handle doesn't overlap the opposite wall
    const effectiveDepth = Math.min(depth, wall.depthSpan / 2 - wallThickness);
    if (effectiveDepth <= 0) continue;

    // Clamp fillet radius to fit within the effective depth
    const effectiveFilletR = Math.min(filletRadius, effectiveDepth * 0.7);

    // Compute segments (split around cutout if present on this wall)
    const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;
    let segments: HandleSegment[];

    if (wallCutout?.enabled) {
      const cutWidth =
        wallCutout.widthMm !== null
          ? Math.min(wallCutout.widthMm, wall.wallSpan)
          : wall.wallSpan * (wallCutout.width / 100);
      const cutCenter = computeCutoutCenter(
        wall.wallSpan,
        cutWidth,
        params.wallThickness,
        wallCutout.alignment,
        wallCutout.offset
      );
      segments = computeHandleSegments({
        wallSpan: wall.wallSpan,
        handleWidthPercent: width,
        cutoutCenter: cutCenter,
        cutoutWidth: cutWidth,
        clearance: CUTOUT_CLEARANCE,
        minSegmentWidth: MIN_SEGMENT_WIDTH,
      });
    } else {
      segments = [{ offset: 0, width: wall.wallSpan * (width / 100) }];
    }

    for (const seg of segments) {
      if (seg.width <= 0) continue;
      allHandles.push(
        buildHandleSegment(
          seg.width,
          seg.offset,
          effectiveDepth,
          effectiveFilletR,
          shelfThickness,
          interiorHeight,
          wall
        )
      );
    }
  }

  return fuseAllOrNull(allHandles);
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const handlesFeature: FeatureBuilder = {
  name: 'handles',
  tag: FeatureTag.HANDLE,
  target: 'fuse',
  shouldBuild: (ctx) => ctx.params.handles.enabled && !ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    // Only serialize per-side cutout fields that affect horizontal clipping
    // (enabled, width, widthMm, alignment, offset). Exclude shape/depth/interior
    // which don't affect handle splitting.
    const cutoutClipKey = params.walls.enabled
      ? (['front', 'back', 'left', 'right'] as const)
          .map((s) => {
            const c = params.walls[s];
            return c.enabled ? `${s}:${c.width},${c.widthMm},${c.alignment},${c.offset}` : '';
          })
          .filter(Boolean)
          .join('|')
      : '';
    return compactKey(
      buildCacheKey(
        'v2',
        dim.shellKey,
        stableSerialize(params.handles),
        cutoutClipKey,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        quantize(params.wallThickness),
        params.label.enabled,
        dim.hasLip
      )
    );
  },
  build: (ctx) => {
    const result = buildHandles(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.interiorHeight,
      ctx.params.wallThickness,
      ctx.dimensions.hasLip
    );
    return result ? [result] : null;
  },
};
