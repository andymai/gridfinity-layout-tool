/**
 * The cutout library's synced shapes: items (cutouts saved apart from any bin)
 * and the folders they sit in. An item's cutouts pass the same validators as a
 * design's, since they land in a design as soon as they are placed.
 */

import { ErrorCode } from './shared.js';
import { sanitizeString } from './sanitize.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import {
  isMeshRef,
  meshRefHashes,
  validateCutoutGroupNames,
  validateCutouts,
  validateMeshAssets,
} from './designerCutoutValidation.js';

/** Mirrors `MAX_LIBRARY_NAME_LENGTH` in src/features/bin-designer/library/libraryTypes.ts. */
export const LIBRARY_NAME_MAX_LENGTH = 80;
/** Mirrors `LIBRARY_ITEM_ID_PREFIX` and `generateUUID` on the client. */
export const LIBRARY_ITEM_ID_PATTERN = /^clib_[0-9a-f-]{36}$/;
/** Mirrors `LIBRARY_FOLDER_ID_PREFIX` and `generateUUID` on the client. */
export const LIBRARY_FOLDER_ID_PATTERN = /^cfold_[0-9a-f-]{36}$/;

/**
 * Off unless set to `true`. While off both kinds answer 503 and the manifest
 * leaves them out, which tells the client not to push them.
 */
export function cutoutLibrarySyncEnabled(): boolean {
  return process.env.CUTOUT_LIBRARY_SYNC_ENABLED === 'true';
}

export interface StoredLibraryItem {
  name: string;
  folderId: string | null;
  createdAt: string;
  content: {
    params: {
      cutouts: unknown[];
      cutoutGroupNames?: Record<string, unknown>;
      meshAssets?: Record<string, unknown>;
    };
  };
}

export interface StoredLibraryFolder {
  name: string;
  parentId: string | null;
  createdAt: string;
}

type Validated<T> =
  | { ok: true; stored: T; sizeBytes: number; meshHashes: string[] }
  | { ok: false; status: 400; error: string; code: string; reason?: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const invalid = (error: string, reason?: string) =>
  ({
    ok: false,
    status: 400,
    error,
    code: ErrorCode.VALIDATION_ERROR,
    ...(reason ? { reason } : {}),
  }) as const;

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function cleanName(value: unknown): string {
  return sanitizeString(typeof value === 'string' ? value : '', LIBRARY_NAME_MAX_LENGTH);
}

export function validateLibraryItem(payload: unknown): Validated<StoredLibraryItem> {
  if (!isObject(payload)) return invalid('cutoutItem must be an object');
  const name = cleanName(payload.name);
  if (name === '') return invalid('cutoutItem.name is required');
  const folderId = payload.folderId ?? null;
  if (
    folderId !== null &&
    (typeof folderId !== 'string' || !LIBRARY_FOLDER_ID_PATTERN.test(folderId))
  ) {
    return invalid('cutoutItem.folderId must be a library folder id or null');
  }
  const createdAt = isoTimestamp(payload.createdAt);
  if (!createdAt) return invalid('cutoutItem.createdAt must be an ISO timestamp');

  const content = payload.content;
  if (!isObject(content) || !isObject(content.params)) {
    return invalid('cutoutItem.content.params must be an object');
  }
  const { cutouts, cutoutGroupNames, meshAssets } = content.params;
  if (!Array.isArray(cutouts) || cutouts.length === 0) {
    return invalid('cutoutItem.content.params.cutouts must be a non-empty array');
  }
  const cutoutsErr = validateCutouts(cutouts);
  if (cutoutsErr) return invalid(cutoutsErr, 'INVALID_PARAMS');
  const namesErr = validateCutoutGroupNames(cutoutGroupNames);
  if (namesErr) return invalid(namesErr, 'INVALID_PARAMS');
  const meshErr = validateMeshAssets(meshAssets, cutouts, true);
  if (meshErr) return invalid(meshErr, 'INVALID_PARAMS');

  const stored: StoredLibraryItem = {
    name,
    folderId,
    createdAt,
    content: {
      params: {
        cutouts,
        ...(isObject(cutoutGroupNames) ? { cutoutGroupNames } : {}),
        ...(isObject(meshAssets) ? { meshAssets } : {}),
      },
    },
  };
  const sizeBytes = Buffer.byteLength(JSON.stringify(stored), 'utf8');
  // Only an inline mesh earns the larger budget, as with a design share.
  const inline =
    isObject(meshAssets) &&
    Object.values(meshAssets).some((asset) => isObject(asset) && !isMeshRef(asset));
  const cap = inline ? CONSTRAINTS.MESH_MAX_PAYLOAD_BYTES : CONSTRAINTS.MAX_PAYLOAD_BYTES;
  if (sizeBytes > cap)
    return invalid(`cutoutItem is too large (max ${cap} bytes)`, 'SIZE_EXCEEDED');

  return { ok: true, stored, sizeBytes, meshHashes: meshRefHashes(meshAssets) };
}

/**
 * A folder carries its name and its place in the tree. A parent missing on
 * the reading device reads as the top level there, so the parent is not looked up.
 */
export function validateLibraryFolder(
  payload: unknown,
  id: string
): Validated<StoredLibraryFolder> {
  if (!isObject(payload)) return invalid('cutoutFolder must be an object');
  const name = cleanName(payload.name);
  if (name === '') return invalid('cutoutFolder.name is required');
  const parentId = payload.parentId ?? null;
  if (
    parentId !== null &&
    (typeof parentId !== 'string' || !LIBRARY_FOLDER_ID_PATTERN.test(parentId))
  ) {
    return invalid('cutoutFolder.parentId must be a library folder id or null');
  }
  if (parentId === id) return invalid('cutoutFolder.parentId cannot be the folder itself');
  const createdAt = isoTimestamp(payload.createdAt);
  if (!createdAt) return invalid('cutoutFolder.createdAt must be an ISO timestamp');
  const stored: StoredLibraryFolder = { name, parentId, createdAt };
  return {
    ok: true,
    stored,
    sizeBytes: Buffer.byteLength(JSON.stringify(stored), 'utf8'),
    meshHashes: [],
  };
}
