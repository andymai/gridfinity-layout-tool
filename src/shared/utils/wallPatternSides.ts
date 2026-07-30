/**
 * Which outer walls a wall pattern applies to (#2966).
 *
 * Pure data helpers shared by the geometry pipeline, the print estimator and
 * the designer panel — the worker can't import designer utils and vice versa,
 * so the "absent means all four" contract lives here once rather than being
 * re-derived at each call site.
 */

import type { WallPatternConfig, WallPatternSides } from '@/shared/types/bin';

const ALL_SIDES: WallPatternSides = { left: true, right: true, front: true, back: true };

/**
 * Resolve the per-side selection, treating a missing config or a missing side
 * as ON so designs saved before the feature keep patterning all four walls.
 */
export function resolveWallPatternSides(pattern: WallPatternConfig): WallPatternSides {
  // Widened to Partial: the type says every side is present, but a persisted
  // design predating a side (or a crafted payload) can be missing keys, and the
  // whole point of this function is to normalize that.
  const sides = pattern.sides as Partial<WallPatternSides> | undefined;
  if (!sides) return ALL_SIDES;
  return {
    left: sides.left !== false,
    right: sides.right !== false,
    front: sides.front !== false,
    back: sides.back !== false,
  };
}

/** Whether at least one outer wall is selected (dividers are gated separately). */
export function hasAnyPatternedWall(pattern: WallPatternConfig): boolean {
  const sides = resolveWallPatternSides(pattern);
  return sides.left || sides.right || sides.front || sides.back;
}
