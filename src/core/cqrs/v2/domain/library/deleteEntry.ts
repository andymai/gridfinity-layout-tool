/**
 * Delete a library entry. Rejects deleting the last remaining entry.
 * If the deleted entry was the active layout, apply() advances
 * `activeLayoutId` to the first remaining entry.
 */

import { z } from 'zod';
import type { Result, LayoutError } from '@/core/result';
import { ok, err, layoutLastEntity } from '@/core/result';
import type { LayoutId } from '@/core/types';
import { layoutId as toLayoutId } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({ layoutId: z.string().min(1) });

export const deleteEntry = defineCommand({
  type: 'library.deleteEntry',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryDeleted',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryDeleteEntry',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (
    payload,
    ctx
  ): Result<{ value: undefined; event: { payload: { layoutId: LayoutId } } }, LayoutError> => {
    const id = toLayoutId(payload.layoutId);
    const library = ctx.aggregate;

    if (library.entries.length <= 1) {
      return err(layoutLastEntity('layout'));
    }

    return ok({
      value: undefined,
      event: { payload: { layoutId: id } },
    });
  },
  apply: (event, draft) => {
    const id = event.payload.layoutId;
    draft.entries = draft.entries.filter((e) => e.id !== id);
    // Match v1 cascade: if the deleted entry was active, advance to the
    // first remaining entry. If no entries remain, leave activeLayoutId
    // alone (pre-validation guarantees length > 0 here).
    if (draft.activeLayoutId === id && draft.entries.length > 0) {
      draft.activeLayoutId = draft.entries[0].id;
    }
  },
});
