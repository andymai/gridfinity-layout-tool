import {
  PUZZLE_HEAD_HALF,
  TONGUE_CLEARANCE,
  effectiveClearance,
} from '@/shared/constants/connectors';

export interface PrintBedMm {
  readonly widthMm: number;
  readonly depthMm: number;
}

/** The bed a split export cuts dividers for, and the nozzle their joints suit. */
export interface DividerBedFit {
  readonly printBed: PrintBedMm;
  readonly nozzleSizeMm?: number;
}

/** Plate kept between a groove's head and the plate's edge or a notch. */
const JOINT_EDGE_MARGIN_MM = 1;

/** Groove clearance per side, grown for a wider nozzle as the baseplate's is. */
export function dividerJointClearance(nozzleSizeMm?: number): number {
  return effectiveClearance(TONGUE_CLEARANCE, 0, nozzleSizeMm);
}

/**
 * The longest part a flat divider of `heightMm` can be on this bed: the long
 * side while the height fits the short one, the short side while it only fits
 * the long one, and null when it fits neither way.
 */
export function partLengthBudget(heightMm: number, bed: PrintBedMm): number | null {
  const long = Math.max(bed.widthMm, bed.depthMm);
  const short = Math.min(bed.widthMm, bed.depthMm);
  if (heightMm <= short) return long;
  if (heightMm <= long) return short;
  return null;
}

/** Half the height of the band a tongue and its groove need solid. */
export function tongueBandHalf(clearanceMm: number): number {
  return PUZZLE_HEAD_HALF + clearanceMm + JOINT_EDGE_MARGIN_MM;
}
