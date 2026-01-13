/**
 * IndexedDB wrapper for storing layouts with compression.
 * Uses the `idb` library for a promise-based API.
 *
 * Storage structure:
 * - Database: 'gridfinity-db'
 * - Object stores:
 *   - 'layouts': Local layout data (key: layout id)
 *   - 'collection-cache': Cached collection layouts (key: `{collectionId}:{layoutId}`)
 */

import { openDB, type IDBPDatabase } from 'idb';
import { compressLayout, decompressLayout } from './compression';
import type { Layout } from '../types';

const DB_NAME = 'gridfinity-db';
const DB_VERSION = 1;

// Store names
const LAYOUTS_STORE = 'layouts';
const COLLECTION_CACHE_STORE = 'collection-cache';

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
    await indexedDB.deleteDatabase('__test__');
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

      // Create collection cache store if it doesn't exist
      if (!db.objectStoreNames.contains(COLLECTION_CACHE_STORE)) {
        db.createObjectStore(COLLECTION_CACHE_STORE);
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
  const compressed = await db.get(LAYOUTS_STORE, id);

  if (!compressed) {
    return null;
  }

  return decompressLayout(compressed);
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
 * Generate a cache key for collection layouts.
 */
function getCacheKey(collectionId: string, layoutId: string): string {
  return `${collectionId}:${layoutId}`;
}

/**
 * Save a layout to the collection cache.
 */
export async function saveCollectionCache(
  collectionId: string,
  layoutId: string,
  layout: Layout
): Promise<void> {
  const db = await getDb();
  const compressed = compressLayout(layout);
  const key = getCacheKey(collectionId, layoutId);
  await db.put(COLLECTION_CACHE_STORE, compressed, key);
}

/**
 * Load a layout from the collection cache.
 * @returns The layout or null if not found
 */
export async function loadCollectionCache(
  collectionId: string,
  layoutId: string
): Promise<Layout | null> {
  const db = await getDb();
  const key = getCacheKey(collectionId, layoutId);
  const compressed = await db.get(COLLECTION_CACHE_STORE, key);

  if (!compressed) {
    return null;
  }

  return decompressLayout(compressed);
}

/**
 * Delete a layout from the collection cache.
 */
export async function deleteCollectionCache(
  collectionId: string,
  layoutId: string
): Promise<void> {
  const db = await getDb();
  const key = getCacheKey(collectionId, layoutId);
  await db.delete(COLLECTION_CACHE_STORE, key);
}

/**
 * Clear all data from the database.
 * Useful for testing and complete data reset.
 */
export async function clearAllData(): Promise<void> {
  // Close existing connection first
  closeDatabase();

  // Delete and recreate the database for a clean slate
  await indexedDB.deleteDatabase(DB_NAME);

  // Reset instance so next getDb() creates fresh connection
  dbInstance = null;
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
