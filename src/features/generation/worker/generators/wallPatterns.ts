/**
 * Wall pattern configuration for brepjs.
 *
 * Pure data module — determines which walls get honeycomb cuts and calculates
 * hex center positions + wall transforms. No brepjs imports; the caller
 * (binGenerator) builds actual 3D shapes to avoid WASM GC scope issues.
 */

import type { BinParams } from '@/shared/types/bin';
import { calculateHexCenters } from './hexGrid';
import type { HexCenter } from './hexGrid';

/**
 * Identifies which walls are free of divider slot grooves.
 * Honeycomb patterns can only be applied to slot-free walls.
 */
export interface SlotFreeWalls {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Descriptor for a single wall's honeycomb hex positions + transform. */
export interface WallHexDescriptor {
  /** Hex center positions on the flat XY grid (before wall rotation) */
  readonly centers: HexCenter[];
  /** Translation to position hex panel on wall face */
  readonly translateX: number;
  readonly translateY: number;
  readonly translateZ: number;
  /** Optional Z-axis rotation (degrees) for wall orientation */
  readonly zRotation?: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Circumradius of each hex hole (center to vertex). ~3.1mm flat-to-flat. */
export const HEX_RADIUS = 1.8;
/** Solid web between adjacent hex edges. */
export const WEB_THICKNESS = 0.8;
/** Keep-out from wall top edge (stacking lip interface). */
const TOP_KEEP_OUT = 1.5;
/**
 * Minimum keep-out from wall bottom edge (base/floor junction).
 * Actual keep-out uses max(this, wallThickness) so hex prisms never
 * cut into the floor at the wall-floor junction.
 */
const MIN_BOTTOM_KEEP_OUT = 1.0;
/** Minimum usable pattern height (need at least one full hex row). */
const MIN_PATTERN_HEIGHT = Math.sqrt(3) * HEX_RADIUS + WEB_THICKNESS;

/**
 * Calculate honeycomb wall descriptors for wall pattern mode.
 *
 * Returns pure data describing hex positions and wall transforms.
 * The caller builds brepjs shapes inline (same scope as the cut operation)
 * to avoid WASM GC issues with shapes crossing function boundaries.
 *
 * @returns Array of wall descriptors, or null if disabled/no valid walls
 */
export function getHoneycombWallDescriptors(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hexRadiusOverride?: number
): WallHexDescriptor[] | null {
  if (!params.wallPattern.enabled) {
    return null;
  }

  // Keep-out from bottom must clear the floor (shell thickness = wallThickness)
  // so hex prisms don't cut into the floor-wall junction.
  const bottomKeepOut = Math.max(MIN_BOTTOM_KEEP_OUT, params.wallThickness);

  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  if (patternHeight < MIN_PATTERN_HEIGHT) {
    return null;
  }

  const slotFree = getSlotFreeWalls(params);
  if (!slotFree.front && !slotFree.back && !slotFree.left && !slotFree.right) {
    return null;
  }

  const patternCenterZ = bottomKeepOut + patternHeight / 2;

  const radius = hexRadiusOverride ?? HEX_RADIUS;
  const hexConfig = {
    hexRadius: radius,
    webThickness: WEB_THICKNESS,
  };

  const descriptors: WallHexDescriptor[] = [];

  const addWall = (
    fillW: number,
    translateX: number,
    translateY: number,
    zRotation?: number
  ): void => {
    const centers = calculateHexCenters({ ...hexConfig, fillW, fillH: patternHeight });
    if (centers.length === 0) return;
    descriptors.push({
      centers,
      translateX,
      translateY,
      translateZ: patternCenterZ,
      zRotation,
    });
  };

  if (slotFree.front) addWall(innerW, 0, -innerD / 2);
  if (slotFree.back) addWall(innerW, 0, innerD / 2, 180);
  if (slotFree.left) addWall(innerD, -innerW / 2, 0, 90);
  if (slotFree.right) addWall(innerD, innerW / 2, 0, -90);

  return descriptors.length > 0 ? descriptors : null;
}
