/**
 * library.importLayout — v2 (defineCommand) shape, library aggregate.
 *
 * Creates a new library entry from an imported Layout. Computes the
 * preview from the layout via `computePreview`. Emits the same
 * `library.entryCreated` event as createEntry so downstream subscribers
 * (analytics, persistence) handle imports identically.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { computePreview } from '@/core/storage';
import type { Layout, LayoutEntry } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layout: z.unknown(),
  name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
});

export const importLayout = defineCommand({
  type: 'library.importLayout',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryCreated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryImportLayout',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload, ctx) => {
    // Central validation treats `layout` as `unknown`; computePreview
    // expects a Layout. Trust the caller (matches v1 — v1 handler also
    // passes payload.layout straight to computePreview).
    const layout = payload.layout as Layout;
    const id = generateLayoutId();
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
    const now = Date.now();
    const entry: LayoutEntry = {
      id,
      name,
      createdAt: now,
      modifiedAt: now,
      author: ctx.aggregate.settings.authorName,
      preview: computePreview(layout),
    };

    return ok({
      value: id,
      event: { payload: { layoutId: id, name, entry } },
    });
  },
  apply: (event, draft) => {
    // Same shape as createEntry's apply — entry is always populated by
    // the v2 handler but typed optional for v1-replay back-compat.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- entry is optional on the event type
    if (event.payload.entry === undefined) return;
    draft.entries.push(event.payload.entry);
  },
});
