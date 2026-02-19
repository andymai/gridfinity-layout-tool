/**
 * IndexedDB backend for storing layouts with compression.
 * Uses the `idb` library for a promise-based API.
 *
 * Storage structure:
 * - Database: 'gridfinity-db'
 * - Object stores:
 *   - 'layouts': Local layout data (key: layout id)
 *   - 'snapshots': Periodic layout snapshots for version history (key: snapshot id)
 */

import { openDB, type IDBPDatabase } from 'idb';
import { compressLayout, decompressLayout } from '@/shared/utils';
import type { Layout } from '@/core/types';
import type { CompressedSnapshot } from '@/core/types';

const DB_NAME = 'gridfinity-db';
const DB_VERSION = 2;

// Store names
const LAYOUTS_STORE = 'layouts';
const SNAPSHOTS_STORE = 'snapshots';

// Database instance cache
let dbInstance: IDBPDatabase | null = null;

/**
 * Check if IndexedDB is available in the current environment.
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  try {
    // Try to open a test database to verify IndexedDB is working
    const testDb = await openDB('__test__', 1);
    testDb.close();
    // Clean up test database
    indexedDB.deleteDatabase('__test__');
    return true;
  } catch {
    return false;
  }
}

/**
 * Open and return the layout database.
 * Creates the database and object stores if they don't exist.
 */
export async function openLayoutDatabase(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create layouts store if it doesn't exist
      if (!db.objectStoreNames.contains(LAYOUTS_STORE)) {
        db.createObjectStore(LAYOUTS_STORE);
      }
      // v2: Create snapshots store with layoutId index
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
        store.createIndex('byLayoutId', 'layoutId', { unique: false });
      }
    },
  });

  return dbInstance;
}

/**
 * Get a fresh database connection (for operations that need isolation).
 */
async function getDb(): Promise<IDBPDatabase> {
  return openLayoutDatabase();
}

/**
 * Save a layout to IndexedDB with compression.
 */
export async function saveLayout(id: string, layout: Layout): Promise<void> {
  const db = await getDb();
  const compressed = compressLayout(layout);
  await db.put(LAYOUTS_STORE, compressed, id);
}

/**
 * Load a layout from IndexedDB.
 * @returns The layout or null if not found
 */
export async function loadLayout(id: string): Promise<Layout | null> {
  const db = await getDb();
  const compressed: unknown = await db.get(LAYOUTS_STORE, id);

  if (!compressed) {
    return null;
  }

  return decompressLayout(compressed as string);
}

/**
 * Delete a layout from IndexedDB.
 */
export async function deleteLayout(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(LAYOUTS_STORE, id);
}

/**
 * Get all stored layout IDs.
 */
export async function getAllLayoutIds(): Promise<string[]> {
  const db = await getDb();
  const keys = await db.getAllKeys(LAYOUTS_STORE);
  return keys as string[];
}

/**
 * Clear all data from the database.
 * Useful for testing and complete data reset.
 */
export function clearAllData(): void {
  // Close existing connection first
  closeDatabase();

  // Delete and recreate the database for a clean slate
  indexedDB.deleteDatabase(DB_NAME);

  // Reset instance so next getDb() creates fresh connection
  dbInstance = null;
}

// === Snapshot Operations ===

/**
 * Save a snapshot to IndexedDB.
 */
export async function saveSnapshot(snapshot: CompressedSnapshot): Promise<void> {
  const db = await getDb();
  await db.put(SNAPSHOTS_STORE, snapshot);
}

/**
 * Get all snapshots for a given layout, sorted by timestamp descending (newest first).
 */
export async function getSnapshotsByLayoutId(layoutId: string): Promise<CompressedSnapshot[]> {
  const db = await getDb();
  const snapshots = await db.getAllFromIndex(SNAPSHOTS_STORE, 'byLayoutId', layoutId);
  return (snapshots as CompressedSnapshot[]).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get a single snapshot by ID.
 */
export async function getSnapshot(id: string): Promise<CompressedSnapshot | undefined> {
  const db = await getDb();
  return db.get(SNAPSHOTS_STORE, id) as Promise<CompressedSnapshot | undefined>;
}

/**
 * Delete a single snapshot.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(SNAPSHOTS_STORE, id);
}

/**
 * Delete all snapshots for a given layout.
 */
export async function deleteSnapshotsByLayoutId(layoutId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
  const index = tx.store.index('byLayoutId');
  let cursor = await index.openCursor(layoutId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Update a snapshot (e.g. to change its label).
 */
export async function updateSnapshot(snapshot: CompressedSnapshot): Promise<void> {
  const db = await getDb();
  await db.put(SNAPSHOTS_STORE, snapshot);
}

/**
 * Close the database connection.
 * Call this when the app is shutting down or before deleting the database.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
