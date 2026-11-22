import {
  LIBRARY_ITEM_ID_PATTERN,
  cutoutLibrarySyncEnabled,
  validateLibraryItem,
  type StoredLibraryItem,
} from '../../lib/cutoutLibraryValidation.js';
import { createSyncResourceHandler, type SyncResourceConfig } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.cutoutItems` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'cutoutItem' as const;

interface CutoutItemEnvelope {
  cutoutItem: StoredLibraryItem;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/cutoutItems/{id}
 * PUT    /api/sync/cutoutItems/{id}  — body { cutoutItem: { name, folderId, createdAt, content: { params } }, modifiedAt }
 * DELETE /api/sync/cutoutItems/{id}
 *
 * One cutout library item. Its meshes travel as refs to the account's mesh
 * files, like a design's. Off, with a 503, unless CUTOUT_LIBRARY_SYNC_ENABLED is `true`.
 */
export const resource: SyncResourceConfig<CutoutItemEnvelope> = {
  kind: 'cutoutItems',
  payloadKey: PAYLOAD_KEY,
  isValidId: (id) => LIBRARY_ITEM_ID_PATTERN.test(id),
  invalidIdError: 'Invalid cutout library item id',
  deletedError: 'This library item was deleted on another device',
  enabled: cutoutLibrarySyncEnabled,
  buildPut: (payload, modifiedAt) => {
    const item = validateLibraryItem(payload);
    if (!item.ok) return item;
    return {
      ok: true,
      envelope: { cutoutItem: item.stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes: item.sizeBytes,
      tiebreakerCandidate: item.stored,
      meshHashes: item.meshHashes,
    };
  },
  storedComparable: (stored) => stored.cutoutItem,
};

export default createSyncResourceHandler(resource);
