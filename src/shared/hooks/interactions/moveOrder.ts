import { produce } from 'immer';
import { isOk } from '@/core/result';
import { updateBin } from '@/core/cqrs/v2/domain/bin/updateBin';
import type { Bin, LayerId, Layout } from '@/core/types';
import { gridUnits } from '@/core/types';
import { footprintsOverlap } from '@/shared/utils/collision';
import { slantZone, type SlantLayout } from '@/shared/utils/placedSlant';

/**
 * A group move's bins in an order where none is checked against a spot
 * another has yet to leave: each move is checked against the layout as it
 * stands, so a bin whose new cells (its support's included) cover another
 * bin's current ones goes after it. Bins that block each other in a ring keep
 * the order of how far along the move they start.
 */
export function moveOrder(
  bins: readonly Bin[],
  deltaX: number,
  deltaY: number,
  layout: SlantLayout
): Bin[] {
  const along = (bin: Bin): number => bin.x * deltaX + bin.y * deltaY;
  const remaining = [...bins]
    .sort((a, b) => along(b) - along(a))
    .map((bin) => {
      // A move drops an explicit overhang, which may be all that held the bin upright.
      const { overhang: _dropped, ...moved } = bin;
      const to = { ...moved, x: gridUnits(bin.x + deltaX), y: gridUnits(bin.y + deltaY) };
      return { bin, from: slantZone(bin, layout), to: slantZone(to, layout) };
    });
  type Entry = (typeof remaining)[number];
  const waitsFor = (mover: Entry, other: Entry): boolean =>
    (mover.bin.layerId === other.bin.layerId || mover.to.slanted || other.from.slanted) &&
    mover.to.rects.some((r) => other.from.rects.some((s) => footprintsOverlap(r, s)));

  const ordered: Bin[] = [];
  while (remaining.length > 0) {
    const free = remaining.findIndex(
      (entry) => !remaining.some((other) => other !== entry && waitsFor(entry, other))
    );
    const [next] = remaining.splice(Math.max(free, 0), 1);
    ordered.push(next.bin);
  }
  return ordered;
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
  let current = layout;
  for (const bin of order) {
    const result = updateBin.handle(
      { id: bin.id, updates: { x: bin.x + deltaX, y: bin.y + deltaY, layerId } },
      { aggregate: current }
    );
    if (!isOk(result)) return false;
    const { payload } = result.value.event;
    current = produce(current, (draft) => {
      updateBin.apply({ type: 'bin.updated', payload }, draft);
    });
  }
  return true;
}
