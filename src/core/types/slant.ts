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

/**
 * What a linked design's registry entry records about its slant, so layout
 * checks can size a placed bin's end support without loading the design.
 */
export interface DesignSlantFacts {
  /** The design's own slant. */
  readonly config?: SlantConfig;
  /** Something in the design keeps every slant off, a placed one included. */
  readonly blocked?: true;
  readonly extraWallMm?: number;
  /** The design's own units, which size its support; absent when they are the defaults. */
  readonly gridUnitMm?: number;
  readonly gridUnitMmY?: number;
  readonly heightUnitMm?: number;
}
