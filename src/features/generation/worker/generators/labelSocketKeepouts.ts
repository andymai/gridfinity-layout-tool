import type { BinParams } from '@/shared/types/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_WALL_MM,
  defaultLabelShelfTopMm,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { isPartialMask } from '@/shared/utils/cellMask';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';
import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
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

/**
 * The air above a tab held below the interior ceiling. The fillet climbs to that
 * ceiling, so a corner rounded under the tab would stand proud of it by the
 * little the tab was held back. A tab the user lowered further is left out: well
 * below the ceiling, the rounded corner rising from it is just the corner.
 *
 * Reaches past any side the tab shares with a wall or divider, because the
 * fillet's bonding overlap runs inside them and a cut ending on their face would
 * leave a coplanar sliver for the fuse.
 */
export function planLabelShelfKeepouts(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number
): LabelSocketKeepout[] {
  if (!params.label.enabled || isPartialMask(params.cellMask)) return [];
  const layout = planLabelTabLayout(params, innerW, innerD, interiorHeight, wallThickness);
  if (!layout) return [];
  const { shelfTopZ, tabDepth } = layout.dims;
  const highest = defaultLabelShelfTopMm(
    interiorHeight,
    params.base.stackingLip,
    params.label,
    labelShelfKeepoutMm(params)
  );
  if (highest >= interiorHeight || shelfTopZ < highest) return [];

  const reach = 0.75 * Math.min(wallThickness, params.compartments.thickness);
  return layout.plannedRows.flatMap((planned) => {
    const towardBack = planned.anchor === 'back';
    return planned.slots.map((slot) => ({
      x0: slot.tabXStart - (slot.touchesLeft ? reach : 0),
      x1: slot.tabXStart + slot.tabWidth + (slot.touchesRight ? reach : 0),
      y0: towardBack ? slot.positionY - tabDepth : slot.positionY - reach,
      y1: towardBack ? slot.positionY + reach : slot.positionY + tabDepth,
      z0: shelfTopZ,
    }));
  });
}
