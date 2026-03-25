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
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
} from '@/shared/utils/handleCutoutClip';
import type { HandleWallDef } from '@/shared/utils/handleCutoutClip';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { buildHandleProfile, U_SHAPE_OVERSHOOT } from './handleProfiles';
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

/** Resolve cutout horizontal info for overlap checking. */
function resolveCutoutSpan(
  wallSpan: number,
  wallThickness: number,
  cutout: {
    enabled: boolean;
    width: number;
    widthMm: number | null;
    alignment: string;
    offset: number;
  }
): { cutCenter: number; cutWidth: number } | null {
  if (!cutout.enabled) return null;
  const cutWidth =
    cutout.widthMm !== null ? Math.min(cutout.widthMm, wallSpan) : wallSpan * (cutout.width / 100);
  if (cutWidth <= 0) return null;
  const cutCenter = computeCutoutCenter(
    wallSpan,
    cutWidth,
    wallThickness,
    cutout.alignment as 'left' | 'center' | 'right',
    cutout.offset
  );
  return { cutCenter, cutWidth };
}

/**
 * Build handle holes for a single handle at a given offset, checking cutout overlap.
 *
 * Returns 0-2 hole shapes: full handle if no overlap, left/right remnants if partial overlap,
 * nothing if fully covered.
 */
function buildHandleAtOffset(
  shape: HandleCutoutShape,
  handleOffset: number,
  handleWidthMm: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: HandleWallDef,
  cutoutSpan: { cutCenter: number; cutWidth: number } | null
): Shape3D[] {
  const results: Shape3D[] = [];

  if (cutoutSpan) {
    const handleLeft = handleOffset - handleWidthMm / 2;
    const handleRight = handleOffset + handleWidthMm / 2;
    const cutLeft = cutoutSpan.cutCenter - cutoutSpan.cutWidth / 2 - CUTOUT_CLEARANCE;
    const cutRight = cutoutSpan.cutCenter + cutoutSpan.cutWidth / 2 + CUTOUT_CLEARANCE;

    // Check overlap
    if (handleRight > cutLeft && handleLeft < cutRight) {
      // Partial or full overlap — compute remnant segments
      const leftWidth = cutLeft - handleLeft;
      if (leftWidth >= MIN_SEGMENT_WIDTH) {
        const leftCenter = handleLeft + leftWidth / 2;
        const hole = buildHoleCut(
          shape,
          leftWidth,
          leftCenter,
          holeHeight,
          cornerRadius,
          extrudeDepth,
          centerZ,
          wall
        );
        if (hole) results.push(hole);
      }
      const rightWidth = handleRight - cutRight;
      if (rightWidth >= MIN_SEGMENT_WIDTH) {
        const rightCenter = cutRight + rightWidth / 2;
        const hole = buildHoleCut(
          shape,
          rightWidth,
          rightCenter,
          holeHeight,
          cornerRadius,
          extrudeDepth,
          centerZ,
          wall
        );
        if (hole) results.push(hole);
      }
      return results;
    }
  }

  // No overlap — build full handle
  const hole = buildHoleCut(
    shape,
    handleWidthMm,
    handleOffset,
    holeHeight,
    cornerRadius,
    extrudeDepth,
    centerZ,
    wall
  );
  if (hole) results.push(hole);
  return results;
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
      effectiveHeight = Math.min(
        sideHeight + U_SHAPE_OVERSHOOT,
        interiorHeight + U_SHAPE_OVERSHOOT
      );
      centerZ = (sideHeight - U_SHAPE_OVERSHOOT) / 2;
    } else {
      const geom = computeHandleHoleGeometry(interiorHeight, sideHeight, verticalPosition);
      centerZ = geom.centerZ;
      effectiveHeight = geom.effectiveHeight;
    }
    if (effectiveHeight < 1) continue;

    // Resolve wall cutout info for overlap checking
    const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;
    const cutoutSpan = wallCutout
      ? resolveCutoutSpan(wall.wallSpan, wallThickness, wallCutout)
      : null;

    // Multi-handle: compute offsets for each handle on this wall
    const handleWidthMm = wall.wallSpan * (sideWidth / 100);
    const offsets = computeMultiHandleOffsets(count, wall.wallSpan, handleWidthMm);

    for (const handleOffset of offsets) {
      const holes = buildHandleAtOffset(
        shape,
        handleOffset,
        handleWidthMm,
        effectiveHeight,
        sideRadius,
        extrudeDepth,
        centerZ,
        wall,
        cutoutSpan
      );
      allHoles.push(...holes);
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
