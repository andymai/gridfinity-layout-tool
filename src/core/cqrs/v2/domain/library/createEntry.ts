/**
 * Create a new library entry. Author always comes from
 * `library.settings.authorName` — the central CQRS schema doesn't accept
 * an `author` payload field, so it can't be passed through the bus.
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { gridUnits, heightUnits, layoutId as toLayoutId } from '@/core/types';
import type { LayoutEntry, LayoutPreview } from '@/core/types';
import { defineCommand } from '../../defineCommand';

// Mirrors the central library.createEntry schema in
// `@/core/cqrs/validation/librarySchemas` — `preview` is structurally
// re-validated inside handle() since the central schema treats it as opaque.
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
    const author = ctx.aggregate.settings.authorName;
    const now = Date.now();

    // Truncate even though the central schema enforces a max — keeps
    // the event's value identical to what apply() installs when
    // validation is bypassed in tests/tools.
    const name = payload.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);

    // Preview is z.unknown() in both v2 and central schemas; structurally
    // re-check here so a malformed shape falls back to defaults instead
    // of crashing on undefined .drawerWidth.
    const preview: LayoutPreview = isStructuredPreview(payload.preview)
      ? {
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
    // Persisted events that predate the `entry` field carry only
    // {layoutId, name}; reconstruct a best-effort entry from defaults
    // so replay produces *something* rather than silently dropping the event.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- entry is optional for back-compat with persisted events
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
