/**
 * Divider-cutout blend builder for Gridfinity bins.
 *
 * Produces cut solids that trim compartment divider walls where they meet
 * outer-wall cutouts, creating aesthetically pleasing transitions:
 *
 * Case 1 — Divider end within cutout span: trim to match cutout profile
 * Case 2 — Divider end adjacent to cutout: straight-slope ramp (~45°)
 * Case 3 — Parallel divider visible through cutout: flat horizontal trim
 *
 * Standard (fused wall) bin style only — slotted bins are skipped.
 */

import { box, draw, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './utils/shapeOps';
import { findWallSegments } from './compartmentBuilder';
import { buildSingleCutout } from './featureBuilder';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { LIP_HEIGHT, COPLANAR_MARGIN } from './generatorConstants';

/** Resolved outer-wall cutout geometry in bin-global coordinates. */
interface OuterWallCutoutInfo {
  readonly side: 'front' | 'back' | 'left' | 'right';
  /** Full wall span along the span axis (mm). */
  readonly wallSpan: number;
  /** Cutout width (mm). */
  readonly cutWidth: number;
  /** Cutout height from wall top (mm). */
  readonly userCutHeight: number;
  /** Z coordinate of cutout bottom edge. */
  readonly cutBottom: number;
  /** Cutout center offset from wall center along span axis (mm). */
  readonly centerOffset: number;
  /** Left edge of cutout in global span-axis coords (mm). */
  readonly cutLeft: number;
  /** Right edge of cutout in global span-axis coords (mm). */
  readonly cutRight: number;
  /** Coordinate of the wall face (e.g. -innerD/2 for front). */
  readonly wallFaceCoord: number;
  /** Sign of inward direction from this wall (+1 for front, -1 for back). */
  readonly inwardSign: number;
  /** Span axis: 'x' for front/back, 'y' for left/right. */
  readonly spanAxis: 'x' | 'y';
}

/** Divider wall segment in bin-global coordinates. */
interface DividerInfo {
  /** Vertical = between columns (runs along Y), horizontal = between rows (runs along X). */
  readonly axis: 'vertical' | 'horizontal';
  /** Position along the perpendicular axis (X for vertical dividers, Y for horizontal). */
  readonly posAlongPerp: number;
  /** Start of segment along span axis (mm). */
  readonly spanStart: number;
  /** End of segment along span axis (mm). */
  readonly spanEnd: number;
  /** Divider wall thickness (mm). */
  readonly thickness: number;
}

/** Minimum geometry dimension to avoid degenerate shapes (mm). */
const MIN_DIM = 0.5;

/** Tolerance for matching divider endpoints to wall face coordinates (mm). */
const WALL_TOUCH_TOL = 0.01;

/** Minimal wall face descriptor shared by cutout info and junction detection. */
interface WallFaceInfo {
  readonly wallFaceCoord: number;
  readonly inwardSign: number;
  readonly spanAxis: 'x' | 'y';
}

/** Build a WallFaceInfo for a given side from bin inner dimensions. */
function getWallFaceInfo(
  side: 'front' | 'back' | 'left' | 'right',
  innerW: number,
  innerD: number
): WallFaceInfo {
  const info: Record<string, WallFaceInfo> = {
    front: { wallFaceCoord: -innerD / 2, inwardSign: 1, spanAxis: 'x' },
    back: { wallFaceCoord: innerD / 2, inwardSign: -1, spanAxis: 'x' },
    left: { wallFaceCoord: -innerW / 2, inwardSign: 1, spanAxis: 'y' },
    right: { wallFaceCoord: innerW / 2, inwardSign: -1, spanAxis: 'y' },
  };
  return info[side];
}

/**
 * Resolve outer-wall cutout geometry for all enabled sides.
 * Pure function — no brepjs dependency.
 */
export function resolveOuterCutouts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): OuterWallCutoutInfo[] {
  if (!params.walls.enabled) return [];

  const interiorHeight = wallHeight - params.wallThickness;
  const result: OuterWallCutoutInfo[] = [];

  const sides: Array<{
    key: 'front' | 'back' | 'left' | 'right';
    wallSpan: number;
    wallFaceCoord: number;
    inwardSign: number;
    spanAxis: 'x' | 'y';
  }> = [
    { key: 'front', wallSpan: innerW, wallFaceCoord: -innerD / 2, inwardSign: 1, spanAxis: 'x' },
    { key: 'back', wallSpan: innerW, wallFaceCoord: innerD / 2, inwardSign: -1, spanAxis: 'x' },
    { key: 'left', wallSpan: innerD, wallFaceCoord: -innerW / 2, inwardSign: 1, spanAxis: 'y' },
    { key: 'right', wallSpan: innerD, wallFaceCoord: innerW / 2, inwardSign: -1, spanAxis: 'y' },
  ];

  for (const side of sides) {
    const cfg = params.walls[side.key];
    if (!cfg.enabled) continue;

    const cutWidth =
      cfg.widthMm !== null
        ? Math.min(cfg.widthMm, side.wallSpan)
        : side.wallSpan * (cfg.width / 100);

    const userCutHeight = interiorHeight * (cfg.depth / 100);
    if (cutWidth < 0.1 || userCutHeight < 0.1) continue;

    const centerOffset = computeCutoutCenter(
      side.wallSpan,
      cutWidth,
      params.wallThickness,
      cfg.alignment,
      cfg.offset
    );

    result.push({
      side: side.key,
      wallSpan: side.wallSpan,
      cutWidth,
      userCutHeight,
      cutBottom: wallHeight - userCutHeight,
      centerOffset,
      cutLeft: centerOffset - cutWidth / 2,
      cutRight: centerOffset + cutWidth / 2,
      wallFaceCoord: side.wallFaceCoord,
      inwardSign: side.inwardSign,
      spanAxis: side.spanAxis,
    });
  }

  return result;
}

/**
 * Collect divider wall segments from the compartment grid.
 * Pure function — mirrors compartmentBuilder logic.
 */
export function collectDividers(params: BinParams, innerW: number, innerD: number): DividerInfo[] {
  const { cols, rows, thickness, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return [];
  if (new Set(cells).size <= 1) return [];

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Mirror buildCompartmentWalls small-cell guard:
  // skip axes where cells are too narrow for viable divider geometry.
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;
  const canBuildVertical = effectiveCellW >= thickness * 2;
  const canBuildHorizontal = effectiveCellD >= thickness * 2;

  const dividers: DividerInfo[] = [];

  // Vertical dividers (between columns, run along Y)
  if (canBuildVertical)
    for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
      const xPos = -innerW / 2 + colBoundary * cellW;
      const segments = findWallSegments(rows, (row) => {
        const leftId = cells[row * cols + (colBoundary - 1)];
        const rightId = cells[row * cols + colBoundary];
        return leftId !== rightId;
      });
      for (const [start, end] of segments) {
        dividers.push({
          axis: 'vertical',
          posAlongPerp: xPos,
          spanStart: -innerD / 2 + start * cellD,
          spanEnd: -innerD / 2 + end * cellD,
          thickness,
        });
      }
    }

  // Horizontal dividers (between rows, run along X)
  if (canBuildHorizontal)
    for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
      const yPos = -innerD / 2 + rowBoundary * cellD;
      const segments = findWallSegments(cols, (col) => {
        const topId = cells[(rowBoundary - 1) * cols + col];
        const bottomId = cells[rowBoundary * cols + col];
        return topId !== bottomId;
      });
      for (const [start, end] of segments) {
        dividers.push({
          axis: 'horizontal',
          posAlongPerp: yPos,
          spanStart: -innerW / 2 + start * cellW,
          spanEnd: -innerW / 2 + end * cellW,
          thickness,
        });
      }
    }

  return dividers;
}

/**
 * Check if a divider is perpendicular to a given wall face.
 * Vertical dividers (run along Y) are perpendicular to front/back walls.
 * Horizontal dividers (run along X) are perpendicular to left/right walls.
 */
function isPerpendicular(divider: DividerInfo, wall: WallFaceInfo): boolean {
  if (divider.axis === 'vertical') return wall.spanAxis === 'x'; // front/back
  return wall.spanAxis === 'y'; // left/right
}

/**
 * Check if a divider's end touches a specific wall face.
 */
function dividerTouchesWall(divider: DividerInfo, wall: WallFaceInfo): boolean {
  if (divider.axis === 'vertical' && wall.spanAxis === 'x') {
    // Vertical divider, front/back wall
    if (wall.inwardSign > 0)
      return Math.abs(divider.spanStart - wall.wallFaceCoord) < WALL_TOUCH_TOL;
    return Math.abs(divider.spanEnd - wall.wallFaceCoord) < WALL_TOUCH_TOL;
  }
  if (divider.axis === 'horizontal' && wall.spanAxis === 'y') {
    // Horizontal divider, left/right wall
    if (wall.inwardSign > 0)
      return Math.abs(divider.spanStart - wall.wallFaceCoord) < WALL_TOUCH_TOL;
    return Math.abs(divider.spanEnd - wall.wallFaceCoord) < WALL_TOUCH_TOL;
  }
  return false;
}

/**
 * Case 1: Trim divider end to match cutout profile.
 *
 * When a perpendicular divider terminates within the cutout's horizontal span,
 * cut its end to follow the same profile shape as the outer-wall cutout.
 */
function buildEndTrimCut(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  cutoutShape: WallCutoutShape,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  const overshoot = (hasLip ? LIP_HEIGHT : 0) + 2;
  // Extrude deep enough to cut through divider thickness + margins
  const extrudeDepth = divider.thickness + 2 * COPLANAR_MARGIN;

  // Position at the cutout center (not the divider) so the profile shape
  // matches the outer wall cutout exactly. The narrow extrusion only intersects
  // the divider end where it's coplanar with the wall face.
  const isVertical = divider.axis === 'vertical';

  return buildSingleCutout(
    cutoutShape,
    cutout.cutWidth,
    cutout.userCutHeight,
    overshoot,
    extrudeDepth,
    wallHeight,
    {
      x: isVertical ? cutout.centerOffset : cutout.wallFaceCoord,
      y: isVertical ? cutout.wallFaceCoord : cutout.centerOffset,
      rotateZ: isVertical ? 0 : 90,
    }
  );
}

/**
 * Case 2: Ramp from full height to cutout bottom.
 *
 * A straight-slope wedge cut where a perpendicular divider is adjacent to
 * (just outside) the cutout span. Ramp length = userCutHeight, capped at
 * half the divider's span length. Creates a ~45° slope.
 */
function buildRampCut(
  divider: DividerInfo,
  cutout: OuterWallCutoutInfo,
  wallHeight: number
): Shape3D | null {
  const segLength = divider.spanEnd - divider.spanStart;
  const rampLen = Math.min(cutout.userCutHeight, segLength / 2);
  if (rampLen < MIN_DIM) return null;

  const rampHeight = cutout.userCutHeight;
  if (rampHeight < MIN_DIM) return null;

  // Triangular profile on XZ plane: X = distance from wall (inward), Z = height.
  // At X=0 (wall face) the cut goes down to cutBottom; at X=rampLen (inward)
  // the cut is at wallHeight (full height). The triangle removes the wedge
  // from the divider top near the wall face.
  const profile = draw([0, wallHeight])
    .lineTo([rampLen, wallHeight])
    .lineTo([0, wallHeight - rampHeight])
    .close();

  const extrudeLen = divider.thickness + 2 * COPLANAR_MARGIN;
  // Each transform allocates a new WASM handle while the previous becomes
  // garbage. Dispose intermediates so only the final positioned shape lives.
  const extruded = sketch(profile, 'XZ').extrude(extrudeLen);
  const centered = translate(extruded, [0, extrudeLen / 2, 0]);
  extruded.delete();
  let shape = centered;

  // Rotate and translate so X (inward) maps to the correct bin axis.
  // Rotation around Z: +90° maps (x,y) → (-y, x), -90° maps (x,y) → (y, -x).
  const isVertical = divider.axis === 'vertical';

  if (isVertical) {
    // Vertical divider near front/back wall.
    // Profile X (inward) must map to bin Y direction.
    // Extrusion Y must map to bin X (divider thickness axis).
    const wallEnd = cutout.inwardSign > 0 ? divider.spanStart : divider.spanEnd;

    // Front wall (inwardSign=+1): inward = +Y → rotate +90° maps X → +Y
    // Back wall (inwardSign=-1): inward = -Y → rotate -90° maps X → -Y (via y=-x flip)
    const rotated = rotate(shape, cutout.inwardSign > 0 ? 90 : -90, { axis: [0, 0, 1] });
    shape.delete();
    const positioned = translate(rotated, [divider.posAlongPerp, wallEnd, 0]);
    rotated.delete();
    return positioned;
  }

  // Horizontal divider near left/right wall.
  // Profile X (inward) stays as bin X for left wall (+X inward).
  // For right wall (-X inward), rotate 180° to flip.
  const wallEnd = cutout.inwardSign > 0 ? divider.spanStart : divider.spanEnd;

  if (cutout.inwardSign < 0) {
    const rotated = rotate(shape, 180, { axis: [0, 0, 1] });
    shape.delete();
    shape = rotated;
  }
  const positioned = translate(shape, [wallEnd, divider.posAlongPerp, 0]);
  shape.delete();
  return positioned;
}

/**
 * Case 3: Flat horizontal trim for parallel divider visible through cutout.
 *
 * When a divider runs parallel to a wall with a cutout, and the divider's
 * span overlaps the cutout's horizontal span, trim the divider top down to
 * the cutout bottom height within the overlapping region.
 */
function buildParallelTrimCut(divider: DividerInfo, cutout: OuterWallCutoutInfo): Shape3D | null {
  // Compute overlap between divider span and cutout span (both in global coords)
  const overlapStart = Math.max(divider.spanStart, cutout.cutLeft);
  const overlapEnd = Math.min(divider.spanEnd, cutout.cutRight);
  const overlapWidth = overlapEnd - overlapStart;
  if (overlapWidth < MIN_DIM) return null;

  const trimHeight = cutout.userCutHeight;
  if (trimHeight < MIN_DIM) return null;

  const overlapCenter = (overlapStart + overlapEnd) / 2;
  const boxThickness = divider.thickness + 2 * COPLANAR_MARGIN;
  const boxHeight = trimHeight + COPLANAR_MARGIN; // extend above wall top

  const isHorizontalDivider = divider.axis === 'horizontal';

  if (isHorizontalDivider) {
    // Horizontal divider runs along X, parallel to front/back wall.
    // cutout.spanAxis === 'x', so overlap is along X.
    return box(overlapWidth, boxThickness, boxHeight, {
      at: [overlapCenter, divider.posAlongPerp, cutout.cutBottom + boxHeight / 2],
    });
  }

  // Vertical divider runs along Y, parallel to left/right wall.
  // cutout.spanAxis === 'y', so overlap is along Y.
  return box(boxThickness, overlapWidth, boxHeight, {
    at: [divider.posAlongPerp, overlapCenter, cutout.cutBottom + boxHeight / 2],
  });
}

/**
 * Build all divider-cutout blend cuts.
 *
 * Returns a single fused cut solid (or null if no blending is needed).
 */
export function buildDividerBlends(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): Shape3D | null {
  if (params.style !== 'standard') return null;
  if (!params.walls.enabled) return null;

  const cutouts = resolveOuterCutouts(params, innerW, innerD, wallHeight);
  if (cutouts.length === 0) return null;

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return null;

  const cutoutShape = params.walls.shape;
  const cuts: Shape3D[] = [];

  for (const divider of dividers) {
    for (const cutout of cutouts) {
      const perp = isPerpendicular(divider, cutout);

      if (perp && dividerTouchesWall(divider, cutout)) {
        // Divider's wall-local position along the cutout's span axis
        const dividerPos = divider.posAlongPerp;
        const halfThick = divider.thickness / 2;

        // Case 1: Divider end within cutout span
        if (
          dividerPos + halfThick <= cutout.cutRight + 0.01 &&
          dividerPos - halfThick >= cutout.cutLeft - 0.01
        ) {
          try {
            const cut = buildEndTrimCut(divider, cutout, cutoutShape, wallHeight, hasLip);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }

        // Case 2: Divider adjacent to cutout edge — ramp
        const distToLeft = cutout.cutLeft - dividerPos;
        const distToRight = dividerPos - cutout.cutRight;

        if (distToLeft > -halfThick && distToLeft < cutout.userCutHeight) {
          try {
            const cut = buildRampCut(divider, cutout, wallHeight);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }
        if (distToRight > -halfThick && distToRight < cutout.userCutHeight) {
          try {
            const cut = buildRampCut(divider, cutout, wallHeight);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }
      } else if (!perp) {
        // Case 3: Parallel divider — flat horizontal trim.
        // Only trim dividers close enough to the wall to be visually exposed
        // through the cutout opening. Use cutout height as proximity threshold.
        const depthFromWall = Math.abs(divider.posAlongPerp - cutout.wallFaceCoord);
        if (depthFromWall < cutout.userCutHeight) {
          try {
            const cut = buildParallelTrimCut(divider, cutout);
            if (cut) cuts.push(cut);
          } catch {
            /* graceful degradation */
          }
        }
      }
    }
  }

  // fuseAllOrNull allocates a new WASM handle for the fused result (when
  // cuts.length > 1) but does not dispose its inputs. Free them explicitly
  // to match the leak-plugging pattern used across the other builders.
  const fused = fuseAllOrNull(cuts);
  if (cuts.length > 1) {
    for (const s of cuts) s.delete();
  }
  return fused;
}

// --- Ramp zone data for wall pattern clipping ---

/** Ramp zone descriptor for hex pattern clipping on a specific wall. */
export interface RampZone {
  /** Offset along the wall span from wall center (mm). */
  readonly offsetAlongWall: number;
  /** Width of the ramp zone along the wall span (mm). */
  readonly width: number;
  /** Height of the ramp zone (mm). */
  readonly height: number;
}

/**
 * Compute ramp zones that face a specific wall, for hex pattern clipping.
 *
 * Returns zones where ramp cuts exist on perpendicular dividers that touch
 * this wall. The pattern builder uses these to extend its clip region.
 */
export function computeRampZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): RampZone[] {
  if (!params.walls.enabled || params.style !== 'standard') return [];

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return [];

  const cutouts = resolveOuterCutouts(params, innerW, innerD, wallHeight);
  const wallCutout = cutouts.find((c) => c.side === wallSide);
  if (!wallCutout) return [];

  const zones: RampZone[] = [];

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wallCutout)) continue;
    if (!dividerTouchesWall(divider, wallCutout)) continue;

    const dividerPos = divider.posAlongPerp;
    const halfThick = divider.thickness / 2;
    const distToLeft = wallCutout.cutLeft - dividerPos;
    const distToRight = dividerPos - wallCutout.cutRight;

    // Left-adjacent ramp
    if (distToLeft > -halfThick && distToLeft < wallCutout.userCutHeight) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }

    // Right-adjacent ramp
    if (distToRight > -halfThick && distToRight < wallCutout.userCutHeight) {
      const rampLen = Math.min(wallCutout.userCutHeight, (divider.spanEnd - divider.spanStart) / 2);
      if (rampLen >= MIN_DIM) {
        zones.push({
          offsetAlongWall: dividerPos,
          width: divider.thickness + 2 * COPLANAR_MARGIN,
          height: wallCutout.userCutHeight,
        });
      }
    }
  }

  return zones;
}

/**
 * Compute zones where perpendicular dividers meet a specific outer wall,
 * for blocking honeycomb pattern at the junction (full wall height).
 *
 * Unlike computeRampZones (which only produces zones near cutout edges),
 * this returns a zone for every perpendicular divider touching the wall,
 * regardless of whether a cutout exists. This ensures the hex pattern is
 * cleared where divider walls connect to the outer wall for structural
 * integrity (see issue #1345).
 */
export function computeDividerJunctionZones(
  wallSide: 'front' | 'back' | 'left' | 'right',
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): RampZone[] {
  // 'solid' intentionally included — junction blocking applies to any fused-wall style
  if (params.style === 'slotted') return [];
  if (!params.walls.enabled) return [];

  const dividers = collectDividers(params, innerW, innerD);
  if (dividers.length === 0) return [];

  const wall = getWallFaceInfo(wallSide, innerW, innerD);
  const zones: RampZone[] = [];

  for (const divider of dividers) {
    if (!isPerpendicular(divider, wall)) continue;
    if (!dividerTouchesWall(divider, wall)) continue;

    zones.push({
      offsetAlongWall: divider.posAlongPerp,
      width: divider.thickness + 2 * COPLANAR_MARGIN,
      height: wallHeight,
    });
  }

  return zones;
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const dividerBlendFeature: FeatureBuilder = {
  name: 'dividerCutoutBlend',
  tag: FeatureTag.DIVIDER,
  target: 'cut',
  shouldBuild: (ctx) =>
    !ctx.dimensions.isSlotted &&
    ctx.params.walls.enabled &&
    new Set(ctx.params.compartments.cells).size > 1,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        stableSerialize(params.walls),
        params.compartments.cols,
        params.compartments.rows,
        quantize(params.compartments.thickness),
        params.compartments.cells.join(','),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        dim.hasLip
      )
    );
  },
  build: (ctx) => {
    const result = buildDividerBlends(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.dimensions.hasLip
    );
    return result ? [result] : null;
  },
};
