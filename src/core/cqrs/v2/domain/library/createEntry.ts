/**
 * library.createEntry — v2 (defineCommand) shape, library aggregate.
 *
 * First library-aggregate v2 command. The runtime's library path applies
 * via useLibraryStore.setState, so apply() receives the LayoutLibrary
 * draft directly.
 *
 * The default preview matches v1's getDefaultPreview helper. The author
 * fallback (`payload.author ?? library.settings.authorName`) preserves
 * v1 behavior so unauthenticated entries still pick up the user's
 * configured author.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { generateLayoutId } from '@/shared/utils';
import { gridUnits, heightUnits, layoutId as toLayoutId } from '@/core/types';
import type { LayoutEntry, LayoutPreview } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const previewSchema = z
  .object({
    drawerWidth: z.number(),
    drawerDepth: z.number(),
    drawerHeight: z.number(),
    binCount: z.number(),
    layerCount: z.number(),
    binMap: z.array(z.unknown()).optional(),
  })
  .loose();

const payloadSchema = z.object({
  name: z.string(),
  layoutId: z.string().optional(),
  preview: previewSchema.optional(),
  author: z.string().optional(),
});

const DEFAULT_PREVIEW: LayoutPreview = {
  drawerWidth: gridUnits(6),
  drawerDepth: gridUnits(4),
  drawerHeight: heightUnits(7),
  binCount: 0,
  layerCount: 1,
};

export const createEntry = defineCommand({
  type: 'library.createEntry',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.entryCreated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.libraryCreateEntry',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload, ctx) => {
    const id = payload.layoutId !== undefined ? toLayoutId(payload.layoutId) : generateLayoutId();
    const author = payload.author ?? ctx.aggregate.settings.authorName;
    const now = Date.now();

    // Brand the preview's numeric fields if a custom one was provided.
    // Zod infers them as plain numbers; LayoutPreview requires branded.
    const preview: LayoutPreview = payload.preview
      ? // Brand the dimension fields and let the rest of the preview shape
        // (binCount, layerCount, optional binMap) pass through. The Zod
        // schema uses .loose() so extra/typed fields like binMap survive
        // payload validation; we cast at the LayoutPreview boundary because
        // ThumbnailBin's exact shape isn't validated by Zod here.
        ({
          ...payload.preview,
          drawerWidth: gridUnits(payload.preview.drawerWidth),
          drawerDepth: gridUnits(payload.preview.drawerDepth),
          drawerHeight: heightUnits(payload.preview.drawerHeight),
        } as LayoutPreview)
      : DEFAULT_PREVIEW;

    const entry: LayoutEntry = {
      id,
      name: payload.name,
      createdAt: now,
      modifiedAt: now,
      author,
      preview,
    };

    return ok({
      value: id,
      event: { payload: { layoutId: id, name: entry.name, entry } },
    });
  },
  apply: (event, draft) => {
    // Defensive: entry is always populated by the v2 handler but the event
    // type marks it optional for v1-replay back-compat (see LibraryEntryCreatedEvent).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see comment
    if (event.payload.entry === undefined) return;
    draft.entries.push(event.payload.entry);
  },
});
