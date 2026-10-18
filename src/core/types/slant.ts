/** The side a slanted bin's top leans toward, in the bin's frame (front = -Y, left = -X). */
export const SLANT_SIDES = ['front', 'back', 'left', 'right'] as const;
export type SlantSide = (typeof SLANT_SIDES)[number];

export const SLANT_MAX_DEG = 60;
/** Past this the leaning wall's underside prints as unsupported overhang. */
export const SLANT_WARN_DEG = 45;

/**
 * Leans everything above a bin's floor toward one side, keeping the socket
 * upright. A shear, not a rotation: every horizontal section keeps its shape
 * and moves sideways by `tan(angleDeg)` per mm of rise, so a wall's horizontal
 * thickness (what the slicer prints) holds at every height.
 *
 * Absent for upright bins, so their params serialize byte-identically.
 */
export interface SlantConfig {
  readonly angleDeg: number;
  readonly side: SlantSide;
  /** Export a wedge the leaning top rests on, as a second part. */
  readonly endSupport?: boolean;
}
