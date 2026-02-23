/**
 * WWW → Canonical domain storage migration.
 *
 * When a user has been using www.gridfinitylayouttool.com, their localStorage
 * and IndexedDB data is stranded on that origin. This module reads all
 * gridfinity-* data from the www origin, sends it to a hidden iframe on the
 * canonical domain via postMessage, and redirects the user once the data is
 * safely written.
 *
 * This module is dynamically imported only when `window.__wwwMigrationPending`
 * is set by the inline detection script in index.html.
 */

const CANONICAL_ORIGIN = 'https://gridfinitylayouttool.com';
const BRIDGE_URL = `${CANONICAL_ORIGIN}/storage-bridge.html`;
const MIGRATION_FLAG = 'gridfinity-www-migrated';
const GRIDFINITY_PREFIX = 'gridfinity-';
const BRIDGE_TIMEOUT_MS = 30_000;

// IDB database schemas — must match:
//   src/core/storage/backends/indexedDB.ts (gridfinity-db v3)
//   src/features/bin-designer/storage/DesignerStorage.ts (gridfinity-designer-v1 v1)
// Also duplicated in public/storage-bridge.html
const IDB_DATABASES = [
  {
    name: 'gridfinity-db',
    version: 3,
    stores: [
      { name: 'layouts', keyPath: null },
      { name: 'snapshots', keyPath: 'id' },
      { name: 'library', keyPath: null },
      { name: 'ml-data', keyPath: null },
      { name: 'shared-with-me', keyPath: null },
    ],
  },
  {
    name: 'gridfinity-designer-v1',
    version: 1,
    stores: [{ name: 'designs', keyPath: 'id' }],
  },
] as const;

interface IDBRecord {
  key: IDBValidKey;
  value: unknown;
}

interface IndexedDBPayload {
  [dbName: string]: {
    [storeName: string]: IDBRecord[];
  };
}

interface MigrationData {
  type: 'www-migration-data';
  localStorage: Record<string, string>;
  indexedDB: IndexedDBPayload;
}

interface MigrationComplete {
  type: 'www-migration-complete';
  stats: {
    localStorageWritten: number;
    localStorageSkipped: number;
    idbWritten: number;
    idbSkipped: number;
  };
}

interface MigrationError {
  type: 'www-migration-error';
  error: string;
}

type BridgeResponse = MigrationComplete | MigrationError;

/** Collect all gridfinity-* keys from localStorage. */
export function readAllLocalStorage(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(GRIDFINITY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
  }
  return data;
}

/** Read all records from a single IDB object store. */
function readStore(db: IDBDatabase, storeName: string): Promise<IDBRecord[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const records: IDBRecord[] = [];

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          records.push({
            key: cursor.key,
            value: cursor.value,
          });
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(records);
      tx.onerror = () => reject(tx.error ?? new Error(`Failed to read ${storeName}`));
    } catch {
      // Store doesn't exist or DB is in a bad state
      resolve([]);
    }
  });
}

/** Open an IDB database at the specified version (read-only, no schema creation). */
function openDatabase(name: string, version: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      // If we're triggering an upgrade, the database didn't exist at this version.
      // Abort the transaction first (rolls back the version bump), then the connection
      // closes naturally. Calling .close() before .abort() can commit the empty upgrade.
      request.transaction?.abort();
      resolve(null);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** Read all IndexedDB data from both gridfinity databases. */
export async function readAllIndexedDB(): Promise<IndexedDBPayload> {
  const payload: IndexedDBPayload = {};

  for (const dbDef of IDB_DATABASES) {
    const db = await openDatabase(dbDef.name, dbDef.version);
    if (!db) continue;

    const dbData: Record<string, IDBRecord[]> = {};
    let hasData = false;

    for (const storeDef of dbDef.stores) {
      if (!db.objectStoreNames.contains(storeDef.name)) continue;
      const records = await readStore(db, storeDef.name);
      if (records.length > 0) {
        dbData[storeDef.name] = records;
        hasData = true;
      }
    }

    db.close();

    if (hasData) {
      payload[dbDef.name] = dbData;
    }
  }

  return payload;
}

/** Send data to the bridge iframe and wait for a response. */
function sendToBridge(data: MigrationData): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = BRIDGE_URL;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Bridge timeout — the canonical domain did not respond within 30 seconds'));
    }, BRIDGE_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.origin !== CANONICAL_ORIGIN) return;
      const msg = event.data as Record<string, unknown> | undefined;
      if (!msg) return;
      if (msg.type !== 'www-migration-complete' && msg.type !== 'www-migration-error') return;

      cleanup();
      resolve(msg as unknown as BridgeResponse);
    }

    function cleanup(): void {
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      iframe.remove();
    }

    window.addEventListener('message', onMessage);

    iframe.onload = () => {
      if (!iframe.contentWindow) {
        cleanup();
        reject(
          new Error(
            'Bridge iframe loaded but contentWindow is unavailable — cross-origin isolation may be blocking communication'
          )
        );
        return;
      }

      // contentDocument is accessible (non-null) when the iframe is same-origin (about:blank).
      // This fires either on an initial blank load before the bridge URL navigates in, or when
      // the navigation was blocked (e.g. CSP). When the bridge loads successfully it is
      // cross-origin, so contentDocument is null. Wait for the real load in either case.
      let isBlankPage: boolean;
      try {
        isBlankPage = iframe.contentDocument !== null;
      } catch {
        isBlankPage = false; // SecurityError → cross-origin → bridge loaded
      }
      if (isBlankPage) return;

      try {
        iframe.contentWindow.postMessage(data, CANONICAL_ORIGIN);
      } catch (e) {
        cleanup();
        reject(
          new Error(`Failed to send data to bridge: ${e instanceof Error ? e.message : String(e)}`)
        );
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error('Failed to load storage bridge iframe'));
    };

    document.body.appendChild(iframe);
  });
}

/** Show the migration overlay, rebuilding spinner UI if showError() replaced it. */
function showOverlay(message?: string): void {
  const overlay = document.getElementById('www-migration-overlay');
  if (!overlay) return;

  let msgEl = overlay.querySelector('[data-migration-message]');

  if (!msgEl) {
    // showError() removed all overlay children — rebuild the spinner UI using safe DOM APIs
    // to match the inline HTML in index.html exactly.
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    const heading = document.createElement('p');
    heading.setAttribute('data-migration-message', '');
    heading.style.cssText = 'font-size:18px;margin:0;font-weight:500';
    heading.textContent = "We've updated our domain";

    const subtitle = document.createElement('p');
    subtitle.style.cssText =
      'font-size:14px;margin:0;color:#a1a1aa;max-width:340px;text-align:center;line-height:1.5';
    subtitle.textContent =
      'Your layouts are being copied to gridfinitylayouttool.com. Nothing will be lost.';

    const spinner = document.createElement('div');
    spinner.style.cssText =
      'width:32px;height:32px;border:3px solid #3f3f46;border-top-color:#3b82f6;border-radius:50%;animation:www-spin 0.8s linear infinite;margin-top:4px';

    overlay.appendChild(heading);
    overlay.appendChild(subtitle);
    overlay.appendChild(spinner);

    msgEl = heading;
  }

  overlay.style.display = 'flex';
  if (message) msgEl.textContent = message;
}

/** Show error state with retry/continue buttons using safe DOM APIs. */
function showError(error: string): void {
  const overlay = document.getElementById('www-migration-overlay');
  if (!overlay) return;

  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

  const container = document.createElement('div');
  container.style.cssText = 'text-align:center;max-width:400px';

  const title = document.createElement('p');
  title.style.cssText = 'color:#ef4444;font-size:18px;margin-bottom:4px;font-weight:500';
  title.textContent = "We couldn't transfer your data";

  const detail = document.createElement('p');
  detail.style.cssText = 'color:#a1a1aa;font-size:14px;margin-bottom:8px';
  detail.textContent = error;

  const reassurance = document.createElement('p');
  reassurance.style.cssText = 'color:#a1a1aa;font-size:14px;margin-bottom:24px';
  reassurance.textContent = 'Your layouts are still safe on this domain.';

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:12px;justify-content:center';

  const retryBtn = document.createElement('button');
  retryBtn.style.cssText =
    'padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px';
  retryBtn.textContent = 'Try again';
  retryBtn.type = 'button';
  retryBtn.addEventListener('click', () => {
    void runWwwMigration();
  });

  const continueBtn = document.createElement('button');
  continueBtn.style.cssText =
    'padding:10px 20px;background:#27272a;color:#a1a1aa;border:1px solid #3f3f46;border-radius:8px;cursor:pointer;font-size:14px';
  continueBtn.textContent = 'Continue without transferring';
  continueBtn.type = 'button';
  continueBtn.addEventListener('click', () => {
    // Set session-only bypass so the detection script skips migration on reload
    sessionStorage.setItem('gridfinity-www-migration-bypass', 'true');
    window.location.reload();
  });

  buttons.appendChild(retryBtn);
  buttons.appendChild(continueBtn);
  container.appendChild(title);
  container.appendChild(detail);
  container.appendChild(reassurance);
  container.appendChild(buttons);
  overlay.appendChild(container);
}

/** Unregister any service workers on the www origin. */
async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
}

/** Main migration entry point. Called from main.tsx when __wwwMigrationPending is set. */
export async function runWwwMigration(): Promise<void> {
  showOverlay();

  try {
    const lsData = readAllLocalStorage();
    const idbData = await readAllIndexedDB();

    const payload: MigrationData = {
      type: 'www-migration-data',
      localStorage: lsData,
      indexedDB: idbData,
    };

    const response = await sendToBridge(payload);

    if (response.type === 'www-migration-error') {
      showError(response.error);
      return;
    }

    // Clean up service worker on www so stale cache doesn't interfere.
    // Do this before setting the flag — if SW cleanup fails, we retry next visit.
    await unregisterServiceWorkers();

    // Success — set flag so future visits redirect immediately
    localStorage.setItem(MIGRATION_FLAG, 'true');

    const redirectUrl =
      CANONICAL_ORIGIN + window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(redirectUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during migration';
    showError(message);
  }
}
