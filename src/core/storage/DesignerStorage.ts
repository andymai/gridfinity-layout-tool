/**
 * IndexedDB storage for the Bin Designer feature.
 *
 * Uses a separate database ('gridfinity-designer-v1') to avoid
 * conflicts with the layout storage. Stores saved designs with
 * parameters, thumbnails, and timestamps.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Result, StorageError } from '@/core/result';
import { ok, err, isErr, storageNotFound, storageCorrupted, storageUnavailable } from '@/core/result';
import type { SavedDesign, BinParams } from '@/features/bin-designer/types';

const DB_NAME = 'gridfinity-designer-v1';
const DB_VERSION = 1;
const DESIGNS_STORE = 'designs';

let dbInstance: IDBPDatabase | null = null;

/**
 * Open the designer database, creating stores if needed.
 */
async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DESIGNS_STORE)) {
        const store = db.createObjectStore(DESIGNS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    },
  });

  return dbInstance;
}

/**
 * Generate a unique design ID.
 */
function generateDesignId(): string {
  return `design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Save a design to IndexedDB.
 */
export async function saveDesign(
  design: Omit<SavedDesign, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Result<SavedDesign, StorageError>> {
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // Only check for existing createdAt when updating (id provided)
    let createdAt = now;
    if (design.id) {
      const existing = (await db.get(DESIGNS_STORE, design.id)) as SavedDesign | undefined;
      if (existing) {
        createdAt = existing.createdAt;
      }
    }

    const savedDesign: SavedDesign = {
      id: design.id ?? generateDesignId(),
      name: design.name,
      params: design.params,
      thumbnail: design.thumbnail ?? null,
      createdAt,
      updatedAt: now,
    };

    await db.put(DESIGNS_STORE, savedDesign);
    return ok(savedDesign);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Load a design by ID.
 */
export async function loadDesign(id: string): Promise<Result<SavedDesign, StorageError>> {
  try {
    const db = await getDb();
    const design = (await db.get(DESIGNS_STORE, id)) as SavedDesign | undefined;

    if (!design) {
      return err(storageNotFound(`Design '${id}' not found`));
    }

    if (!design.params || typeof design.params !== 'object') {
      return err(storageCorrupted(`Design '${id}' has invalid data`));
    }

    return ok(design);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * List all saved designs, sorted by most recently updated.
 */
export async function listDesigns(): Promise<Result<SavedDesign[], StorageError>> {
  try {
    const db = await getDb();
    const designs = (await db.getAll(DESIGNS_STORE)) as SavedDesign[];

    // Sort by updatedAt descending
    designs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return ok(designs);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Delete a design by ID.
 */
export async function deleteDesign(id: string): Promise<Result<void, StorageError>> {
  try {
    const db = await getDb();
    const exists = await db.get(DESIGNS_STORE, id);

    if (!exists) {
      return err(storageNotFound(`Design '${id}' not found`));
    }

    await db.delete(DESIGNS_STORE, id);
    return ok(undefined);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Close the database connection (for testing/cleanup).
 */
export function closeDesignerDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Update an existing design's bin parameters and optionally its thumbnail.
 *
 * If `thumbnail` is `undefined` the design's thumbnail is left unchanged; if `null` the thumbnail is cleared.
 *
 * @param thumbnail - The new thumbnail data, `null` to remove it, or `undefined` to keep the current thumbnail
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignParams(
  id: string,
  params: BinParams,
  thumbnail?: string | null
): Promise<Result<SavedDesign, StorageError>> {
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