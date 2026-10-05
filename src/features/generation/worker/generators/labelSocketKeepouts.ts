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
 * The air a label plate passes through, from the pocket floor up: a click-in
 * plate drops in from above, and a slide-in plate travels out through the
 * mouth until it clears the shelf edge by its own depth. The interior fillet
 * is fused after the tabs are cut and must leave these empty.
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
      ? anchorEdge + seat.slideY * (params.label.depth - LABEL_SOCKET_WALL_MM + pocketD)
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
