/**
 * IndexedDB storage for the global Baseplate design library.
 *
 * Uses a separate database ('gridfinity-baseplate-v1') to avoid conflicts with
 * layout and bin-designer storage. Stores saved baseplate designs with
 * parameters, thumbnails, and timestamps. Mirrors DesignerStorage.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { baseplateDesignId } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS, migrateBaseplateParams } from '@/core/constants';
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

let dbInstance: IDBPDatabase | null = null;

/**
 * Open the baseplate library database, creating stores if needed.
 */
async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DESIGNS_STORE)) {
        const store = db.createObjectStore(DESIGNS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    },
  });

  // Clear cached instance if the browser closes the connection unexpectedly
  db.addEventListener('close', () => {
    if (dbInstance === db) {
      dbInstance = null;
    }
  });

  dbInstance = db;
  return dbInstance;
}

/**
 * Generate a unique baseplate design ID.
 */
function generateBaseplateDesignId(): BaseplateDesignId {
  return baseplateDesignId(`baseplate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * Save a baseplate design to IndexedDB.
 */
export async function saveDesign(
  design: Omit<SavedBaseplateDesign, 'id' | 'createdAt' | 'updatedAt' | 'thumbnailVersion'> & {
    id?: BaseplateDesignId;
  }
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // Reject incomplete writes up front so a malformed call can't persist a
    // record that later fails loadDesign() or renders blank.
    const paramsToPersist: unknown = design.params;
    if (!paramsToPersist) {
      return err(storageCorrupted(design.id ?? 'new', ['baseplate design missing params']));
    }

    // Only check for existing record when updating (id provided): preserves createdAt.
    let createdAt = now;
    if (design.id) {
      const existing = (await db.get(DESIGNS_STORE, design.id)) as SavedBaseplateDesign | undefined;
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
      updatedAt: now,
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
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
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

/**
 * Update only the name of an existing baseplate design.
 */
export async function updateDesignName(
  id: BaseplateDesignId,
  name: string
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    name,
  });
}

/**
 * Update an existing baseplate design's parameters and/or thumbnail.
 *
 * If `thumbnail` is `undefined` the design's thumbnail is left unchanged;
 * if `null` the thumbnail is cleared.
 */
export async function updateDesignParams(
  id: BaseplateDesignId,
  params: StoredBaseplateParams,
  thumbnail?: string | null
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    params,
    ...(thumbnail !== undefined ? { thumbnail } : {}),
  });
}

/**
 * Update only the thumbnail for an existing baseplate design.
 */
export async function updateDesignThumbnail(
  id: BaseplateDesignId,
  thumbnail: string
): Promise<Result<SavedBaseplateDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    thumbnail,
  });
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
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
