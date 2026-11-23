/**
 * IndexedDB storage for the global Baseplate design library.
 *
 * Uses a separate database ('gridfinity-baseplate-v1') to avoid conflicts with
 * layout and bin-designer storage. Stores saved baseplate designs with
 * parameters, thumbnails, and timestamps. Mirrors DesignerStorage.
 */

import { createDbAccessor } from '@/core/storage/backends/openSingleton';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { baseplateDesignId } from '@/core/types';
import { isoStampAfter } from '@/shared/utils/editStamp';
import { paramsEqual } from '../utils/paramsEqual';
import { DEFAULT_BASEPLATE_PARAMS, migrateBaseplateParams } from '@/core/baseplateDefaults';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  storageNotFound,
  storageUnavailable,
  storageCorrupted,
} from '@/core/result';
import type { SavedBaseplateDesign } from '@/features/baseplate/types/library';
import { emit as emitBaseplateEvent } from '@/features/baseplate/sync/baseplateEvents';

const DB_NAME = 'gridfinity-baseplate-v1';
const DB_VERSION = 1;
const DESIGNS_STORE = 'designs';

/** localStorage key for tracking the active baseplate design ID across sessions */
const ACTIVE_DESIGN_KEY = 'gridfinity-baseplate-active-v1';

/** Thumbnail format version — increment when changing thumbnail size/quality/format */
const THUMBNAIL_VERSION = 1;

const baseplateDb = createDbAccessor({
  name: DB_NAME,
  version: DB_VERSION,
  upgrade(db) {
    if (!db.objectStoreNames.contains(DESIGNS_STORE)) {
      const store = db.createObjectStore(DESIGNS_STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    }
  },
});

/**
 * Generate a unique baseplate design ID.
 */
function generateBaseplateDesignId(): BaseplateDesignId {
  return baseplateDesignId(`baseplate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * `updatedAt` for a save: the `modifiedAt` of a copy that sync pulled, or
 * `edited`, the stamp of a local edit. Sync compares the two stamps, so a
 * pulled copy must keep its own.
 */
function storedTime(remoteModifiedAt: number | undefined, edited: string): string {
  if (remoteModifiedAt === undefined) return edited;
  const time = new Date(remoteModifiedAt);
  return Number.isNaN(time.getTime()) ? edited : time.toISOString();
}

/**
 * Save a baseplate design to IndexedDB.
 */
export async function saveDesign(
  design: Omit<SavedBaseplateDesign, 'id' | 'createdAt' | 'updatedAt' | 'thumbnailVersion'> & {
    id?: BaseplateDesignId;
    /** Set only by a sync pull: the remote `modifiedAt` to keep as `updatedAt`. */
    remoteModifiedAt?: number;
  }
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  try {
    const db = await baseplateDb.get();
    const now = new Date().toISOString();

    // Reject incomplete writes up front so a malformed call can't persist a
    // record that later fails loadDesign() or renders blank.
    const paramsToPersist: unknown = design.params;
    if (!paramsToPersist) {
      return err(storageCorrupted(design.id ?? 'new', ['baseplate design missing params']));
    }

    // Only check for existing record when updating (id provided): preserves createdAt.
    let createdAt = now;
    let existing: SavedBaseplateDesign | undefined;
    if (design.id) {
      existing = (await db.get(DESIGNS_STORE, design.id)) as SavedBaseplateDesign | undefined;
      if (existing) {
        createdAt = existing.createdAt;
      }
    }

    const savedDesign: SavedBaseplateDesign = {
      id: design.id ?? generateBaseplateDesignId(),
      name: design.name,
      params: design.params,
      thumbnail: design.thumbnail ?? null,
      // Set thumbnail version when saving a thumbnail
      thumbnailVersion: design.thumbnail ? THUMBNAIL_VERSION : undefined,
      createdAt,
      updatedAt: storedTime(
        design.remoteModifiedAt,
        isoStampAfter(existing?.updatedAt, Date.parse(now))
      ),
    };

    await db.put(DESIGNS_STORE, savedDesign);
    emitBaseplateEvent({ type: 'put', id: savedDesign.id, updatedAt: savedDesign.updatedAt });
    return ok(savedDesign);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Load a baseplate design by ID.
 */
export async function loadDesign(
  id: BaseplateDesignId
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  try {
    const db = await baseplateDb.get();
    const design = (await db.get(DESIGNS_STORE, id)) as SavedBaseplateDesign | undefined;

    if (!design) {
      return err(storageNotFound(`Baseplate design '${id}' not found`));
    }

    const rawParams: unknown = design.params;
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
      const paramsType = String(rawParams) === 'null' ? 'null' : typeof rawParams;
      return err(storageCorrupted(id, [`Invalid params type: ${paramsType}`]));
    }

    // Apply migration for backward compatibility with old designs
    return ok({
      ...design,
      params: migrateBaseplateParams(rawParams),
    });
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * List all saved baseplate designs, sorted by most recently updated.
 */
export async function listDesigns(): Promise<Result<SavedBaseplateDesign[], StorageError>> {
  try {
    const db = await baseplateDb.get();
    const designs = (await db.getAll(DESIGNS_STORE)) as SavedBaseplateDesign[];

    // Filter out corrupted entries (invalid params) to avoid breaking the entire list
    const migratedDesigns = designs
      .filter((design) => {
        const p: unknown = design.params;
        return !!p && typeof p === 'object' && !Array.isArray(p);
      })
      .map((design) => ({ ...design, params: migrateBaseplateParams(design.params) }));

    migratedDesigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return ok(migratedDesigns);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Duplicate a baseplate design with a new ID and "Copy of {name}" as the name.
 */
export async function duplicateDesign(
  id: BaseplateDesignId
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  const original = loadResult.value;

  return saveDesign({
    name: `Copy of ${original.name}`,
    params: { ...original.params },
    thumbnail: original.thumbnail,
  });
}

/**
 * Delete a baseplate design by ID.
 */
export async function deleteDesign(id: BaseplateDesignId): Promise<Result<void, StorageError>> {
  try {
    const db = await baseplateDb.get();
    const exists: unknown = await db.get(DESIGNS_STORE, id);

    if (!exists) {
      return err(storageNotFound(`Baseplate design '${id}' not found`));
    }

    await db.delete(DESIGNS_STORE, id);
    emitBaseplateEvent({ type: 'delete', id, deletedAt: new Date().toISOString() });
    return ok(undefined);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

type SaveDesignInput = Parameters<typeof saveDesign>[0];

const pendingUpdates = new Map<BaseplateDesignId, Promise<unknown>>();

/**
 * Read a design and write a change to it after every update queued before it,
 * so updates to one design land in the order they were made. Reading before an
 * earlier update lands writes that update's older fields back: a thumbnail
 * capture would restore the params an edit had just replaced. A `change` that
 * returns null leaves the design as it is.
 */
function updateInOrder(
  id: BaseplateDesignId,
  change: (current: SavedBaseplateDesign) => SaveDesignInput | null
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  // A rejection would leave the entry queued and surface as unhandled, so a
  // throw comes back as a storage error.
  const run = async (): Promise<Result<SavedBaseplateDesign, StorageError>> => {
    try {
      const loadResult = await loadDesign(id);
      if (isErr(loadResult)) return loadResult;
      const next = change(loadResult.value);
      return next === null ? loadResult : await saveDesign(next);
    } catch (e) {
      return err(storageUnavailable('indexedDB', e));
    }
  };
  const queued = (pendingUpdates.get(id) ?? Promise.resolve()).then(run, run);
  pendingUpdates.set(id, queued);
  void queued.then(() => {
    if (pendingUpdates.get(id) === queued) pendingUpdates.delete(id);
  });
  return queued;
}

/**
 * Update only the name of an existing baseplate design.
 */
export function updateDesignName(
  id: BaseplateDesignId,
  name: string
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  return updateInOrder(id, (current) => ({ ...current, name }));
}

/**
 * Update an existing baseplate design's parameters and/or thumbnail.
 *
 * If `thumbnail` is `undefined` the design's thumbnail is left unchanged;
 * if `null` the thumbnail is cleared.
 */
export function updateDesignParams(
  id: BaseplateDesignId,
  params: StoredBaseplateParams,
  thumbnail?: string | null
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  return updateInOrder(id, (current) => ({
    ...current,
    params,
    ...(thumbnail !== undefined ? { thumbnail } : {}),
  }));
}

/**
 * Write `params` only when the stored design differs, in the same order as
 * every other update, so a write that started earlier never lands over a newer
 * one. `stillWanted` is asked when the write's turn comes: a caller can call
 * the write off while it waits in the queue.
 */
export function updateDesignParamsIfChanged(
  id: BaseplateDesignId,
  params: StoredBaseplateParams,
  stillWanted: () => boolean = () => true
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  return updateInOrder(id, (current) =>
    !stillWanted() || paramsEqual(current.params, params) ? null : { ...current, params }
  );
}

/**
 * Update only the thumbnail for an existing baseplate design.
 */
export function updateDesignThumbnail(
  id: BaseplateDesignId,
  thumbnail: string
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  return updateInOrder(id, (current) => ({
    ...current,
    thumbnail,
  }));
}

/**
 * Create a new baseplate design with default parameters and save it.
 */
export async function createNewDesign(
  name: string = 'Baseplate 1'
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  return saveDesign({
    name,
    params: { ...DEFAULT_BASEPLATE_PARAMS },
    thumbnail: null,
  });
}

/**
 * Get the active baseplate design ID from localStorage.
 * Returns null if no active design is set.
 */
export function getActiveDesignId(): BaseplateDesignId | null {
  try {
    const raw = localStorage.getItem(ACTIVE_DESIGN_KEY);
    return raw !== null ? baseplateDesignId(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save the active baseplate design ID to localStorage.
 * Pass null to clear the active design.
 */
export function setActiveDesignId(id: BaseplateDesignId | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_DESIGN_KEY);
    } else {
      localStorage.setItem(ACTIVE_DESIGN_KEY, id);
    }
  } catch {
    // Storage unavailable - silently fail
  }
}

/**
 * Close the database connection (for testing/cleanup).
 */
export function closeBaseplateDb(): void {
  baseplateDb.close();
}
