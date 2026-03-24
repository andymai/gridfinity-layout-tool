/**
 * Handle hole builder for Gridfinity bins.
 *
 * Generates through-hole cutouts in bin walls as finger grips.
 * Each hole is a rounded rectangle (controlled by cornerRadius)
 * extruded through the full wall thickness, positioned at 70%
 * of the interior wall height.
 *
 * When a wall also has a cutout enabled, the hole is split into
 * segments that flank the cutout region via computeHandleSegments().
 */

import { drawRoundedRectangle, drawRectangle, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, HandleWallSide } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleSegments,
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
  HOLE_VERTICAL_CENTER,
} from '@/shared/utils/handleCutoutClip';
import type { HandleSegment } from '@/shared/utils/handleCutoutClip';
import { LIP_TAPER_WIDTH } from './generatorConstants';

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

/**
 * Build a single hole cut solid for one segment.
 *
 * Sketches a rounded rectangle on XZ (width × height), extrudes through
 * the wall, and positions at the correct wall location and Z height.
 */
function buildHoleCut(
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: WallDef
): Shape3D {
  // Clamp corner radius to half of smallest dimension
  const safeR = Math.min(cornerRadius, segmentWidth / 2 - 0.01, holeHeight / 2 - 0.01);

  // 2D profile: rounded rectangle (or plain if radius too small)
  const profile =
    safeR > 0.1
      ? drawRoundedRectangle(segmentWidth, holeHeight, safeR)
      : drawRectangle(segmentWidth, holeHeight);

  // Sketch on XZ plane, extrude along -Y (through wall)
  let shape = sketch(profile, 'XZ').extrude(extrudeDepth);

  // Center extrusion around Y=0 so it straddles the wall face
  shape = translate(shape, [segmentOffset, extrudeDepth / 2, centerZ]);

  // Rotate to wall orientation
  if (wall.rotateZ !== 0) {
    shape = rotate(shape, wall.rotateZ, { axis: [0, 0, 1] });
  }

  // Translate to wall position
  return translate(shape, [wall.x, wall.y, 0]);
}

/**
 * Build handle hole cuts for all enabled walls.
 *
 * @returns Fused cut geometry (all holes merged), or null if none enabled
 */
export function buildHandleHoles(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.handles.enabled) return null;

  const { width, height, cornerRadius } = params.handles;
  if (height <= 0) return null;

  // Extrude depth: must fully penetrate the wall (+ lip overhang if present)
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (wallThickness + lipOverhang) * 2 + 1;

  // Vertical center at 70% of interior height
  const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;

  // Clamp hole height so it stays within wall bounds around centerZ
  const margin = interiorHeight * 0.1;
  const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
  const effectiveHeight = Math.min(height, maxHalfHeight * 2);
  if (effectiveHeight < 1) return null;

  const walls: readonly WallDef[] = [
    { side: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
    { side: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
    { side: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
    { side: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
  ];

  const allHoles: Shape3D[] = [];

  for (const wall of walls) {
    if (!params.handles[wall.side].enabled) continue;

    // Back-wall suppression when label tabs are active
    if (wall.side === 'back' && params.label.enabled) continue;

    // Compute segments (split around wall cutout if present)
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
      const holeWidth = wall.wallSpan * (width / 100);
      if (holeWidth <= 0) continue;
      segments = [{ offset: 0, width: holeWidth }];
    }

    for (const seg of segments) {
      if (seg.width <= 0) continue;
      allHoles.push(
        buildHoleCut(
          seg.width,
          seg.offset,
          effectiveHeight,
          cornerRadius,
          extrudeDepth,
          centerZ,
          wall
        )
      );
    }
  }

  return fuseAllOrNull(allHoles);
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const handlesFeature: FeatureBuilder = {
  name: 'handles',
  tag: FeatureTag.HANDLE,
  target: 'cut', // Holes are subtractive
  shouldBuild: (ctx) => ctx.params.handles.enabled && !ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
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
        'v3', // bump: holes replace ledges
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
    const result = buildHandleHoles(
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
