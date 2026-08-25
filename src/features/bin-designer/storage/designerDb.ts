/**
 * Connection and schema for the Bin Designer's IndexedDB database.
 *
 * Separate from the layout database so the two features' stores cannot collide,
 * and separate from `DesignerStorage` so the designs store and the versions
 * store share one connection instead of racing two `openDB` calls at different
 * versions.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'gridfinity-designer-v1';

/**
 * v2 added {@link DESIGN_VERSIONS_STORE}. The upgrade is additive and guarded,
 * so a v1 database gains the store without touching the designs already in it.
 */
const DB_VERSION = 2;

export const DESIGNS_STORE = 'designs';
export const DESIGN_VERSIONS_STORE = 'designVersions';

let dbInstance: IDBPDatabase | null = null;

export async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DESIGNS_STORE)) {
        const store = db.createObjectStore(DESIGNS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(DESIGN_VERSIONS_STORE)) {
        const store = db.createObjectStore(DESIGN_VERSIONS_STORE, { keyPath: 'id' });
        // Every read is "the versions of one design", so the index carries the
        // whole access pattern; `createdAt` ordering is done in memory because a
        // design's list is bounded by MAX_VERSIONS_PER_DESIGN.
        store.createIndex('designId', 'designId');
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
 * Close the database connection (for testing/cleanup).
 */
export function closeDesignerDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
