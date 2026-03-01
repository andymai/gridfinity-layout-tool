/**
 * IndexedDB storage for the Bin Designer feature.
 *
 * Uses a separate database ('gridfinity-designer-v1') to avoid
 * conflicts with the layout storage. Stores saved designs with
 * parameters, thumbnails, and timestamps.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { DesignId } from '@/core/types';
import { designId } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  storageNotFound,
  storageUnavailable,
  storageCorrupted,
} from '@/core/result';
import type { SavedDesign, BinParams, ExportFileNameConfig } from '@/features/bin-designer/types';
import { THUMBNAIL_VERSION } from '@/features/bin-designer/types';
import { DEFAULT_BIN_PARAMS, migrateParams } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '@/features/bin-designer/utils/fileNaming';

const DB_NAME = 'gridfinity-designer-v1';
const DB_VERSION = 1;
const DESIGNS_STORE = 'designs';

/** localStorage key for tracking the active design ID across sessions */
const ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

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
function generateDesignId(): DesignId {
  return designId(`design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * Save a design to IndexedDB.
 */
export async function saveDesign(
  design: Omit<SavedDesign, 'id' | 'createdAt' | 'updatedAt'> & { id?: DesignId }
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
      // Set thumbnail version when saving a thumbnail
      thumbnailVersion: design.thumbnail ? THUMBNAIL_VERSION : undefined,
      exportFileNameConfig: design.exportFileNameConfig ?? null,
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
export async function loadDesign(id: DesignId): Promise<Result<SavedDesign, StorageError>> {
  try {
    const db = await getDb();
    const design = (await db.get(DESIGNS_STORE, id)) as SavedDesign | undefined;

    if (!design) {
      return err(storageNotFound(`Design '${id}' not found`));
    }

    // Validate that params is a valid object before migration
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- params can be corrupted in IndexedDB
    if (!design.params || typeof design.params !== 'object' || Array.isArray(design.params)) {
      const paramsType = String(design.params) === 'null' ? 'null' : typeof design.params;
      return err(storageCorrupted(id, [`Invalid params type: ${paramsType}`]));
    }

    // Apply migration for backward compatibility with old designs
    const migratedParams = migrateParams(design.params as Partial<BinParams>);

    return ok({
      ...design,
      params: migratedParams,
    });
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

    // Apply migration for backward compatibility with old designs
    // Filter out corrupted entries (invalid params) to avoid breaking the entire list
    const migratedDesigns = designs
      .filter((design) => {
        // Skip entries with invalid params (null, undefined, or primitives)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime data from IndexedDB
        return design.params && typeof design.params === 'object' && !Array.isArray(design.params);
      })
      .map((design) => ({
        ...design,
        params: migrateParams(design.params as Partial<BinParams>),
      }));

    // Sort by updatedAt descending
    migratedDesigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return ok(migratedDesigns);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Duplicate a design with a new ID.
 * Creates a copy with "Copy of {name}" as the name.
 *
 * @param id - The ID of the design to duplicate
 * @returns The duplicated design with a new ID
 */
export async function duplicateDesign(id: DesignId): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  const original = loadResult.value;
  const newName = `Copy of ${original.name}`;

  return saveDesign({
    name: newName,
    params: { ...original.params },
    thumbnail: original.thumbnail,
    exportFileNameConfig: original.exportFileNameConfig
      ? { ...original.exportFileNameConfig }
      : null,
  });
}

/**
 * Delete a design by ID.
 */
export async function deleteDesign(id: DesignId): Promise<Result<void, StorageError>> {
  try {
    const db = await getDb();
    const exists: unknown = await db.get(DESIGNS_STORE, id);

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
 * Update only the name of an existing design.
 *
 * @param id - The design ID
 * @param name - The new design name
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignName(
  id: DesignId,
  name: string
): Promise<Result<SavedDesign, StorageError>> {
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
 * Update an existing design's bin parameters, thumbnail, and/or export config.
 *
 * If `thumbnail` is `undefined` the design's thumbnail is left unchanged; if `null` the thumbnail is cleared.
 * If `exportFileNameConfig` is `undefined` it is left unchanged.
 *
 * @param thumbnail - The new thumbnail data, `null` to remove it, or `undefined` to keep the current thumbnail
 * @param exportFileNameConfig - The new export config, or `undefined` to keep the current config
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignParams(
  id: DesignId,
  params: BinParams,
  thumbnail?: string | null,
  exportFileNameConfig?: ExportFileNameConfig
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    params,
    ...(thumbnail !== undefined ? { thumbnail } : {}),
    ...(exportFileNameConfig !== undefined ? { exportFileNameConfig } : {}),
  });
}

/**
 * Update only the thumbnail for an existing design.
 *
 * Used when a design is created before the mesh is ready (e.g., from layout
 * planner "Create Design" flow) and we need to update the thumbnail after
 * the first successful mesh generation.
 *
 * @param id - The design ID
 * @param thumbnail - The new thumbnail data URL
 * @returns A `Result` with the updated `SavedDesign` on success
 */
export async function updateDesignThumbnail(
  id: DesignId,
  thumbnail: string
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    thumbnail,
  });
}

// === Active Design Tracking ===

/**
 * Get the active design ID from localStorage.
 * Returns null if no active design is set.
 */
export function getActiveDesignId(): DesignId | null {
  try {
    const raw = localStorage.getItem(ACTIVE_DESIGN_KEY);
    return raw !== null ? designId(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save the active design ID to localStorage.
 * Pass null to clear the active design.
 */
export function setActiveDesignId(id: DesignId | null): void {
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
 * Create a new design with default parameters and save it to IndexedDB.
 * Returns the saved design.
 */
export async function createNewDesign(
  name: string = 'Untitled Bin'
): Promise<Result<SavedDesign, StorageError>> {
  return saveDesign({
    name,
    params: { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
  });
}

/**
 * Initialize the designer storage system.
 *
 * Similar to how the grid editor's initializeLayoutLibrary() works:
 * - If there's an active design ID saved, try to load it
 * - If loading fails or no active design, create a new one
 * - Always returns a valid SavedDesign
 *
 * @returns The active design (loaded or newly created)
 */
export async function initializeDesigner(): Promise<Result<SavedDesign, StorageError>> {
  // Try to load the previously active design
  const activeId = getActiveDesignId();
  if (activeId) {
    const loadResult = await loadDesign(activeId);
    if (!isErr(loadResult)) {
      return loadResult;
    }
    // Active design not found - clear the stale reference
    setActiveDesignId(null);
  }

  // No active design or failed to load - create a new one
  const createResult = await createNewDesign();
  if (!isErr(createResult)) {
    setActiveDesignId(createResult.value.id);
  }
  return createResult;
}
