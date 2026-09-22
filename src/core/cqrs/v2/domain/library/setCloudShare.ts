/**
 * Set cloudShare metadata on a library entry. The
 * `cqrs/subscribers/libraryPersistence` subscriber listens for
 * `library.cloudShareUpdated` and persists the library snapshot
 * immediately (cloudShare isn't covered by the debounced useAutoSave).
 * No-ops silently when the layout id isn't in entries.
 */

import { ok } from '@/core/result';
import { layoutId as toLayoutId } from '@/core/types';
import type { CloudShareInfo } from '@/core/types';
import { defineCommand } from '../../defineCommand';
import { librarySetCloudShareSchema } from '../../../validation/librarySchemas';

export const setCloudShare = defineCommand({
  type: 'library.setCloudShare',
  aggregate: 'library',
  aggregateId: () => 'library',
  payload: librarySetCloudShareSchema,
  emitted: 'library.cloudShareUpdated',
  schemaVersion: 1,
  middleware: { undoCapture: false, validate: true, analytics: true },
  handle: (payload) => {
    const layoutId = toLayoutId(payload.layoutId);
    const shareInfo: CloudShareInfo = payload.shareInfo;
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
