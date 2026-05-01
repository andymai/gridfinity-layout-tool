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
import { CONSTRAINTS } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { gridUnits, heightUnits, layoutId as toLayoutId } from '@/core/types';
import type { LayoutEntry, LayoutPreview } from '@/core/types';
import { defineCommand } from '../../defineCommand';

// Match the central library.createEntry schema (validation/librarySchemas.ts):
// name has min/max bounds; preview is opaque (validated structurally inside
// handle below); `author` is NOT a payload field — author always falls back
// to library.settings.authorName per v1's CQRS handler behavior.
const payloadSchema = z.object({
  name: z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH),
  layoutId: z.string().optional(),
  preview: z.unknown().optional(),
});

/** Structural shape `handle()` expects when payload.preview is provided. */
function isStructuredPreview(value: unknown): value is {
  drawerWidth: number;
  drawerDepth: number;
  drawerHeight: number;
  binCount: number;
  layerCount: number;
  [k: string]: unknown;
} {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.drawerWidth === 'number' &&
    typeof v.drawerDepth === 'number' &&
    typeof v.drawerHeight === 'number' &&
    typeof v.binCount === 'number' &&
    typeof v.layerCount === 'number'
  );
}

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
    // Match v1's author resolution: always settings.authorName (v1's CQRS
    // handler doesn't pass an author arg through; the store action's
    // optional author parameter is unreachable via the bus).
    const author = ctx.aggregate.settings.authorName;
    const now = Date.now();

    // Truncate inside handle even though the central schema enforces a
    // max — keeps the event payload's value identical to what apply()
    // installs, even if validation is bypassed in tests/tools.
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);

    // payload.preview is z.unknown() in both v2 and central schemas;
    // structurally validate inside handle so a malformed shape falls
    // back to defaults instead of crashing on undefined .drawerWidth.
    const preview: LayoutPreview = isStructuredPreview(payload.preview)
      ? // Brand the dimension fields. Optional shape extras (binMap, etc.)
        // pass through via the `[k: string]: unknown` index from
        // isStructuredPreview's predicate.
        {
          ...payload.preview,
          drawerWidth: gridUnits(payload.preview.drawerWidth),
          drawerDepth: gridUnits(payload.preview.drawerDepth),
          drawerHeight: heightUnits(payload.preview.drawerHeight),
        }
      : DEFAULT_PREVIEW;

    const entry: LayoutEntry = {
      id,
      name,
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
    // v2 handler always populates `entry`. v1-era persisted events have
    // only {layoutId, name} — reconstruct a best-effort entry from
    // defaults so replay produces *something* instead of silently
    // dropping the event.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- entry is optional on the event type for v1 back-compat
    const fallback: LayoutEntry = event.payload.entry ?? {
      id: event.payload.layoutId,
      name: event.payload.name,
      createdAt: 0,
      modifiedAt: 0,
      preview: DEFAULT_PREVIEW,
    };
    draft.entries.push(fallback);
  },
});
