/**
 * The entry chamfer a cutout's depth allows. Kernel-free, so the nested-opening
 * plan measures the same outlines the cavity builder cuts.
 */

import { CHAMFER_SHAPES } from '@/shared/types/bin';

/** An entry chamfer narrower than this (mm) is cut as a straight wall. */
export const MIN_LOFTED_CHAMFER = 0.05;

/** The straight wall kept under any entry chamfer (mm). */
export const MIN_STRAIGHT_WALL_MM = 0.2;

/**
 * The entry chamfer a cut of `cutDepth` takes at its rim, clamped so a
 * straight wall always remains below the bevel (loft needs cutDepth − chamfer
 * > 0).
 */
export function entryChamferWidth(cutout: {
  readonly shape: string;
  readonly cutDepth: number;
  readonly chamferWidth?: number;
}): number {
  return (CHAMFER_SHAPES as readonly string[]).includes(cutout.shape) && cutout.chamferWidth
    ? Math.max(0, Math.min(cutout.chamferWidth, cutout.cutDepth - MIN_STRAIGHT_WALL_MM))
    : 0;
}
