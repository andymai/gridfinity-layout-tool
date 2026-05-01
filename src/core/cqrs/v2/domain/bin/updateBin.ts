/**
 * Update bin fields. Validates merged placement against the layout when
 * spatial fields change (same gate as the v1 store action); the event
 * carries both `changes` and `previous` so undo can revert in either
 * direction.
 */

import { z } from 'zod';
import type { Result, ValidationError, LayoutError } from '@/core/result';
import { ok, err } from '@/core/result';
import { STAGING_ID, CONSTRAINTS } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { toPlacementError } from '@/core/store/layout/helpers';
import { layoutInvalidOperation } from '@/core/result';
import type { Bin, BinId } from '@/core/types';
import {
  binId as toBinId,
  layerId as toLayerId,
  categoryId as toCategoryId,
  designId as toDesignId,
  gridUnits,
  heightUnits,
} from '@/core/types';
import { defineCommand } from '../../defineCommand';

const updatesSchema = z
  .object({
    layerId: z.string().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
    depth: z.number().gt(0).max(CONSTRAINTS.GRID_MAX),
    height: z.number().min(CONSTRAINTS.MIN_BIN_HEIGHT),
    clearanceHeight: z.number().min(0),
    category: z.string().min(1),
    label: z.string().max(CONSTRAINTS.LABEL_MAX_LENGTH),
    notes: z.string().max(CONSTRAINTS.NOTES_MAX_LENGTH),
    customProperties: z.record(z.string(), z.string()),
    linkedDesignId: z.string(),
  })
  .partial();

const payloadSchema = z.object({
  id: z.string().min(1),
  updates: updatesSchema,
});

/**
 * Cast the raw Zod-inferred update fields into branded types where the
 * `Bin` type requires them. Mirrors the brand-on-boundary pattern used in
 * addBin: payload arrives untyped, internal state is branded.
 */
function brandUpdates(updates: z.infer<typeof updatesSchema>): Partial<Bin> {
  const result: Partial<Bin> = {};
  if (updates.layerId !== undefined) result.layerId = toLayerId(updates.layerId);
  if (updates.x !== undefined) result.x = gridUnits(updates.x);
  if (updates.y !== undefined) result.y = gridUnits(updates.y);
  if (updates.width !== undefined) result.width = gridUnits(updates.width);
  if (updates.depth !== undefined) result.depth = gridUnits(updates.depth);
  if (updates.height !== undefined) result.height = heightUnits(updates.height);
  if (updates.clearanceHeight !== undefined)
    result.clearanceHeight = heightUnits(updates.clearanceHeight);
  if (updates.category !== undefined) result.category = toCategoryId(updates.category);
  if (updates.label !== undefined) result.label = updates.label;
  if (updates.notes !== undefined) result.notes = updates.notes;
  if (updates.customProperties !== undefined) result.customProperties = updates.customProperties;
  if (updates.linkedDesignId !== undefined)
    result.linkedDesignId = toDesignId(updates.linkedDesignId);
  return result;
}

function capturePrevious(bin: Bin, changes: Partial<Bin>): Partial<Bin> {
  const previous: Partial<Bin> = {};
  for (const key of Object.keys(changes) as Array<keyof Bin>) {
    (previous as Record<string, unknown>)[key as string] = bin[key];
  }
  return previous;
}

export const updateBin = defineCommand({
  type: 'bin.update',
  aggregate: 'layout',
  aggregateId: () => 'layout',
  payload: payloadSchema,
  emitted: 'bin.updated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.binUpdate',
  middleware: { undoCapture: true, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: { payload: { id: BinId; changes: Partial<Bin>; previous: Partial<Bin> } };
    },
    ValidationError | LayoutError
  > => {
    const id = toBinId(payload.id);
    const existing = ctx.aggregate.bins.find((b) => b.id === id);
    if (!existing) {
      return err(layoutInvalidOperation('updateBin', `Bin ${id} not found`));
    }

    const changes = brandUpdates(payload.updates);
    const merged: Bin = { ...existing, ...changes };

    // Validate placement when spatial properties change for on-grid bins.
    const spatial =
      changes.x !== undefined ||
      changes.y !== undefined ||
      changes.width !== undefined ||
      changes.depth !== undefined ||
      changes.layerId !== undefined;

    if (spatial && merged.layerId !== STAGING_ID) {
      const rect = { x: merged.x, y: merged.y, width: merged.width, depth: merged.depth };
      const validationResult = canPlaceBin(
        { ...rect, height: merged.height },
        merged.layerId,
        ctx.aggregate,
        id
      );
      if (!validationResult.valid) {
        return err(toPlacementError(validationResult.reason, rect));
      }
    }

    const previous = capturePrevious(existing, changes);

    return ok({
      value: undefined,
      event: { payload: { id, changes, previous } },
    });
  },
  apply: (event, draft) => {
    const bin = draft.bins.find((b) => b.id === event.payload.id);
    if (bin) Object.assign(bin, event.payload.changes);
  },
});
