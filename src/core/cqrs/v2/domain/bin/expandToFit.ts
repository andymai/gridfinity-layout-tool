/**
 * Grow the selected bins until they fill the space around them.
 *
 * The whole selection resolves as one command rather than a `batch()` of
 * `bin.update` calls: expansion shifts footprints as well as adding overhang,
 * and an intermediate state is routinely invalid. Three 2u bins spanning 7u
 * land at 0 / 2.5 / 5, so moving the middle one first overlaps the third,
 * which is still at its old position — `canPlaceBin` (which excludes only the
 * bin under edit) would reject it. Resolving against the frozen aggregate and
 * writing every placement in one `apply` skips that window entirely.
 *
 * The payload carries intent (`ids`) only; placements are solved here so a
 * stale caller can't write positions computed against an older layout. The
 * event then carries the resolved placements because `apply` must replay from
 * its payload alone.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import type { BinId, GridUnits, OverhangConfig } from '@/core/types';
import { binId as toBinId, gridUnits } from '@/core/types';
import { resolveExpandToFit } from '@/shared/utils/expandToFit';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export interface ExpandedPlacement {
  readonly id: BinId;
  readonly x: GridUnits;
  readonly y: GridUnits;
  readonly overhang: OverhangConfig;
}

/** Enough of the prior state to reverse a placement; `overhang` absent = none. */
export interface ExpandedPlacementPrevious {
  readonly id: BinId;
  readonly x: GridUnits;
  readonly y: GridUnits;
  readonly overhang?: OverhangConfig;
}

export const expandToFit = defineCommand({
  type: 'bin.expandToFit',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.expandedToFit',
  schemaVersion: 1,
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: number;
      event: {
        payload: {
          placements: readonly ExpandedPlacement[];
          previous: readonly ExpandedPlacementPrevious[];
        };
      };
    },
    LayoutError
  > => {
    const ids = payload.ids.map(toBinId);
    const resolved = resolveExpandToFit(
      ctx.aggregate.bins,
      ids,
      ctx.aggregate,
      ctx.aggregate.baseplateParams
    );

    // The blocked reason travels in `reason` so the caller can show a message
    // specific to why it couldn't expand rather than a generic failure.
    if (!resolved.ok) {
      return err(layoutInvalidOperation('expandToFit', resolved.reason));
    }

    const byId = new Map(ctx.aggregate.bins.map((b) => [b.id, b]));
    const placements: ExpandedPlacement[] = [];
    const previous: ExpandedPlacementPrevious[] = [];
    for (const p of resolved.placements) {
      const bin = byId.get(p.binId);
      // Applying part of a plan would leave the very gaps it was meant to
      // close, so an unresolvable bin fails the whole command.
      if (!bin) return err(layoutInvalidOperation('expandToFit', 'ragged'));
      placements.push({
        id: p.binId,
        x: gridUnits(p.x),
        y: gridUnits(p.y),
        overhang: p.overhang,
      });
      previous.push({ id: bin.id, x: bin.x, y: bin.y, overhang: bin.overhang });
    }

    return ok({ value: placements.length, event: { payload: { placements, previous } } });
  },
  apply: (event, draft) => {
    for (const p of event.payload.placements) {
      const bin = draft.bins.find((b) => b.id === p.id);
      if (!bin) continue;
      bin.x = p.x;
      bin.y = p.y;
      bin.overhang = p.overhang;
    }
  },
});
