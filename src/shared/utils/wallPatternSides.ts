/**
 * Which outer walls a wall pattern applies to (#2966).
 *
 * Pure data helpers shared by the geometry pipeline, the print estimator and
 * the designer panel — the worker can't import designer utils and vice versa,
 * so the "absent means all four" contract lives here once rather than being
 * re-derived at each call site.
 */

import type { WallPatternConfig, WallPatternSides } from '@/shared/types/bin';

/**
 * Resolve the per-side selection, treating an absent `sides` record — or an
 * absent key within one — as ON, so designs saved before the field existed keep
 * patterning all four walls. Returns a fresh record on every call; callers hold
 * it in component state and spread it, so a shared one could be mutated.
 */
export function resolveWallPatternSides(pattern: WallPatternConfig): WallPatternSides {
  // Widened to Partial: the type says every side is present, but a persisted
  // design predating the field (or a crafted payload) can omit it or be a key
  // short, and the whole point of this function is to normalize that.
  const sides = pattern.sides as Partial<WallPatternSides> | undefined;
  return {
    left: sides?.left !== false,
    right: sides?.right !== false,
    front: sides?.front !== false,
    back: sides?.back !== false,
  };
}

/** Whether at least one outer wall is selected (dividers are gated separately). */
export function hasAnyPatternedWall(pattern: WallPatternConfig): boolean {
  const sides = resolveWallPatternSides(pattern);
  return sides.left || sides.right || sides.front || sides.back;
}
