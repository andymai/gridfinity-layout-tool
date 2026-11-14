import type { Bin, BinId, LayerId, Layout } from '@/core/types';
import { gridUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { changeOrder, landUpdates } from '@/shared/utils/changeOrder';
import { pairPartner } from '@/shared/utils/binPairs';
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

/**
 * A swap as `bin.update` changes. Each bin lands on cells the other still
 * holds, so no order of two moves lands: the dragged bin waits in the stash,
 * which holds no cells, while the target takes its spot.
 */
export function swapUpdates(
  dragged: Bin,
  target: Bin,
  requiresRotation: boolean
): { id: BinId; updates: Partial<Bin> }[] {
  return [
    { id: dragged.id, updates: { layerId: STAGING_ID } },
    { id: target.id, updates: { x: dragged.x, y: dragged.y } },
    {
      id: dragged.id,
      updates: {
        layerId: dragged.layerId,
        x: target.x,
        y: target.y,
        width: requiresRotation ? dragged.depth : dragged.width,
        depth: requiresRotation ? dragged.width : dragged.depth,
      },
    },
  ];
}

/**
 * Whether the swap can run: every step of `swapUpdates` lands, each checked as
 * `bin.update` checks it, and neither bin has a pair partner on its layer. A
 * swap moves each bin alone, so it would split a placed pair.
 */
export function swapLands(
  dragged: Bin,
  target: Bin,
  requiresRotation: boolean,
  layout: Layout
): boolean {
  if (hasPartnerOnLayer(dragged, layout.bins) || hasPartnerOnLayer(target, layout.bins)) {
    return false;
  }
  return landUpdates(swapUpdates(dragged, target, requiresRotation), layout).lands;
}

function hasPartnerOnLayer(bin: Bin, bins: readonly Bin[]): boolean {
  return pairPartner(bin, bins)?.layerId === bin.layerId;
}
