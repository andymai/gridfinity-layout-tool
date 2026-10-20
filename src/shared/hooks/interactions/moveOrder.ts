import type { Bin, LayerId, Layout } from '@/core/types';
import { gridUnits } from '@/core/types';
import { changeOrder, landUpdates } from '@/shared/utils/changeOrder';
import type { SlantLayout } from '@/shared/utils/placedSlant';

/**
 * A group move's bins in an order where none is checked against a spot
 * another has yet to leave (see `changeOrder`). Bins that block each other in
 * a ring keep the order of how far along the move they start.
 */
export function moveOrder(
  bins: readonly Bin[],
  deltaX: number,
  deltaY: number,
  layerId: LayerId,
  layout: SlantLayout
): Bin[] {
  const along = (bin: Bin): number => bin.x * deltaX + bin.y * deltaY;
  return changeOrder(
    [...bins]
      .sort((a, b) => along(b) - along(a))
      .map((bin) => {
        // A move drops an explicit overhang, which may be all that held the bin upright.
        const { overhang: _dropped, ...moved } = bin;
        return {
          bin,
          to: { ...moved, x: gridUnits(bin.x + deltaX), y: gridUnits(bin.y + deltaY), layerId },
        };
      }),
    layout
  );
}

/**
 * Whether every move of a group lands when applied in `order`, each checked as
 * `bin.update` checks it, against the layout the moves before it leave.
 * Nothing rolls a group back once some of it has moved, so a drop that would
 * stop part way is refused whole.
 */
export function groupMoveLands(
  order: readonly Bin[],
  deltaX: number,
  deltaY: number,
  layerId: LayerId,
  layout: Layout
): boolean {
  return landUpdates(
    order.map((bin) => ({
      id: bin.id,
      updates: { x: gridUnits(bin.x + deltaX), y: gridUnits(bin.y + deltaY), layerId },
    })),
    layout
  ).lands;
}
