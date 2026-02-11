/**
 * Wall pattern configuration for brepjs.
 *
 * Pure data module — determines which walls get pattern cuts and calculates
 * element center positions + wall transforms. No brepjs imports; the caller
 * (binGenerator) builds actual 3D shapes to avoid WASM GC scope issues.
 */

import type { BinParams } from '@/shared/types/bin';
import type { PatternCenter, PatternCalculator } from './patterns';
import {
  getPatternCalculator,
  PATTERN_REGISTRY,
  HoneycombPatternCalculator,
  DEFAULT_HEX_WEB_THICKNESS,
} from './patterns';

// Re-export for backward compatibility
export { calculateHexCenters, type HexCenter, type HexGridConfig } from './hexGrid';

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
  /** Element center positions on the flat XY grid (before wall rotation) */
  readonly centers: PatternCenter[];
  /** Translation to position pattern panel on wall face */
  readonly translateX: number;
  readonly translateY: number;
  readonly translateZ: number;
  /** Optional Z-axis rotation (degrees) for wall orientation */
  readonly zRotation?: number;
}

/** @deprecated Use WallPatternDescriptor instead */
export type WallHexDescriptor = WallPatternDescriptor;

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

/** @deprecated Use DEFAULT_HEX_RADIUS from patterns/honeycombPattern instead */
export const HEX_RADIUS = 1.8;
/** @deprecated Use DEFAULT_HEX_WEB_THICKNESS from patterns/honeycombPattern instead */
export const WEB_THICKNESS = 0.8;

/** Keep-out from wall top edge (stacking lip interface). */
export const TOP_KEEP_OUT = 1.5;

/**
 * Minimum keep-out from wall bottom edge (base/floor junction).
 * Actual keep-out uses max(this, wallThickness) so pattern prisms never
 * cut into the floor at the wall-floor junction.
 */
export const MIN_BOTTOM_KEEP_OUT = 1.0;

/**
 * Calculate minimum pattern height for a given calculator.
 * Delegates to the calculator's own method for pattern-specific calculations.
 */
function getMinPatternHeight(calculator: PatternCalculator): number {
  return calculator.getMinPatternHeight();
}

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
export function getWallPatternDescriptors(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  calculator: PatternCalculator
): WallPatternDescriptor[] | null {
  if (!params.wallPattern.enabled) {
    return null;
  }

  // Keep-out from bottom must clear the floor (shell thickness = wallThickness)
  // so pattern prisms don't cut into the floor-wall junction.
  const bottomKeepOut = Math.max(MIN_BOTTOM_KEEP_OUT, params.wallThickness);

  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  const minHeight = getMinPatternHeight(calculator);

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
    fillW: number,
    translateX: number,
    translateY: number,
    zRotation?: number
  ): void => {
    const centers = calculator.calculateCenters({ fillW, fillH: patternHeight });
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

/**
 * Calculate honeycomb wall descriptors for wall pattern mode.
 *
 * @deprecated Use getWallPatternDescriptors with getPatternCalculator instead.
 * This function is kept for backward compatibility.
 *
 * @returns Array of wall descriptors, or null if disabled/no valid walls
 */
export function getHoneycombWallDescriptors(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hexRadiusOverride?: number
): WallPatternDescriptor[] | null {
  // Runtime guard: wallPattern may be missing from old saved data
  const wallPattern = params.wallPattern as typeof params.wallPattern | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for old data
  if (!wallPattern?.enabled || wallPattern.pattern !== 'honeycomb') {
    return null;
  }

  // Use legacy path with override support
  const calculator = hexRadiusOverride
    ? getPatternCalculator('honeycomb', 1) // Base calculator, radius ignored
    : getPatternCalculator('honeycomb', params.height);

  // If override provided, create custom calculator with that radius
  if (hexRadiusOverride) {
    const customCalculator = new HoneycombPatternCalculator(
      hexRadiusOverride,
      DEFAULT_HEX_WEB_THICKNESS
    );
    return getWallPatternDescriptors(params, innerW, innerD, wallHeight, customCalculator);
  }

  return getWallPatternDescriptors(params, innerW, innerD, wallHeight, calculator);
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
