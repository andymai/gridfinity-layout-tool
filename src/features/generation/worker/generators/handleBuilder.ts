/**
 * Handle hole builder for Gridfinity bins.
 *
 * Generates through-hole cutouts in bin walls as finger grips.
 * Supports 4 shapes (rectangle, oval, scoop, u-shape), adjustable
 * vertical position, multi-handle per wall, per-side overrides,
 * interior wall handles, and optional chamfer.
 *
 * When a wall also has a cutout enabled, each handle individually
 * checks for overlap and splits or skips as needed.
 */

import { translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, HandleCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull, findWallSegments } from './compartmentBuilder';
import {
  buildHandleWallDefs,
  computeHandleHoleGeometry,
  computeWallHandleSegments,
  U_SHAPE_OVERSHOOT,
} from '@/shared/utils/handleCutoutClip';
import type { HandleWallDef } from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { buildHandleProfile } from './handleProfiles';
import { LIP_TAPER_WIDTH } from './generatorConstants';

/**
 * Build a single hole cut solid from a profile.
 *
 * Sketches the profile on XZ plane, extrudes through the wall,
 * and positions at the correct wall location and Z height.
 */
function buildHoleCut(
  shape: HandleCutoutShape,
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: HandleWallDef
): Shape3D | null {
  const profile = buildHandleProfile(shape, {
    width: segmentWidth,
    height: holeHeight,
    cornerRadius,
  });
  if (!profile) return null;

  let cutShape = sketch(profile, 'XZ').extrude(extrudeDepth);
  cutShape = translate(cutShape, [segmentOffset, extrudeDepth / 2, centerZ]);

  if (wall.rotateZ !== 0) {
    cutShape = rotate(cutShape, wall.rotateZ, { axis: [0, 0, 1] });
  }

  return translate(cutShape, [wall.x, wall.y, 0]);
}

/** Chamfer distance in mm. */
const CHAMFER_DISTANCE = 0.8;

/**
 * Build a chamfer cut for a handle hole.
 *
 * Extrudes a slightly larger profile to shallow depth. Since the handle hole
 * already creates the void, this larger cut creates a beveled edge automatically.
 */
function buildChamferCut(
  shape: HandleCutoutShape,
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  centerZ: number,
  wall: HandleWallDef
): Shape3D | null {
  const profile = buildHandleProfile(shape, {
    width: segmentWidth + CHAMFER_DISTANCE * 2,
    height: holeHeight + CHAMFER_DISTANCE * 2,
    cornerRadius: cornerRadius + CHAMFER_DISTANCE,
  });
  if (!profile) return null;

  let chamfer = sketch(profile, 'XZ').extrude(CHAMFER_DISTANCE);
  chamfer = translate(chamfer, [segmentOffset, CHAMFER_DISTANCE / 2, centerZ]);

  if (wall.rotateZ !== 0) {
    chamfer = rotate(chamfer, wall.rotateZ, { axis: [0, 0, 1] });
  }
  return translate(chamfer, [wall.x, wall.y, 0]);
}

/**
 * Build handle hole cuts for all enabled walls and optionally interior dividers.
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

  const {
    shape,
    width: globalWidth,
    height: globalHeight,
    cornerRadius: globalRadius,
    verticalPosition,
    count,
    chamfer,
    interior,
  } = params.handles;
  if (globalHeight <= 0) return null;

  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (wallThickness + lipOverhang) * 2 + 1;
  const isUShape = shape === 'u-shape';

  const walls = buildHandleWallDefs(innerW, innerD);
  const allHoles: Shape3D[] = [];

  for (const wall of walls) {
    const side = params.handles[wall.side];
    if (!side.enabled) continue;
    if (wall.side === 'back' && params.label.enabled) continue;

    // Resolve per-side overrides
    const sideWidth = side.width ?? globalWidth;
    const sideHeight = side.height ?? globalHeight;
    const sideRadius = side.cornerRadius ?? globalRadius;

    // Compute vertical geometry
    let centerZ: number;
    let effectiveHeight: number;
    if (isUShape) {
      // Auto-anchor: U-shape extends from floor upward, with overshoot below
      const clampedHeight = Math.min(sideHeight, interiorHeight);
      effectiveHeight = clampedHeight + U_SHAPE_OVERSHOOT;
      centerZ = (clampedHeight - U_SHAPE_OVERSHOOT) / 2;
    } else {
      const geom = computeHandleHoleGeometry(interiorHeight, sideHeight, verticalPosition);
      centerZ = geom.centerZ;
      effectiveHeight = geom.effectiveHeight;
    }
    if (effectiveHeight < 1) continue;

    // Multi-handle: compute offsets, then split each around wall cutout
    const handleWidthMm = wall.wallSpan * (sideWidth / 100);
    const offsets = computeMultiHandleOffsets(count, wall.wallSpan, handleWidthMm);

    // Resolve wall cutout for segment splitting (uses shared utility)
    const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;
    const segments = computeWallHandleSegments(wall.wallSpan, sideWidth, wallThickness, wallCutout);
    if (!segments) continue;

    for (const handleOffset of offsets) {
      for (const seg of segments) {
        const hole = buildHoleCut(
          shape,
          seg.width,
          seg.offset + handleOffset,
          effectiveHeight,
          sideRadius,
          extrudeDepth,
          centerZ,
          wall
        );
        if (hole) allHoles.push(hole);
        if (chamfer) {
          const chamferHole = buildChamferCut(
            shape,
            seg.width,
            seg.offset + handleOffset,
            effectiveHeight,
            sideRadius,
            centerZ,
            wall
          );
          if (chamferHole) allHoles.push(chamferHole);
        }
      }
    }
  }

  // Interior wall handles
  if (interior && !isUShape) {
    const { cols, rows, cells } = params.compartments;
    if (cols > 1 || rows > 1) {
      const cellW = innerW / cols;
      const cellD = innerD / rows;
      const geom = computeHandleHoleGeometry(interiorHeight, globalHeight, verticalPosition);

      if (geom.effectiveHeight >= 1) {
        const addInteriorHandles = (
          boundaryCount: number,
          segCount: number,
          getCellIds: (boundary: number, i: number) => [number, number],
          getWallDef: (boundary: number, start: number, end: number) => HandleWallDef,
          segCellSize: number
        ): void => {
          for (let boundary = 1; boundary < boundaryCount; boundary++) {
            const segments = findWallSegments(segCount, (i) => {
              const [id1, id2] = getCellIds(boundary, i);
              return id1 !== id2;
            });

            for (const [start, end] of segments) {
              const segSpan = (end - start) * segCellSize;
              const handleW = segSpan * (globalWidth / 100);
              const offsets = computeMultiHandleOffsets(count, segSpan, handleW);
              const wallDef = getWallDef(boundary, start, end);

              for (const offset of offsets) {
                const hole = buildHoleCut(
                  shape,
                  handleW,
                  offset,
                  geom.effectiveHeight,
                  globalRadius,
                  extrudeDepth,
                  geom.centerZ,
                  wallDef
                );
                if (hole) allHoles.push(hole);
              }
            }
          }
        };

        // Vertical dividers (between columns)
        addInteriorHandles(
          cols,
          rows,
          (boundary, row) => [cells[row * cols + (boundary - 1)], cells[row * cols + boundary]],
          (boundary, start, end) => ({
            // Interior walls always use global config — side field unused for lookups
            side: 'front' as const,
            wallSpan: (end - start) * cellD,
            x: -innerW / 2 + boundary * cellW,
            y: -innerD / 2 + (start + (end - start) / 2) * cellD,
            rotateZ: 90,
          }),
          cellD
        );

        // Horizontal dividers (between rows)
        addInteriorHandles(
          rows,
          cols,
          (boundary, col) => [cells[(boundary - 1) * cols + col], cells[boundary * cols + col]],
          (boundary, start, end) => ({
            side: 'front' as const,
            wallSpan: (end - start) * cellW,
            x: -innerW / 2 + (start + (end - start) / 2) * cellW,
            y: -innerD / 2 + boundary * cellD,
            rotateZ: 0,
          }),
          cellW
        );
      }
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
  target: 'cut',
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
        'v4', // bump: handle redesign
        dim.shellKey,
        stableSerialize(params.handles),
        cutoutClipKey,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        quantize(params.wallThickness),
        params.label.enabled,
        dim.hasLip,
        params.handles.interior
          ? `${params.compartments.cols}x${params.compartments.rows}:${params.compartments.cells.join(',')}`
          : ''
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
