import { CLEARANCE_SHAPES } from '@/shared/types/bin';

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
