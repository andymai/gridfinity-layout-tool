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

// Match the central library.updateEntry schema (validation/librarySchemas.ts):
// only {name?, preview?, author?} are accepted via the bus. v1's store action
// supports `modifiedAt` and `forkedFrom` too, but the central validation
// strips them before they reach the handler — so they're effectively v1
// store-internal fields, not CQRS-reachable. v2 mirrors that boundary.
const updatesSchema = z
  .object({
    name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
    preview: z.unknown(),
    author: z.string(),
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
    if (updates.preview !== undefined) changes.preview = updates.preview;
    if (updates.author !== undefined) changes.author = updates.author;

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
