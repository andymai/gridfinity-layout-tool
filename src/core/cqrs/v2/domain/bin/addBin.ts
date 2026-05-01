/**
 * bin.add command — v2 (defineCommand) shape.
 *
 * Mirrors the contract of the v1 `handleAddBin` + `useLayoutStore.addBin`
 * pair, but split along v2's boundary:
 * - `handle()`: validate against frozen layout snapshot, generate the new
 *   BinId, return the full `Bin` object inside the event payload.
 * - `apply()`: push the bin onto the layout draft. No re-read needed —
 *   the event carries everything.
 */

import { z } from 'zod';
import { ok, err } from '@/core/result';
import { generateBinId, STAGING_ID, CONSTRAINTS } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { toPlacementError } from '@/core/store/layout/helpers';
import { validationInvalidLayer } from '@/core/result';
import type { Bin } from '@/core/types';
import {
  layerId as toLayerId,
  categoryId as toCategoryId,
  designId as toDesignId,
  gridUnits,
  heightUnits,
} from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layerId: z.string().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
  depth: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
  height: z.number().min(CONSTRAINTS.MIN_BIN_HEIGHT),
  clearanceHeight: z.number().min(0).optional(),
  category: z.string().min(1),
  label: z.string().max(CONSTRAINTS.LABEL_MAX_LENGTH),
  notes: z.string().max(CONSTRAINTS.NOTES_MAX_LENGTH),
  customProperties: z.record(z.string(), z.string()).optional(),
  linkedDesignId: z.string().optional(),
});

export const addBin = defineCommand({
  type: 'bin.add',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.added',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binAdd',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (payload, ctx) => {
    // Brand at the CQRS boundary (codebase convention: brand on
    // deserialization). Payload arrives as plain strings/numbers from Zod;
    // Bin and downstream APIs require branded LayerId/CategoryId/GridUnits/
    // HeightUnits. Brand once up front so the rest of the handler is type-
    // safe end-to-end.
    const layerId = toLayerId(payload.layerId);
    const category = toCategoryId(payload.category);
    const x = gridUnits(payload.x);
    const y = gridUnits(payload.y);
    const width = gridUnits(payload.width);
    const depth = gridUnits(payload.depth);
    const height = heightUnits(payload.height);
    const clearanceHeight =
      payload.clearanceHeight !== undefined ? heightUnits(payload.clearanceHeight) : undefined;
    const linkedDesignId =
      payload.linkedDesignId !== undefined ? toDesignId(payload.linkedDesignId) : undefined;

    if (layerId !== STAGING_ID) {
      const layer = ctx.aggregate.layers.find((l) => l.id === layerId);
      if (!layer) {
        return err(validationInvalidLayer(layerId));
      }

      const rect = { x, y, width, depth };
      const validationResult = canPlaceBin({ ...rect, height }, layerId, ctx.aggregate);
      if (!validationResult.valid) {
        return err(toPlacementError(validationResult.reason, rect));
      }
    }

    // Generate the BinId only after validation passes so rejected commands
    // don't burn an id.
    const bin: Bin = {
      ...payload,
      id: generateBinId(),
      layerId,
      category,
      x,
      y,
      width,
      depth,
      height,
      clearanceHeight,
      linkedDesignId,
    };

    return ok({
      value: bin.id,
      event: { payload: { bin } },
    });
  },
  apply: (event, draft) => {
    draft.bins.push(event.payload.bin);
  },
});
