/**
 * Handle hole builder for Gridfinity bins.
 *
 * Generates through-hole cutouts in bin walls as finger grips.
 * Supports 3 shapes (rectangle, oval, scoop), adjustable
 * vertical position, multi-handle per wall, per-side overrides,
 * interior wall handles, and optional chamfer.
 *
 * When a wall also has a cutout enabled, each handle individually
 * checks for overlap and splits or skips as needed.
 */

import { translate, rotate, withScope, clone, unwrap, fuseAll } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams, HandleCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { interiorDividerSegments } from './compartmentBuilder';
import {
  buildHandleWallDefs,
  computeHandleHoleGeometry,
  computeWallHandleSegments,
} from '@/shared/utils/handleCutoutClip';
import type { HandleWallDef } from '@/shared/utils/handleCutoutClip';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { buildHandleProfile } from './handleProfiles';
import { LIP_TAPER_WIDTH } from './generatorConstants';
import { resolvePolygonSideGeometry } from './maskPolygonEdges';
import { isPartialMask } from '@/shared/utils/cellMask';

/**
 * Build a single hole cut solid from a profile.
 *
 * Sketches the profile on XZ plane, extrudes through the wall,
 * and positions at the correct wall location and Z height.
 */
function buildHoleCut(
  scope: DisposalScope,
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

  let cutShape = scope.register(sketch(profile, 'XZ').extrude(extrudeDepth));
  cutShape = scope.register(translate(cutShape, [segmentOffset, extrudeDepth / 2, centerZ]));

  if (wall.rotateZ !== 0) {
    cutShape = scope.register(rotate(cutShape, wall.rotateZ, { axis: [0, 0, 1] }));
  }

  return scope.register(translate(cutShape, [wall.x, wall.y, 0]));
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
  scope: DisposalScope,
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

  let chamfer = scope.register(sketch(profile, 'XZ').extrude(CHAMFER_DISTANCE));
  chamfer = scope.register(translate(chamfer, [segmentOffset, CHAMFER_DISTANCE / 2, centerZ]));

  if (wall.rotateZ !== 0) {
    chamfer = scope.register(rotate(chamfer, wall.rotateZ, { axis: [0, 0, 1] }));
  }
  return scope.register(translate(chamfer, [wall.x, wall.y, 0]));
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

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildHandleHolesInScope(
      scope,
      params,
      innerW,
      innerD,
      interiorHeight,
      wallThickness,
      hasLip
    );
    return fused ? unwrap(clone(fused)) : null;
  });
}

function buildHandleHolesInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  hasLip: boolean
): Shape3D | null {
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

  // Non-rectangular footprints map each outer side to its outermost matching
  // polygon edge (silently skipping sides with no edge). Rect bins use the
  // AABB-derived defs. Interior handles are skipped on polygon bins since
  // compartment walls are filtered out for custom shapes (see featuresStage).
  const cellMask = params.cellMask;
  const isPolygon = isPartialMask(cellMask);
  const walls: readonly HandleWallDef[] = isPolygon
    ? (['front', 'back', 'left', 'right'] as const)
        .map((side) => {
          const geom = resolvePolygonSideGeometry(cellMask, params.gridUnitMm, wallThickness, side);
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
    const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
      interiorHeight,
      sideHeight,
      verticalPosition
    );
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
          scope,
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
            scope,
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

  // Interior wall handles — skipped on polygon bins (compartment walls are
  // filtered out for custom shapes, so there's nothing to cut through).
  if (interior && !isPolygon) {
    const { cols, rows } = params.compartments;
    if (cols > 1 || rows > 1) {
      const geom = computeHandleHoleGeometry(interiorHeight, globalHeight, verticalPosition);

      if (geom.effectiveHeight >= 1) {
        // Placement honours tilted dividers so handle holes distribute along the
        // angled wall, not the original grid line.
        for (const seg of interiorDividerSegments(params, innerW, innerD)) {
          const handleW = seg.segLen * (globalWidth / 100);
          const offsets = computeMultiHandleOffsets(count, seg.segLen, handleW);
          // Interior walls always use global config — `side` is unused for lookups.
          const wallDef: HandleWallDef = {
            side: 'front',
            wallSpan: seg.segLen,
            x: seg.x,
            y: seg.y,
            rotateZ: seg.rotateZ,
          };
          for (const offset of offsets) {
            const hole = buildHoleCut(
              scope,
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
    }
  }

  if (allHoles.length === 0) return null;
  if (allHoles.length === 1) return allHoles[0]; // already scope-registered
  return scope.register(unwrap(fuseAll(allHoles as ValidSolid[])));
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const handlesFeature: FeatureBuilder = {
  name: 'handles',
  tag: FeatureTag.HANDLE,
  target: 'cut',
  supportsCellMask: true,
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
          : '',
        // Tilted dividers move interior handle holes off the grid line.
        params.handles.interior ? stableSerialize(params.compartments.dividerOverrides ?? []) : ''
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
