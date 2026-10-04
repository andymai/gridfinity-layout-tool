import type { BinParams } from '@/shared/types/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_WALL_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { planLabelPlateSeats } from './labelTabBuilder';

/** An axis-aligned box in the bin-interior frame, open upward from `z0`. */
export interface LabelSocketKeepout {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
}

/**
 * The air each label socket needs to stay open: the pocket footprint from its
 * floor up (a click-in plate drops in from above), plus the mouth corridor out
 * to the shelf edge for a slide channel. A feature fused after the tabs, such
 * as the interior fillet rounding the cavity's corners, must leave these
 * empty or a pocket running into a corner no longer takes its plate.
 *
 * Derived from the plate seats so a keep-out exists exactly where a socket
 * was cut.
 */
export function planLabelSocketKeepouts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): LabelSocketKeepout[] {
  const seats = planLabelPlateSeats(params, innerW, innerD, wallHeight, wallThickness);
  if (seats.length === 0) return [];
  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;
  const slide = params.label.socketStyle === 'slideChannel';

  return seats.map((seat) => {
    const halfW = (labelPlateWidthMm(seat.plateWidthU) + clearanceMm) / 2;
    const anchorEdge = seat.y - (seat.slideY * pocketD) / 2;
    const openEdge = slide
      ? anchorEdge + seat.slideY * (params.label.depth - LABEL_SOCKET_WALL_MM)
      : seat.y + (seat.slideY * pocketD) / 2;
    return {
      x0: seat.x - halfW,
      x1: seat.x + halfW,
      y0: Math.min(anchorEdge, openEdge),
      y1: Math.max(anchorEdge, openEdge),
      z0: seat.z,
    };
  });
}
