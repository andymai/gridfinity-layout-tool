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

/** Explicit per-placement overhang (mm). `null` clears it (inspector Reset). */
const overhangSchema = z
  .object({
    enabled: z.boolean().optional(),
    left: z.number().min(0),
    right: z.number().min(0),
    front: z.number().min(0),
    back: z.number().min(0),
    feet: z.boolean().optional(),
  })
  .nullable();

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
    linkedDesignId: z.string().nullable(),
    extendToMargin: z.boolean(),
    marginTaper: z.object({
      profile: z.enum(['chamfer', 'fillet']),
      bandHeight: z.number().min(0),
      enabled: z.boolean().optional(),
      flare: z.number().min(0).optional(),
    }),
    overhang: overhangSchema,
    locked: z.boolean(),
    // `null` unpairs (the wire form of "clear", like overhang).
    pairId: z.string().min(1).nullable(),
    pairRole: z.enum(['block', 'rest']).nullable(),
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
    result.linkedDesignId =
      updates.linkedDesignId === null ? undefined : toDesignId(updates.linkedDesignId);
  if (updates.extendToMargin !== undefined) result.extendToMargin = updates.extendToMargin;
  if (updates.marginTaper !== undefined) result.marginTaper = updates.marginTaper;
  // `null` is the wire form of "clear it"; the field itself is just optional.
  if (updates.overhang !== undefined) result.overhang = updates.overhang ?? undefined;
  if (updates.locked !== undefined) result.locked = updates.locked;
  if (updates.pairId !== undefined) result.pairId = updates.pairId ?? undefined;
  if (updates.pairRole !== undefined) result.pairRole = updates.pairRole ?? undefined;
  return result;
}

/**
 * A size-locked bin refuses dimension changes. Compared against the existing
 * values rather than merely present-in-payload, so a caller that re-sends the
 * bin's current width isn't rejected for a no-op. An update that unlocks in the
 * same call resizes freely — `changes.locked` wins over the stored flag.
 */
function violatesLock(existing: Bin, changes: Partial<Bin>): boolean {
  if (!(changes.locked ?? existing.locked)) return false;
  return (
    (changes.width !== undefined && changes.width !== existing.width) ||
    (changes.depth !== undefined && changes.depth !== existing.depth) ||
    (changes.height !== undefined && changes.height !== existing.height)
  );
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

    if (violatesLock(existing, changes)) {
      return err(layoutInvalidOperation('updateBin', `Bin ${id} is size-locked`));
    }

    const spatial =
      changes.x !== undefined ||
      changes.y !== undefined ||
      changes.width !== undefined ||
      changes.depth !== undefined ||
      changes.layerId !== undefined;

    // An explicit overhang is only correct for the position it was computed
    // for, so moving or resizing the bin drops it — otherwise a dragged bin
    // keeps extending into space it no longer borders, and footprint
    // validation would still read as legal. Skipped when the same update sets
    // an overhang itself (`'overhang' in changes`), which is how a caller
    // repositions and re-extends atomically.
    if (spatial && !('overhang' in changes) && existing.overhang !== undefined) {
      changes.overhang = undefined;
    }

    const merged: Bin = { ...existing, ...changes };

    if (spatial && merged.layerId !== STAGING_ID) {
      const rect = { x: merged.x, y: merged.y, width: merged.width, depth: merged.depth };
      const validationResult = canPlaceBin(
        { ...rect, height: merged.height, linkedDesignId: merged.linkedDesignId },
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
