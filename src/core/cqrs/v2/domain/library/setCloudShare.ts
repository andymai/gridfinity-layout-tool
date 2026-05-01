/**
 * Set cloudShare metadata on a library entry. The
 * `cqrs/subscribers/libraryPersistence` subscriber listens for
 * `library.cloudShareUpdated` and persists the library snapshot
 * immediately (cloudShare isn't covered by the debounced useAutoSave).
 * No-ops silently when the layout id isn't in entries.
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
