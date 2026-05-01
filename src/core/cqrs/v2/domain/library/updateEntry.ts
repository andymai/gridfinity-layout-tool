/**
 * library.updateEntry — v2 (defineCommand) shape, library aggregate.
 *
 * Permits partial updates to entry fields the v1 store action allows
 * (name, modifiedAt, preview, author, forkedFrom). Names are truncated
 * to NAME_MAX_LENGTH inside handle() so the event records the value that
 * actually lands.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutInvalidOperation } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { layoutId as toLayoutId } from '@/core/types';
import type { LayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const updatesSchema = z
  .object({
    name: z.string(),
    modifiedAt: z.number(),
    preview: z.record(z.string(), z.unknown()),
    author: z.string(),
    forkedFrom: z.unknown(),
  })
  .partial();

const payloadSchema = z.object({
  layoutId: z.string().min(1),
  updates: updatesSchema,
});

export const updateEntry = defineCommand({
  type: 'library.updateEntry',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryUpdated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryUpdateEntry',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<
    {
      value: undefined;
      event: { payload: { layoutId: LayoutId; changes: Record<string, unknown> } };
    },
    LayoutError
  > => {
    const id = toLayoutId(payload.layoutId);
    const existing = ctx.aggregate.entries.find((e) => e.id === id);
    if (!existing) {
      return err(layoutInvalidOperation('library.updateEntry', `Entry ${id} not found`));
    }

    const updates = payload.updates;
    const changes: Record<string, unknown> = {};
    if (updates.name !== undefined)
      changes.name = updates.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
    if (updates.modifiedAt !== undefined) changes.modifiedAt = updates.modifiedAt;
    if (updates.preview !== undefined) changes.preview = updates.preview;
    if (updates.author !== undefined) changes.author = updates.author;
    if (updates.forkedFrom !== undefined) changes.forkedFrom = updates.forkedFrom;

    return ok({
      value: undefined,
      event: { payload: { layoutId: id, changes } },
    });
  },
  apply: (event, draft) => {
    const entry = draft.entries.find((e) => e.id === event.payload.layoutId);
    if (entry) {
      Object.assign(entry as Record<string, unknown>, event.payload.changes);
    }
  },
});
