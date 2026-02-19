/**
 * IndexedDB backend for storing layouts with compression.
 * Uses the `idb` library for a promise-based API.
 *
 * Storage structure:
 * - Database: 'gridfinity-db'
 * - Object stores:
 *   - 'layouts': Local layout data (key: layout id)
 *   - 'snapshots': Periodic layout snapshots for version history (key: snapshot id)
 *   - 'library': Library index metadata (key: 'index')
 *   - 'ml-data': ML telemetry data like label sizes (key: data id)
 *   - 'shared-with-me': Shared layout entries (key: 'entries')
 */

import { openDB, type IDBPDatabase } from 'idb';
import { compressLayout, decompressLayout } from '@/shared/utils';
import type { Layout, LayoutLibrary, CompressedSnapshot, SharedWithMeEntry } from '@/core/types';

const DB_NAME = 'gridfinity-db';
const DB_VERSION = 3;

// Store names
const LAYOUTS_STORE = 'layouts';
const SNAPSHOTS_STORE = 'snapshots';
const LIBRARY_STORE = 'library';
const LIBRARY_KEY = 'index';
const ML_DATA_STORE = 'ml-data';
const SHARED_WITH_ME_STORE = 'shared-with-me';
const SHARED_WITH_ME_KEY = 'entries';

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
      // v2: Create library store for library index metadata
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE);
      }
      // v3: ML data store (label sizes, etc.)
      if (!db.objectStoreNames.contains(ML_DATA_STORE)) {
        db.createObjectStore(ML_DATA_STORE);
      }
      // v3: Shared-with-me entries
      if (!db.objectStoreNames.contains(SHARED_WITH_ME_STORE)) {
        db.createObjectStore(SHARED_WITH_ME_STORE);
      }
    },
  });

  return dbInstance;
}

/**
 * Save a layout to IndexedDB with compression.
 */
export async function saveLayout(id: string, layout: Layout): Promise<void> {
  const db = await openLayoutDatabase();
  const compressed = compressLayout(layout);
  await db.put(LAYOUTS_STORE, compressed, id);
}

/**
 * Load a layout from IndexedDB.
 * @returns The layout or null if not found
 */
export async function loadLayout(id: string): Promise<Layout | null> {
  const db = await openLayoutDatabase();
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
  const db = await openLayoutDatabase();
  await db.delete(LAYOUTS_STORE, id);
}

/**
 * Get all stored layout IDs.
 */
export async function getAllLayoutIds(): Promise<string[]> {
  const db = await openLayoutDatabase();
  const keys = await db.getAllKeys(LAYOUTS_STORE);
  return keys as string[];
}

// === Library Index Operations ===

/**
 * Save the library index to IndexedDB (no compression — small data).
 */
export async function saveLibraryIndex(library: LayoutLibrary): Promise<void> {
  const db = await openLayoutDatabase();
  await db.put(LIBRARY_STORE, library, LIBRARY_KEY);
}

/**
 * Load the library index from IndexedDB.
 * @returns The library or null if not found
 */
export async function loadLibraryIndex(): Promise<LayoutLibrary | null> {
  const db = await openLayoutDatabase();
  const data: unknown = await db.get(LIBRARY_STORE, LIBRARY_KEY);
  if (!data) return null;
  return data as LayoutLibrary;
}

/**
 * Clear all data by deleting and recreating the database.
 */
export function clearAllData(): void {
  closeDatabase();
  indexedDB.deleteDatabase(DB_NAME);
}

// === Snapshot Operations ===

/**
 * Save a snapshot to IndexedDB.
 */
export async function saveSnapshot(snapshot: CompressedSnapshot): Promise<void> {
  const db = await openLayoutDatabase();
  await db.put(SNAPSHOTS_STORE, snapshot);
}

/**
 * Get all snapshots for a given layout, sorted by timestamp descending (newest first).
 */
export async function getSnapshotsByLayoutId(layoutId: string): Promise<CompressedSnapshot[]> {
  const db = await openLayoutDatabase();
  const snapshots = await db.getAllFromIndex(SNAPSHOTS_STORE, 'byLayoutId', layoutId);
  return (snapshots as CompressedSnapshot[]).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get a single snapshot by ID.
 */
export async function getSnapshot(id: string): Promise<CompressedSnapshot | undefined> {
  const db = await openLayoutDatabase();
  return db.get(SNAPSHOTS_STORE, id) as Promise<CompressedSnapshot | undefined>;
}

/**
 * Delete a single snapshot.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openLayoutDatabase();
  await db.delete(SNAPSHOTS_STORE, id);
}

/**
 * Delete all snapshots for a given layout.
 */
export async function deleteSnapshotsByLayoutId(layoutId: string): Promise<void> {
  const db = await openLayoutDatabase();
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
  const db = await openLayoutDatabase();
  await db.put(SNAPSHOTS_STORE, snapshot);
}

// === ML Data Operations ===

/**
 * Save ML data to IndexedDB (e.g. label sizes for name suggestions).
 */
export async function saveMlData(key: string, data: unknown): Promise<void> {
  const db = await openLayoutDatabase();
  await db.put(ML_DATA_STORE, data, key);
}

/**
 * Load ML data from IndexedDB.
 */
export async function loadMlData<T>(key: string): Promise<T | null> {
  const db = await openLayoutDatabase();
  const result: unknown = await db.get(ML_DATA_STORE, key);
  return result !== undefined ? (result as T) : null;
}

/**
 * Delete ML data from IndexedDB.
 */
export async function deleteMlData(key: string): Promise<void> {
  const db = await openLayoutDatabase();
  await db.delete(ML_DATA_STORE, key);
}

// === Shared-With-Me Operations ===

/**
 * Save shared-with-me entries to IndexedDB.
 */
export async function saveSharedWithMeEntries(entries: SharedWithMeEntry[]): Promise<void> {
  const db = await openLayoutDatabase();
  await db.put(SHARED_WITH_ME_STORE, entries, SHARED_WITH_ME_KEY);
}

/**
 * Load shared-with-me entries from IndexedDB.
 */
export async function loadSharedWithMeEntries(): Promise<SharedWithMeEntry[] | null> {
  const db = await openLayoutDatabase();
  const result: unknown = await db.get(SHARED_WITH_ME_STORE, SHARED_WITH_ME_KEY);
  return result !== undefined ? (result as SharedWithMeEntry[]) : null;
}

/**
 * Clear shared-with-me entries from IndexedDB.
 */
export async function clearSharedWithMeEntries(): Promise<void> {
  const db = await openLayoutDatabase();
  await db.delete(SHARED_WITH_ME_STORE, SHARED_WITH_ME_KEY);
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
