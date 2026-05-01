/**
 * Create a library entry from an imported Layout. Emits the same
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
    // expects a Layout. Trust the caller — bus dispatch is internal,
    // and the prior v1 handler took the same shortcut.
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
    // Same fallback as createEntry.apply(): persisted events that
    // predate the `entry` field carry only {layoutId, name}.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- entry is optional for back-compat with persisted events
    const entry: LayoutEntry = event.payload.entry ?? {
      id: event.payload.layoutId,
      name: event.payload.name,
      createdAt: 0,
      modifiedAt: 0,
      preview: {
        drawerWidth: 6 as LayoutEntry['preview']['drawerWidth'],
        drawerDepth: 4 as LayoutEntry['preview']['drawerDepth'],
        drawerHeight: 7 as LayoutEntry['preview']['drawerHeight'],
        binCount: 0,
        layerCount: 1,
      },
    };
    draft.entries.push(entry);
  },
});
