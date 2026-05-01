/**
 * layer.delete — v2 (defineCommand) shape.
 *
 * Per-command refactor: v1's store action cascaded by remapping bins on
 * the deleted layer to STAGING_ID. The v1 event payload only carried
 * `{layer, deletedBinCount}` — the actual displaced bin IDs were lost,
 * so replay against a divergent layout produced the wrong cascade. v2
 * widens the payload with `displacedBinIds` so apply() can target the
 * exact set deterministically.
 *
 * `deletedBinCount` is preserved on the payload for v1 consumer
 * compatibility (analytics / audit log) even though it's now derivable
 * from `displacedBinIds.length`.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutLastEntity, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import type { BinId, Layer } from '@/core/types';
import { layerId as toLayerId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ id: z.string().min(1) });

export const deleteLayer = defineCommand({
  type: 'layer.delete',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'layer.deleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.layerDelete',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: {
        payload: {
          layer: Layer;
          deletedBinCount: number;
          displacedBinIds: ReadonlyArray<BinId>;
        };
      };
    },
    LayoutError
  > => {
    const id = toLayerId(payload.id);
    const layout = ctx.aggregate;

    if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
      return err(layoutLastEntity('layer'));
    }

    const layer = layout.layers.find((l) => l.id === id);
    if (!layer) {
      return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
    }

    // STAGING_ID is the sentinel layer id never present in layout.layers,
    // so `b.layerId === id` (where id is a real layer) inherently excludes
    // staging-bound bins. No explicit STAGING_ID guard needed here.
    const displacedBinIds = layout.bins.filter((b) => b.layerId === id).map((b) => b.id);

    return ok({
      value: undefined,
      event: {
        payload: {
          layer: { ...layer },
          deletedBinCount: displacedBinIds.length,
          displacedBinIds,
        },
      },
    });
  },
  apply: (event, draft) => {
    draft.layers = draft.layers.filter((l) => l.id !== event.payload.layer.id);
    if (event.payload.displacedBinIds.length > 0) {
      const idSet = new Set(event.payload.displacedBinIds);
      for (const bin of draft.bins) {
        if (idSet.has(bin.id)) bin.layerId = STAGING_ID;
      }
    }
  },
});
