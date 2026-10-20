import { produce } from 'immer';
import { isOk } from '@/core/result';
import { updateBin } from '@/core/cqrs/v2/domain/bin/updateBin';
import type { Bin, BinId, BinUpdates, Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { footprintsOverlap } from './collision';
import { slantZone, type SlantLayout } from './placedSlant';

export interface BinChange {
  readonly bin: Bin;
  readonly to: Bin;
}

/**
 * Changes to several bins in an order where none is checked against a spot
 * another has yet to leave: each change is checked against the layout as it
 * stands, so a bin whose new cells (its support's included) cover another
 * bin's current ones goes after it. Bins that block each other in a ring keep
 * the order they came in. The stash holds no cells, as placement ignores it.
 */
export function changeOrder(changes: readonly BinChange[], layout: SlantLayout): Bin[] {
  const remaining = changes.map(({ bin, to }) => ({
    bin,
    lands: to.layerId,
    from: slantZone(bin, layout),
    to: slantZone(to, layout),
  }));
  type Entry = (typeof remaining)[number];
  const waitsFor = (mover: Entry, other: Entry): boolean =>
    mover.lands !== STAGING_ID &&
    other.bin.layerId !== STAGING_ID &&
    (mover.lands === other.bin.layerId || mover.to.slanted || other.from.slanted) &&
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

export type UpdatesOutcome =
  | { readonly lands: true }
  /** `before` is the layout the refused update was checked against. */
  | { readonly lands: false; readonly refused: BinId; readonly before: Layout };

/**
 * Whether every update lands when applied in order, each checked as
 * `bin.update` checks it, against the layout the updates before it leave.
 */
export function landUpdates(
  updates: readonly { readonly id: BinId; readonly updates: BinUpdates }[],
  layout: Layout
): UpdatesOutcome {
  let current = layout;
  for (const update of updates) {
    const result = updateBin.handle(update, { aggregate: current });
    if (!isOk(result)) return { lands: false, refused: update.id, before: current };
    const { payload } = result.value.event;
    current = produce(current, (draft) => {
      updateBin.apply({ type: 'bin.updated', payload }, draft);
    });
  }
  return { lands: true };
}
