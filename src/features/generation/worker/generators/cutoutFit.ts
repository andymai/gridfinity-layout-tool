/**
 * How big a cutout is actually cut: its insertion clearance and the entry
 * chamfer its depth allows. Kernel-free, so the nested-opening plan measures
 * the same outlines the cavity builder cuts.
 */

import { CHAMFER_SHAPES, CLEARANCE_SHAPES } from '@/shared/types/bin';

/** An entry chamfer narrower than this (mm) is cut as a straight wall. */
export const MIN_LOFTED_CHAMFER = 0.05;

/** The straight wall kept under any entry chamfer (mm). */
export const MIN_STRAIGHT_WALL_MM = 0.2;

/**
 * A cutout's profile size once its insertion clearance is applied. The
 * clearance enlarges the cut symmetrically about its own center so a part cut
 * to spec drops in; the cutout stays positioned by its nominal center, so the
 * enlarged shape stays aligned. Missing clearance / non-insert shapes keep
 * their exact nominal size.
 */
export function clearedProfile(cutout: {
  readonly shape: string;
  readonly width: number;
  readonly depth: number;
  readonly clearance?: number;
}): { readonly clearance: number; readonly w: number; readonly d: number } {
  const clearance =
    (CLEARANCE_SHAPES as readonly string[]).includes(cutout.shape) && cutout.clearance !== undefined
      ? Math.max(0, cutout.clearance)
      : 0;
  const d = cutout.depth + clearance;
  // Polygons scale uniformly (across-flats = depth grows by clearance) so the
  // result stays a *regular* N-gon; a flat additive box offset would skew the
  // width/depth ratio. Other shapes use a symmetric additive offset.
  const w =
    cutout.shape === 'polygon' && cutout.depth > 0
      ? cutout.width * (d / cutout.depth)
      : cutout.width + clearance;
  return { clearance, w, d };
}

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
