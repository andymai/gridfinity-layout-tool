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
  try {
    const db = await openDB();
    await deleteStaleEntries(db, wasmUrl);
    await putModule(db, wasmUrl, module);
    db.close();
  } catch {
    // IDB unavailable or other error — caching is best-effort
  }
}

/** Delete all entries except the one matching `keepUrl`. */
async function deleteStaleEntries(db: IDBDatabase, keepUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
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
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message ?? 'IDB transaction failed'));
  });
}

/** Put a module into the store, retrying once on QuotaExceededError. */
async function putModule(
  db: IDBDatabase,
  wasmUrl: string,
  module: WebAssembly.Module
): Promise<void> {
  try {
    await putModuleOnce(db, wasmUrl, module);
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Clear all entries and retry once
      await clearStore(db);
      await putModuleOnce(db, wasmUrl, module);
    } else {
      throw e;
    }
  }
}

function putModuleOnce(
  db: IDBDatabase,
  wasmUrl: string,
  module: WebAssembly.Module
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(module, wasmUrl);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message ?? 'IDB transaction failed'));
  });
}

function clearStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message ?? 'IDB transaction failed'));
  });
}
