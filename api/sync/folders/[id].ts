import { ErrorCode } from '../../lib/shared.js';
import { sanitizeString } from '../../lib/validation.js';
import { createSyncResourceHandler } from '../lib/resourceHandler.js';

export const SCHEMA_VERSION = 1 as const;

/** The PUT body / GET envelope key for this resource; mirrors `PAYLOAD_KEY.folders` in src/core/sync/payloadKey.ts. */
export const PAYLOAD_KEY = 'folder' as const;

/** Mirrors `CONSTRAINTS.FOLDER_NAME_MAX_LENGTH` on the client. */
const FOLDER_NAME_MAX_LENGTH = 32;
const FOLDER_ID_PATTERN = /^folder_\d+_[a-z0-9]{1,8}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface StoredFolder {
  name: string;
  parentId: string | null;
  color?: string;
  createdAt: number;
}

interface FolderEnvelope {
  folder: StoredFolder;
  modifiedAt: number;
  schemaVersion: typeof SCHEMA_VERSION;
}

/**
 * GET    /api/sync/folders/{id}
 * PUT    /api/sync/folders/{id}  — body { folder: { name, parentId, color?, createdAt }, modifiedAt }
 * DELETE /api/sync/folders/{id}
 *
 * A folder in the layout library. Which layouts sit in it travels on each
 * layout's own envelope (`folderId`), so a folder carries only its name and
 * its place in the tree; a parent that does not exist on the reading device
 * reads as the root there, which is why the parent is not checked here.
 */
export default createSyncResourceHandler<FolderEnvelope>({
  kind: 'folders',
  payloadKey: PAYLOAD_KEY,
  isValidId: (id) => FOLDER_ID_PATTERN.test(id),
  invalidIdError: 'Invalid folder id',
  deletedError: 'This folder was deleted on another device',
  buildPut: (payload, modifiedAt, id) => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return {
        ok: false,
        status: 400,
        error: 'folder must be an object',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const body = payload as Record<string, unknown>;
    const name = sanitizeString(
      typeof body.name === 'string' ? body.name : '',
      FOLDER_NAME_MAX_LENGTH
    );
    if (name === '') {
      return {
        ok: false,
        status: 400,
        error: 'folder.name is required',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const rawParent = body.parentId ?? null;
    if (
      rawParent !== null &&
      (typeof rawParent !== 'string' || !FOLDER_ID_PATTERN.test(rawParent))
    ) {
      return {
        ok: false,
        status: 400,
        error: 'folder.parentId must be a folder id or null',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    if (rawParent === id) {
      return {
        ok: false,
        status: 400,
        error: 'folder.parentId cannot be the folder itself',
        code: ErrorCode.VALIDATION_ERROR,
      };
    }
    const parentId = rawParent;
    const color =
      typeof body.color === 'string' && COLOR_PATTERN.test(body.color) ? body.color : undefined;
    const createdAt =
      typeof body.createdAt === 'number' && Number.isFinite(body.createdAt) && body.createdAt > 0
        ? Math.floor(body.createdAt)
        : modifiedAt;
    const stored: StoredFolder = { name, parentId, ...(color ? { color } : {}), createdAt };
    return {
      ok: true,
      envelope: { folder: stored, modifiedAt, schemaVersion: SCHEMA_VERSION },
      sizeBytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
      tiebreakerCandidate: stored,
    };
  },
  storedComparable: (stored) => stored.folder,
});
