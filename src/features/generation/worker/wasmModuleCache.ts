/**
 * IndexedDB cache for compiled WebAssembly.Module objects.
 *
 * Caches the compiled WASM module so repeat visits skip the ~1-3s
 * compilation step. Uses raw IndexedDB (no library) to keep the
 * worker bundle lean.
 *
 * DB: `gridfinity-wasm-cache`, store: `modules`, key: WASM URL
 * (content-hashed by Vite, so new deployments auto-invalidate).
 */

const DB_NAME = 'gridfinity-wasm-cache';
const STORE_NAME = 'modules';
const DB_VERSION = 1;

/** Open (or create) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message ?? 'IDB open failed'));
  });
}

/**
 * Retrieve a cached compiled WebAssembly.Module for the given WASM URL.
 * Returns `null` on cache miss or if IndexedDB is unavailable.
 */
export async function getCachedModule(wasmUrl: string): Promise<WebAssembly.Module | null> {
  try {
    const db = await openDB();
    return await new Promise<WebAssembly.Module | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(wasmUrl);

      request.onsuccess = () => {
        db.close();
        const result: unknown = request.result;
        if (result instanceof WebAssembly.Module) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(new Error(request.error?.message ?? 'IDB get failed'));
      };
    });
  } catch {
    return null;
  }
}

/**
 * Cache a compiled WebAssembly.Module keyed by its WASM URL.
 * Also deletes any stale entries with different URLs (old deployments).
 *
 * Silently handles QuotaExceededError by clearing the store and retrying once.
 */
export async function cacheModule(wasmUrl: string, module: WebAssembly.Module): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    await deleteStaleEntries(db, wasmUrl);
    await putModule(db, wasmUrl, module);
  } catch {
    // IDB unavailable or other error — caching is best-effort
  } finally {
    db?.close();
  }
}

/** Run a readwrite transaction, passing the object store to the callback. */
function withWriteStore(db: IDBDatabase, action: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    action(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message ?? 'IDB transaction failed'));
  });
}

/** Delete all entries except the one matching `keepUrl`. */
function deleteStaleEntries(db: IDBDatabase, keepUrl: string): Promise<void> {
  return withWriteStore(db, (store) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        if (cursor.key !== keepUrl) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  });
}

/** Put a module into the store, retrying once on QuotaExceededError. */
async function putModule(
  db: IDBDatabase,
  wasmUrl: string,
  module: WebAssembly.Module
): Promise<void> {
  try {
    await withWriteStore(db, (store) => store.put(module, wasmUrl));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      await withWriteStore(db, (store) => store.clear());
      await withWriteStore(db, (store) => store.put(module, wasmUrl));
    } else {
      throw e;
    }
  }
}
