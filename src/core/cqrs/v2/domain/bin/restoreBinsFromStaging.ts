/**
 * Return staged bins to a layer at their own x and y, in one store update.
 * Each bin is checked as `bin.update` checks a layer change, with the bins
 * before it already back, and the restore stops at the first bin that does
 * not fit. A loop of `bin.update` gives the same result with one store update
 * and one full validation per bin.
 */

import { z } from 'zod';
import { ok, err, validationInvalidLayer } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { insideDrawer } from '@/shared/utils/validationPlacement';
import { footprintsOverlap } from '@/shared/utils/collision';
import { placedSlant } from '@/shared/utils/placedSlant';
import { getRestingStack, newViolations, resolveRestingStack } from '@/shared/utils/restingStack';
import type { Bin, Layout } from '@/core/types';
import { binId as toBinId, layerId as toLayerId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  ids: z.array(z.string().min(1)).readonly(),
  layerId: z.string().min(1),
});

function cellKeys(bin: Bin): string[] {
  const keys: string[] = [];
  for (let x = Math.floor(bin.x); x < Math.ceil(bin.x + bin.width); x++) {
    for (let y = Math.floor(bin.y); y < Math.ceil(bin.y + bin.depth); y++) keys.push(`${x},${y}`);
  }
  return keys;
}

/** How many leading bins have a free footprint, each after the ones before it. */
function freeFootprints(layout: Layout, placed: readonly Bin[], restored: readonly Bin[]): number {
  const byCell = new Map<string, Bin[]>();
  const file = (bin: Bin): void => {
    for (const key of cellKeys(bin)) {
      const filed = byCell.get(key);
      if (filed) filed.push(bin);
      else byCell.set(key, [bin]);
    }
  };
  const layerId = restored[0].layerId;
  for (const bin of placed) if (bin.layerId === layerId) file(bin);

  for (let i = 0; i < restored.length; i++) {
    const bin = restored[i];
    const hit = cellKeys(bin).some((key) =>
      byCell.get(key)?.some((other) => footprintsOverlap(bin, other))
    );
    if (hit || !insideDrawer(bin, layout).valid) return i;
    file(bin);
  }
  return restored.length;
}

/**
 * The bins that fit, found without a full check per bin, or null where that
 * could give a different answer. With no clearance, no bin can rest on
 * clearance; each returned bin only raises the stacks above it, so a stack
 * that goes over the drawer stays over, and the bins that fit are the longest
 * run that keeps every stack in. With no slant, no end support needs room.
 */
function fitAtOnce(layout: Layout, placed: readonly Bin[], restored: readonly Bin[]): Bin[] | null {
  const all = [...placed, ...restored];
  if (all.some((b) => (b.clearanceHeight ?? 0) > 0 || placedSlant(b, layout) !== null)) {
    return null;
  }

  const before = getRestingStack(layout.bins, layout.layers);
  const fits = (count: number): boolean => {
    const after = resolveRestingStack([...placed, ...restored.slice(0, count)], layout.layers);
    return newViolations(before, after, layout.drawer.height).length === 0;
  };

  const free = freeFootprints(layout, placed, restored);
  if (fits(free)) return restored.slice(0, free);
  let lo = 0;
  let hi = free;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return restored.slice(0, lo);
}

function fitInTurn(layout: Layout, placed: readonly Bin[], restored: readonly Bin[]): Bin[] {
  // Grown only by appending: the resting-stack cache keys on the array and its
  // length, so a bin replaced in place would read a stale stack.
  const bins = [...placed];
  const current: Layout = { ...layout, bins };
  const fitted: Bin[] = [];
  for (const bin of restored) {
    const placement = canPlaceBin(
      {
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
        linkedDesignId: bin.linkedDesignId,
        slant: bin.slant,
        halfTurned: bin.halfTurned,
        extendToMargin: bin.extendToMargin,
        overhang: bin.overhang,
      },
      bin.layerId,
      current,
      bin.id
    );
    if (!placement.valid) break;
    bins.push(bin);
    fitted.push(bin);
  }
  return fitted;
}

export const restoreBinsFromStaging = defineCommand({
  type: 'bin.restoreFromStaging',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.restoredFromStaging',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const layout = ctx.aggregate;
    const layerId = toLayerId(payload.layerId);
    if (!layout.layers.some((l) => l.id === layerId)) {
      return err(validationInvalidLayer(layerId));
    }

    const staged = new Map(
      layout.bins.filter((b) => b.layerId === STAGING_ID).map((b) => [b.id, b])
    );
    const restored: Bin[] = [];
    for (const id of new Set(payload.ids.map(toBinId))) {
      const bin = staged.get(id);
      if (bin) restored.push({ ...bin, layerId, overhang: undefined });
    }

    const placed = layout.bins.filter((b) => b.layerId !== STAGING_ID);
    const fitted =
      restored.length === 0
        ? []
        : (fitAtOnce(layout, placed, restored) ?? fitInTurn(layout, placed, restored));

    const moves = fitted.map((bin) => {
      const previousOverhang = staged.get(bin.id)?.overhang;
      return previousOverhang === undefined ? { id: bin.id } : { id: bin.id, previousOverhang };
    });

    return ok({
      value: moves.length,
      event: { payload: { layerId, moves } },
    });
  },
  apply: (event, draft) => {
    if (event.payload.moves.length === 0) return;
    const ids = new Set(event.payload.moves.map((m) => m.id));
    for (const bin of draft.bins) {
      if (!ids.has(bin.id)) continue;
      bin.layerId = event.payload.layerId;
      if (bin.overhang !== undefined) bin.overhang = undefined;
    }
  },
});
