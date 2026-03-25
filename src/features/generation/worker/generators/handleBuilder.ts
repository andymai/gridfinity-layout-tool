/**
 * Handle hole builder for Gridfinity bins.
 *
 * Generates through-hole cutouts in bin walls as finger grips.
 * Each hole is a rounded rectangle (controlled by cornerRadius)
 * extruded through the full wall thickness, positioned at 70%
 * of the interior wall height.
 *
 * When a wall also has a cutout enabled, the hole is split into
 * segments that flank the cutout region via computeWallHandleSegments().
 */

import { drawRoundedRectangle, drawRectangle, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import {
  buildHandleWallDefs,
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import type { HandleWallDef } from '@/shared/utils/handleCutoutClip';
import { LIP_TAPER_WIDTH } from './generatorConstants';

/**
 * Build a single hole cut solid for one segment.
 *
 * Sketches a rounded rectangle on XZ (width x height), extrudes through
 * the wall, and positions at the correct wall location and Z height.
 */
function buildHoleCut(
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: HandleWallDef
): Shape3D {
  // Clamp corner radius to half of smallest dimension
  const safeR = Math.max(0, Math.min(cornerRadius, segmentWidth / 2 - 0.01, holeHeight / 2 - 0.01));

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

  const { centerZ, effectiveHeight } = computeHandleHoleGeometry(interiorHeight, height);
  if (effectiveHeight < 1) return null;

  const walls = buildHandleWallDefs(innerW, innerD);
  const allHoles: Shape3D[] = [];

  for (const wall of walls) {
    if (!params.handles[wall.side].enabled) continue;
    if (wall.side === 'back' && params.label.enabled) continue;

    const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;
    const segments = computeWallHandleSegments(wall.wallSpan, width, wallThickness, wallCutout);
    if (!segments) continue;

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
