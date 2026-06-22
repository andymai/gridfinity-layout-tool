/**
 * Wall pattern configuration for brepjs.
 *
 * Pure data module — determines which walls get pattern cuts and calculates
 * element center positions + wall transforms. No brepjs imports; the caller
 * (binGenerator) builds actual 3D shapes to avoid WASM GC scope issues.
 */

import type { BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { MASK_CELL_SIZE, isPartialMask, maskToPolygon } from '@/shared/utils/cellMask';
import { CLEARANCE } from './generatorConstants';
import { findPolygonEdgeForSide } from './maskPolygonEdges';
import type { PatternCenter, PatternCalculator } from './patterns';
import { getPatternCalculator, PATTERN_REGISTRY } from './patterns';

/**
 * Identifies which walls are free of divider slot grooves.
 * Patterns can only be applied to slot-free walls.
 */
export interface SlotFreeWalls {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Descriptor for a single wall's pattern element positions + transform. */
export interface WallPatternDescriptor {
  /**
   * Cardinal wall direction. For rect bins this is the literal side of the
   * AABB. For polygon bins, multiple external edges may share a cardinal
   * (e.g. the L-shape step produces two "front" edges); the outermost one
   * per cardinal is flagged by `allowClip` so cutout/handle clipping only
   * binds to the edge where the cutout/handle actually lives.
   */
  readonly side: 'front' | 'back' | 'left' | 'right';
  /** Element center positions on the flat XY grid (before wall rotation). Non-empty — walls with zero centers are filtered out by getWallPatternDescriptors. */
  readonly centers: readonly [PatternCenter, ...PatternCenter[]];
  /** Translation to position pattern panel on wall face */
  readonly translateX: number;
  readonly translateY: number;
  readonly translateZ: number;
  /** Optional Z-axis rotation (degrees) for wall orientation */
  readonly zRotation?: number;
  /** Inner span of this wall in mm — basis for cutout-width percentages. */
  readonly wallSpan: number;
  /**
   * Whether this descriptor should bind to cutout / handle / ramp-zone
   * clipping. False for polygon non-outermost edges where no cutout/handle
   * lives, so the pure pattern doesn't try to subtract a clip at the wrong
   * location.
   */
  readonly allowClip: boolean;
}

/**
 * Determine which walls are free of slot grooves.
 */
export function getSlotFreeWalls(params: BinParams): SlotFreeWalls {
  if (params.style !== 'slotted') {
    return { front: true, back: true, left: true, right: true };
  }
  return {
    front: !params.slotConfig.y.enabled,
    back: !params.slotConfig.y.enabled,
    left: !params.slotConfig.x.enabled,
    right: !params.slotConfig.x.enabled,
  };
}
/** Keep-out from wall top edge (stacking lip interface). */
export const TOP_KEEP_OUT = 1.5;

/** Solid border width around wall cutouts in honeycomb pattern (mm). */
export const CUTOUT_BORDER_WIDTH = 1.5;

/**
 * Solid skirt left ABOVE the interior floor before the pattern starts (mm).
 * The bottom keep-out is `wallThickness + this`: one `wallThickness` clears the
 * floor slab, and the skirt is the actual solid band the lowest hex row anchors
 * to. Without it the lowest webs rise straight off the wall-floor seam as
 * unanchored fins and snap during FDM printing (#2317). Sized to match
 * `TOP_KEEP_OUT`/`CUTOUT_BORDER_WIDTH` (~7 layers at 0.2mm) — the minimum band
 * that prints reliably while preserving the most hex rows.
 */
export const BOTTOM_SOLID_SKIRT = 1.5;

/**
 * Calculate wall pattern descriptors for any pattern type.
 *
 * Returns pure data describing element positions and wall transforms.
 * The caller builds brepjs shapes inline (same scope as the cut operation)
 * to avoid WASM GC issues with shapes crossing function boundaries.
 *
 * @param params - Bin parameters including wall pattern config
 * @param innerW - Interior width of bin (mm)
 * @param innerD - Interior depth of bin (mm)
 * @param wallHeight - Wall height available for pattern (mm)
 * @param calculator - Pattern calculator instance (from registry)
 * @returns Array of wall descriptors, or null if disabled/no valid walls
 */
function getWallPatternDescriptors(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  calculator: PatternCalculator
): WallPatternDescriptor[] | null {
  if (!params.wallPattern.enabled) {
    return null;
  }

  // Clear the floor slab (one wallThickness) AND leave a solid skirt above it
  // so the lowest hex row anchors to solid wall, not the floor seam (#2317).
  const bottomKeepOut = params.wallThickness + BOTTOM_SOLID_SKIRT;

  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  const minHeight = calculator.getMinPatternHeight();

  if (patternHeight < minHeight) {
    return null;
  }

  const slotFree = getSlotFreeWalls(params);
  if (!slotFree.front && !slotFree.back && !slotFree.left && !slotFree.right) {
    return null;
  }

  const patternCenterZ = bottomKeepOut + patternHeight / 2;

  const descriptors: WallPatternDescriptor[] = [];

  const addWall = (
    side: 'front' | 'back' | 'left' | 'right',
    fillW: number,
    translateX: number,
    translateY: number,
    zRotation?: number,
    allowClip = true
  ): void => {
    const centers = calculator.calculateCenters({ fillW, fillH: patternHeight });
    if (centers.length === 0) return;
    const [first, ...rest] = centers;
    descriptors.push({
      side,
      centers: [first, ...rest],
      translateX,
      translateY,
      translateZ: patternCenterZ,
      zRotation,
      wallSpan: fillW,
      allowClip,
    });
  };

  // Polygon footprint: emit one descriptor per axis-aligned outer edge.
  // Cutouts/handles only land on the outermost edge per cardinal (matching
  // resolvePolygonSideGeometry in maskPolygonEdges), so only that edge is
  // flagged allowClip; non-outermost edges get pure pattern.
  const cellMask = params.cellMask;
  if (isPartialMask(cellMask)) {
    const polygonWalls = collectPolygonWallSegments(
      cellMask,
      params.gridUnitMm,
      params.wallThickness
    );
    for (const seg of polygonWalls) {
      if (!slotFree[seg.side]) continue;
      addWall(
        seg.side,
        seg.wallSpan,
        seg.translateX,
        seg.translateY,
        seg.zRotation,
        seg.isOutermost
      );
    }
    return descriptors.length > 0 ? descriptors : null;
  }

  if (slotFree.front) addWall('front', innerW, 0, -innerD / 2);
  if (slotFree.back) addWall('back', innerW, 0, innerD / 2, 180);
  if (slotFree.left) addWall('left', innerD, -innerW / 2, 0, 90);
  if (slotFree.right) addWall('right', innerD, innerW / 2, 0, -90);

  return descriptors.length > 0 ? descriptors : null;
}

/**
 * Polygon outer-edge segment mapped to a cardinal wall for pattern tiling.
 * `translateX/Y` points at the edge's inner face midpoint in centered mm
 * (matching the rect-case anchor convention of wall pattern descriptors).
 */
interface PolygonWallSegment {
  readonly side: 'front' | 'back' | 'left' | 'right';
  readonly wallSpan: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly zRotation?: number;
  readonly isOutermost: boolean;
}

/**
 * Enumerate outer-perimeter edges of a polygon mask and map each to a
 * cardinal wall. For a CCW outer loop, an edge going +X has its interior
 * above (so the edge IS a front wall); +Y → right; -X → back; -Y → left.
 *
 * Each cardinal may have multiple external edges (L/T/U shapes); the edge
 * with the most extreme perpendicular coordinate is flagged as outermost,
 * matching wallCutoutBuilder/handleBuilder's single-edge binding for
 * cutouts and handles on polygon bins.
 */
function collectPolygonWallSegments(
  mask: CellMask,
  gridUnitMm: number,
  wallThickness: number
): PolygonWallSegment[] {
  const loops = maskToPolygon(mask);
  const outer = loops[0];
  if (outer.length < 3) return [];

  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * gridUnitMm) / 2;
  const inset = wallThickness + CLEARANCE / 2;

  interface RawSegment {
    readonly side: 'front' | 'back' | 'left' | 'right';
    readonly spanU: number;
    readonly midU: { readonly x: number; readonly y: number };
    readonly perpU: number;
    readonly zRotation?: number;
  }

  const segments: RawSegment[] = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const spanU = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (spanU === 0) continue;
    const midU = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // CCW outer: interior sits on the LEFT of edge direction. Identify the
    // wall this edge faces (which outer-normal side looks "out" the wall).
    if (dx === 1 && dy === 0) {
      segments.push({ side: 'front', spanU, midU, perpU: a.y });
    } else if (dx === -1 && dy === 0) {
      segments.push({ side: 'back', spanU, midU, perpU: a.y, zRotation: 180 });
    } else if (dx === 0 && dy === -1) {
      segments.push({ side: 'left', spanU, midU, perpU: a.x, zRotation: 90 });
    } else if (dx === 0 && dy === 1) {
      segments.push({ side: 'right', spanU, midU, perpU: a.x, zRotation: -90 });
    }
  }

  // Outermost per cardinal: reuse findPolygonEdgeForSide so the edge flagged
  // allowClip is the same one wallCutoutBuilder and handleBuilder place their
  // geometry on. Matching on our own ranking would risk diverging on symmetric
  // shapes (e.g. the two candidate back edges on a U-shape) where that function
  // applies a midpoint tiebreak — if the two paths disagreed, clip would land
  // on the wrong segment.
  const outermostKey = new Map<'front' | 'back' | 'left' | 'right', RawSegment>();
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const canonical = findPolygonEdgeForSide(mask, side);
    if (!canonical) continue;
    for (const seg of segments) {
      if (seg.side !== side) continue;
      if (Math.abs(seg.perpU - canonical.perpU) > 1e-9) continue;
      if (Math.abs(seg.spanU - canonical.spanU) > 1e-9) continue;
      if (Math.abs(seg.midU.x - canonical.midU.x) > 1e-9) continue;
      if (Math.abs(seg.midU.y - canonical.midU.y) > 1e-9) continue;
      outermostKey.set(side, seg);
      break;
    }
  }

  const result: PolygonWallSegment[] = [];
  for (const seg of segments) {
    const outerX = seg.midU.x * gridUnitMm - halfWidthMm;
    const outerY = seg.midU.y * gridUnitMm - halfDepthMm;
    let translateX = outerX;
    let translateY = outerY;
    switch (seg.side) {
      case 'front':
        translateY += inset;
        break;
      case 'back':
        translateY -= inset;
        break;
      case 'left':
        translateX += inset;
        break;
      case 'right':
        translateX -= inset;
        break;
    }
    const wallSpan = seg.spanU * gridUnitMm - CLEARANCE - 2 * wallThickness;
    if (wallSpan <= 0) continue;
    result.push({
      side: seg.side,
      wallSpan,
      translateX,
      translateY,
      zRotation: seg.zRotation,
      isOutermost: outermostKey.get(seg.side) === seg,
    });
  }
  return result;
}

/**
 * Compute expanded cutout dimensions for clipping hex patterns.
 *
 * The expansion creates a solid border zone around the cutout where no
 * hex pattern elements appear. Width expands by borderWidth on each side;
 * height expands by borderWidth at the bottom edge only (the top already
 * opens at the wall top).
 *
 * @param cutWidth - Original cutout width in mm
 * @param userCutHeight - Original cutout height (depth from wall top) in mm
 * @param borderWidth - Border width to add around the cutout in mm
 * @returns Expanded dimensions for the clipping solid
 */
export function getExpandedCutoutDimensions(
  cutWidth: number,
  userCutHeight: number,
  borderWidth: number
): {
  expandedWidth: number;
  expandedHeight: number;
} {
  return {
    expandedWidth: cutWidth + 2 * borderWidth,
    expandedHeight: userCutHeight + borderWidth,
  };
}

/**
 * Get wall pattern descriptors for any enabled pattern type.
 *
 * Convenience function that automatically selects the appropriate calculator
 * based on the pattern type in params.
 */
export function getPatternDescriptors(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): { descriptors: WallPatternDescriptor[]; calculator: PatternCalculator } | null {
  // Runtime guard: wallPattern may be missing from old saved data
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;

  // No pattern config, disabled, or no pattern type = solid walls (no pattern)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for old data
  if (!wallPattern?.enabled || wallPattern.pattern === undefined) {
    return null;
  }

  // Unknown pattern type = fallback to solid walls
  if (!(wallPattern.pattern in PATTERN_REGISTRY)) {
    return null;
  }

  const calculator = getPatternCalculator(wallPattern.pattern, params.height);
  const descriptors = getWallPatternDescriptors(params, innerW, innerD, wallHeight, calculator);

  if (!descriptors) {
    return null;
  }

  return { descriptors, calculator };
}
