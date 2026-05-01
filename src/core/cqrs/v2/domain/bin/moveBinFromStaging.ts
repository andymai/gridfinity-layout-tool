/**
 * bin.moveFromStaging — v2 (defineCommand) shape.
 *
 * Migration note: the v1 event payload carried only `{id, layerId, x, y}`
 * which left replay drift — the bin's height needed to be re-derived from
 * the layer at apply time, and projection/replay.ts didn't update height
 * at all. The v2 event payload includes the resolved height so apply() is
 * deterministic without consulting the current layout state.
 *
 * `height` is optional on the type for backward compatibility with v1
 * persisted events; the v2 handler always populates it.
 */

import { z } from 'zod';
import type { Result, ValidationError, LayoutError } from '@/core/result';
import { ok, err } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { toPlacementError } from '@/core/store/layout/helpers';
import { layoutInvalidOperation, validationInvalidLayer } from '@/core/result';
import type { BinId, LayerId, GridUnits, HeightUnits } from '@/core/types';
import { binId as toBinId, layerId as toLayerId, gridUnits } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  id: z.string().min(1),
  layerId: z.string().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
});

export const moveBinFromStaging = defineCommand({
  type: 'bin.moveFromStaging',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.movedFromStaging',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binMoveFromStaging',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: {
        payload: { id: BinId; layerId: LayerId; x: GridUnits; y: GridUnits; height: HeightUnits };
      };
    },
    ValidationError | LayoutError
  > => {
    const id = toBinId(payload.id);
    const layerId = toLayerId(payload.layerId);

    const bin = ctx.aggregate.bins.find((b) => b.id === id);
    if (!bin) {
      return err(layoutInvalidOperation('moveBinFromStaging', `Bin ${id} not found`));
    }

    // Tighten v2 vs v1: the command name implies the source is in staging.
    // v1 silently re-moved bins regardless of source layer, which would
    // also re-stamp the bin's height to the target layer's height — a
    // footgun. Reject explicitly so the caller picks a more appropriate
    // command (e.g. bin.update for cross-layer moves).
    if (bin.layerId !== STAGING_ID) {
      return err(
        layoutInvalidOperation(
          'moveBinFromStaging',
          `Bin ${id} is not in staging (layerId=${bin.layerId})`
        )
      );
    }

    const layer = ctx.aggregate.layers.find((l) => l.id === layerId);
    if (!layer) {
      return err(validationInvalidLayer(layerId));
    }

    const x = gridUnits(payload.x);
    const y = gridUnits(payload.y);

    // Use the layer's height for collision checks (and on the bin itself
    // after the move) — staging bins keep their original height while in
    // staging, but a grid placement must fit the layer's slot.
    const rect = { x, y, width: bin.width, depth: bin.depth };
    const validationResult = canPlaceBin(
      { ...rect, height: layer.height },
      layerId,
      ctx.aggregate,
      id
    );
    if (!validationResult.valid) {
      return err(toPlacementError(validationResult.reason, rect));
    }

    return ok({
      value: undefined,
      event: { payload: { id, layerId, x, y, height: layer.height } },
    });
  },
  apply: (event, draft) => {
    const bin = draft.bins.find((b) => b.id === event.payload.id);
    if (!bin) return;
    bin.layerId = event.payload.layerId;
    bin.x = event.payload.x;
    bin.y = event.payload.y;
    // Defensive: height is always populated by the v2 handler, but the
    // event-payload type marks it optional for v1-replay back-compat.
    // Don't assume the field is present on a future replay path.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment
    if (event.payload.height !== undefined) {
      bin.height = event.payload.height;
    }
  },
});
