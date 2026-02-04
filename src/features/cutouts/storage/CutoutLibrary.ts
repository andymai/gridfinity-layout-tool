/**
 * CutoutLibrary storage for persisting cutout templates to IndexedDB.
 *
 * Uses the `idb` library for a promise-based API.
 *
 * Storage structure:
 * - Database: 'gridfinity-cutouts-db'
 * - Object stores:
 *   - 'cutouts': Cutout templates (key: template id)
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { CutoutTemplate, TracedContour, StorageError } from '../types';
import { storageError, MAX_CUTOUT_TEMPLATES, MAX_CONTOUR_POINTS } from '../types';

const DB_NAME = 'gridfinity-cutouts-db';
const DB_VERSION = 1;

// Store names
const CUTOUTS_STORE = 'cutouts';

// Database instance cache
let dbInstance: IDBPDatabase | null = null;

// Promise-based mutex to prevent race conditions during clear operations
let clearInProgress: Promise<void> | null = null;

/**
 * Generate a unique ID for a new template.
 */
function generateId(): string {
  return `cutout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Open and return the cutout database.
 * Creates the database and object stores if they don't exist.
 * Waits for any pending clear operation to complete first.
 */
async function openCutoutDatabase(): Promise<IDBPDatabase> {
  // Wait for any pending clear operation to complete
  if (clearInProgress) {
    await clearInProgress;
  }

  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create cutouts store if it doesn't exist
      if (!db.objectStoreNames.contains(CUTOUTS_STORE)) {
        const store = db.createObjectStore(CUTOUTS_STORE, { keyPath: 'id' });
        // Index for sorting by creation date
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });

  return dbInstance;
}

/**
 * Get a fresh database connection.
 */
async function getDb(): Promise<IDBPDatabase> {
  return openCutoutDatabase();
}

/**
 * Validate a contour before saving.
 */
function validateContour(contour: TracedContour): Result<void, StorageError> {
  if (contour.points.length > MAX_CONTOUR_POINTS) {
    return err(
      storageError.validationError(
        `The traced shape is too complex (${contour.points.length} points). ` +
          `Try using a simpler image or adjusting the threshold settings. Maximum: ${MAX_CONTOUR_POINTS} points.`
      )
    );
  }
  return ok(undefined);
}

/**
 * Input type for creating a new cutout template (without generated fields).
 */
export type CutoutTemplateInput = Omit<CutoutTemplate, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Save a new cutout template to the library.
 *
 * @param template Template data (id and timestamps are generated)
 * @returns Result with the new template ID or error
 */
export async function saveCutoutTemplate(
  template: CutoutTemplateInput
): Promise<Result<string, StorageError>> {
  try {
    // Validate contour
    const validation = validateContour(template.contour);
    if (!validation.ok) {
      return validation;
    }

    const db = await getDb();

    // Check library capacity
    const count = await db.count(CUTOUTS_STORE);
    if (count >= MAX_CUTOUT_TEMPLATES) {
      return err(storageError.storageFull(MAX_CUTOUT_TEMPLATES));
    }

    // Create full template with generated fields
    const now = new Date().toISOString();
    const id = generateId();
    const fullTemplate: CutoutTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await db.put(CUTOUTS_STORE, fullTemplate);

    return ok(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    return err(storageError.storageFailed(message));
  }
}

/**
 * Load all cutout templates from the library.
 * Returns templates sorted by createdAt descending (newest first).
 */
export async function loadCutoutTemplates(): Promise<CutoutTemplate[]> {
  const db = await getDb();
  const templates = (await db.getAll(CUTOUTS_STORE)) as CutoutTemplate[];

  // Sort by createdAt descending (newest first)
  return templates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Load a single cutout template by ID.
 *
 * @param id Template ID
 * @returns Template or null if not found
 */
export async function loadCutoutTemplate(id: string): Promise<CutoutTemplate | null> {
  const db = await getDb();
  const template = (await db.get(CUTOUTS_STORE, id)) as CutoutTemplate | undefined;
  return template ?? null;
}

/**
 * Delete a cutout template from the library.
 *
 * @param id Template ID to delete
 */
export async function deleteCutoutTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(CUTOUTS_STORE, id);
}

/**
 * Partial update type for updating templates.
 */
export type CutoutTemplateUpdate = Partial<Omit<CutoutTemplate, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Update an existing cutout template.
 *
 * @param id Template ID to update
 * @param updates Partial template data to merge
 * @returns Result indicating success or error
 */
export async function updateCutoutTemplate(
  id: string,
  updates: CutoutTemplateUpdate
): Promise<Result<void, StorageError>> {
  try {
    const db = await getDb();

    // Load existing template
    const existing = (await db.get(CUTOUTS_STORE, id)) as CutoutTemplate | undefined;
    if (!existing) {
      return err(storageError.notFound(id));
    }

    // Validate contour if being updated
    if (updates.contour) {
      const validation = validateContour(updates.contour);
      if (!validation.ok) {
        return validation;
      }
    }

    // Merge updates
    const updated: CutoutTemplate = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve createdAt
      updatedAt: new Date().toISOString(), // Update timestamp
    };

    await db.put(CUTOUTS_STORE, updated);

    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    return err(storageError.storageFailed(message));
  }
}

/**
 * Generate a unique name for a template.
 * If the name already exists, adds a numeric suffix.
 *
 * @param baseName Desired name
 * @returns Unique name (may have suffix like "(2)")
 */
export async function generateUniqueName(baseName: string): Promise<string> {
  const templates = await loadCutoutTemplates();
  const existingNames = new Set(templates.map((t) => t.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Find next available suffix
  let suffix = 2;
  while (existingNames.has(`${baseName} (${suffix})`)) {
    suffix++;
  }

  return `${baseName} (${suffix})`;
}

/**
 * Clear all templates from the library.
 * Useful for testing and data reset.
 * Uses a mutex to prevent race conditions with concurrent database access.
 */
export async function clearCutoutLibrary(): Promise<void> {
  // If a clear is already in progress, wait for it
  if (clearInProgress) {
    await clearInProgress;
    return;
  }

  // Create the clear operation and store the promise
  clearInProgress = (async () => {
    try {
      // Close existing connection first
      closeCutoutDatabase();

      // Delete and recreate the database for a clean slate
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(request.error?.message ?? 'Failed to delete database'));
      });

      // Reset instance so next getDb() creates fresh connection
      dbInstance = null;
    } finally {
      // Always clear the mutex when done
      clearInProgress = null;
    }
  })();

  await clearInProgress;
}

/**
 * Close the database connection.
 */
export function closeCutoutDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
