/**
 * library.setCloudShare — v2 (defineCommand) shape, library aggregate.
 *
 * Sets cloudShare metadata on the matching entry. The libraryPersistence
 * subscriber (`cqrs/subscribers/libraryPersistence.ts`, wired in PR 1)
 * listens for the emitted `library.cloudShareUpdated` event and persists
 * the library snapshot — so the v2 path's behavior matches v1 end-to-end.
 *
 * No-ops silently when the layout id isn't in entries (same as v1).
 */

import { z } from 'zod';
import { ok } from '@/core/result';
import { layoutId as toLayoutId } from '@/core/types';
import type { CloudShareInfo } from '@/core/types';
import { defineCommand } from '../../defineCommand';

const payloadSchema = z.object({
  layoutId: z.string().min(1),
  shareInfo: z.object({ id: z.string(), url: z.string() }).loose(),
});

export const setCloudShare = defineCommand({
  type: 'library.setCloudShare',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: payloadSchema,
  emitted: 'library.cloudShareUpdated',
  schemaVersion: 1,
  descriptionKey: 'undo.action.librarySetCloudShare',
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload) => {
    const layoutId = toLayoutId(payload.layoutId);
    // Central schema enforces {id, url} + .loose() — full CloudShareInfo
    // shape (deleteToken, sharedAt, permission) is supplied by callers
    // and trusted here. Cast through unknown because the validator only
    // guarantees the two required fields.
    const shareInfo = payload.shareInfo as unknown as CloudShareInfo;
    return ok({
      value: undefined,
      event: { payload: { layoutId, shareInfo } },
    });
  },
  apply: (event, draft) => {
    const entry = draft.entries.find((e) => e.id === event.payload.layoutId);
    if (entry) entry.cloudShare = event.payload.shareInfo;
  },
});
