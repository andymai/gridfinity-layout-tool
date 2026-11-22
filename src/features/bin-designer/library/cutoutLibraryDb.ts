/**
 * The cutout library's own IndexedDB database. Apart from the designer's
 * database, because upgrading that one waits for every open tab to let go of it.
 */

import type { IDBPDatabase } from 'idb';
import { createDbAccessor } from '@/core/storage/backends/openSingleton';

const DB_NAME = 'gridfinity-cutout-library-v1';
const DB_VERSION = 1;

export const ITEMS_STORE = 'items';
export const FOLDERS_STORE = 'folders';
/** Made on each device and never synced, keyed by item id. */
export const THUMBNAILS_STORE = 'thumbnails';

const libraryDb = createDbAccessor({
  name: DB_NAME,
  version: DB_VERSION,
  upgrade(db) {
    if (!db.objectStoreNames.contains(ITEMS_STORE)) {
      db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
      db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(THUMBNAILS_STORE)) {
      db.createObjectStore(THUMBNAILS_STORE, { keyPath: 'itemId' });
    }
  },
  // Private windows and blocked storage leave the library empty rather than broken.
  onUnavailable: () => null,
});

export function getLibraryDb(): Promise<IDBPDatabase | null> {
  return libraryDb.get();
}

export function closeLibraryDb(): void {
  libraryDb.close();
}
