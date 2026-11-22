import {
  LIBRARY_FOLDER_ID_PATTERN,
  cutoutLibrarySyncEnabled,
  validateLibraryFolder,
  type StoredLibraryFolder,
} from '../../lib/cutoutLibraryValidation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.cutoutFolders` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'cutoutFolder' as const;

interface CutoutFolderEnvelope {
  cutoutFolder: StoredLibraryFolder;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/cutoutFolders/{id}
 * PUT    /api/sync/cutoutFolders/{id}  — body { cutoutFolder: { name, parentId, createdAt }, modifiedAt }
 * DELETE /api/sync/cutoutFolders/{id}
 *
 * A folder in the cutout library, apart from the layout library's folders.
 * Which items sit in it travels on each item. Off, with a 503, unless
 * CUTOUT_LIBRARY_SYNC_ENABLED is `true`.
 */
export default createSyncResourceHandler<CutoutFolderEnvelope>({
  kind: 'cutoutFolders',
  payloadKey: PAYLOAD_KEY,
  isValidId: (id) => LIBRARY_FOLDER_ID_PATTERN.test(id),
  invalidIdError: 'Invalid cutout library folder id',
  deletedError: 'This library folder was deleted on another device',
  enabled: cutoutLibrarySyncEnabled,
  buildPut: (payload, modifiedAt, id) => {
    const folder = validateLibraryFolder(payload, id);
    if (!folder.ok) return folder;
    return {
      ok: true,
      envelope: { cutoutFolder: folder.stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes: folder.sizeBytes,
      tiebreakerCandidate: folder.stored,
    };
  },
  storedComparable: (stored) => stored.cutoutFolder,
});
