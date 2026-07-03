/**
 * Cross-session cache for baseplate export bytes (STL / STEP).
 *
 * Exporting a large split baseplate rebuilds and re-tessellates every unique
 * piece from scratch on every export — even an identical re-export after a
 * reload. This persists each unique piece's export bytes in IndexedDB so a
 * repeat export of the same geometry is near-instant.
 *
 * Correctness — the cache MUST never serve bytes for different geometry:
 *   - Key includes the build's git SHA (`__GIT_SHA__`), so any generator change
 *     shipped in a new deploy invalidates the whole cache. Within one deploy the
 *     geometry pipeline is fixed, so cached bytes are byte-identical to a rebuild.
 *   - Key includes a complete, order-stable serialization of the exact params
 *     passed to `exportBaseplate` (the sole determinant of the worker output),
 *     plus the export format and the session nozzle size (which scales connector
 *     geometry but isn't carried on the per-piece params object). Including the
 *     nozzle explicitly can only ever cause a conservative miss, never a wrong hit.
 *
 * Every operation degrades gracefully: if IndexedDB is unavailable (private
 * mode, quota, disabled), reads miss and writes no-op — the export still runs,
 * just without the cache.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ResolvedBaseplateParams, ExportFileFormat } from '@/shared/types/bin';
import { BASEPLATE_EXPORT_DB_NAME } from '@/core/storage/storageKeys';

const DB_NAME = BASEPLATE_EXPORT_DB_NAME;
const DB_VERSION = 1;
const STORE = 'exports';
const TS_INDEX = 'ts';

/** Evict oldest entries once the cache exceeds this many bytes. */
let maxBytes = 50 * 1024 * 1024;

/** Test-only: shrink the byte budget so eviction can be exercised cheaply. */
export function setExportCacheMaxBytesForTests(bytes: number): void {
  maxBytes = bytes;
}

interface CacheEntry {
  readonly data: ArrayBuffer;
  readonly size: number;
  ts: number;
}

/** Build SHA, inlined by Vite at build time; falls back to 'dev' under test/SSR. */
const BUILD_ID = typeof __GIT_SHA__ === 'string' ? __GIT_SHA__ : 'dev';

// Strictly-monotonic recency stamp: wall-clock when it advances, else +1, so
// entries written or touched in the same millisecond still order deterministically.
let lastTs = 0;
function nextTs(): number {
  const now = Date.now();
  lastTs = now > lastTs ? now : lastTs + 1;
  return lastTs;
}

let dbPromise: Promise<IDBPDatabase | null> | null = null;

function getDb(): Promise<IDBPDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE);
      store.createIndex(TS_INDEX, 'ts');
    },
  }).catch(() => null); // IndexedDB unavailable → null, callers treat as miss/no-op
  return dbPromise;
}

/**
 * Recursively key-sorted JSON so logically-equal param objects stringify
 * identically.
 *
 * Object keys whose value is `null` or `undefined` are omitted, so an unset
 * optional param is canonical regardless of how it arrives — absent, `undefined`
 * (in-memory default), or `null` (after a JSON/storage round-trip). This matches
 * the generator, which reads every optional baseplate param with nullish
 * semantics (`x ?? default`, `x !== false`, truthiness), so those three forms
 * produce byte-identical geometry and must share a key. Real values (including
 * `false`/`0`) are always kept, so a meaningful flag never collapses into "unset".
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== null && obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Cache key for one piece's export. Complete by construction: build id + format
 * + session nozzle + the full param object that drives the worker output.
 */
export function buildExportCacheKey(
  params: ResolvedBaseplateParams,
  format: ExportFileFormat,
  nozzleSizeMm: number
): string {
  return `${BUILD_ID}|${format}|n${nozzleSizeMm}|${stableStringify(params)}`;
}

/** Read one cached export, touching its recency. Returns undefined on miss/error. */
export async function getCachedExport(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const entry = (await db.get(STORE, key)) as CacheEntry | undefined;
    if (!entry) return undefined;
    // Touch recency best-effort; don't block or fail the read on it.
    void db.put(STORE, { ...entry, ts: nextTs() }, key).catch(() => {});
    return entry.data;
  } catch {
    return undefined;
  }
}

/** Batch read; result[i] is the bytes for keys[i] or undefined on miss. */
export async function getCachedExports(keys: string[]): Promise<(ArrayBuffer | undefined)[]> {
  return Promise.all(keys.map((k) => getCachedExport(k)));
}

/**
 * Return cached bytes for `key`, or run `generate`, persist (best-effort), and
 * return its result. For single exports (one plate, the connector key); the
 * split path partitions hits/misses itself to keep the worker pool busy.
 */
export async function getOrExport(
  key: string,
  generate: () => Promise<ArrayBuffer>
): Promise<ArrayBuffer> {
  const hit = await getCachedExport(key);
  if (hit !== undefined) return hit;
  const data = await generate();
  void putCachedExports([{ key, data }]);
  return data;
}

/** Store export bytes, then evict oldest entries if over the byte budget. No-op on error. */
export async function putCachedExports(
  entries: ReadonlyArray<{ key: string; data: ArrayBuffer }>
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await getDb();
    if (!db) return;
    {
      const tx = db.transaction(STORE, 'readwrite');
      // Distinct, increasing ts per entry so intra-batch eviction order is
      // deterministic (a shared stamp would tie-break by key, not recency).
      await Promise.all(
        entries.map((e) =>
          tx.store.put({ data: e.data, size: e.data.byteLength, ts: nextTs() }, e.key)
        )
      );
      await tx.done;
    }
    await evictIfNeeded(db);
  } catch {
    // best-effort cache; ignore
  }
}

/** Evict oldest-touched entries (LRU) until total bytes are under the budget. */
async function evictIfNeeded(db: IDBPDatabase): Promise<void> {
  // Single transaction: walk the ts index oldest-first, tallying sizes and the
  // store keys, then delete from the oldest end until under budget. (Two
  // overlapping readwrite transactions on the same store can deadlock.)
  const tx = db.transaction(STORE, 'readwrite');
  const ordered: { key: IDBValidKey; size: number }[] = [];
  let total = 0;
  for await (const cursor of tx.store.index(TS_INDEX).iterate()) {
    const size = (cursor.value as CacheEntry).size;
    ordered.push({ key: cursor.primaryKey, size });
    total += size;
  }
  for (let i = 0; i < ordered.length && total > maxBytes; i++) {
    await tx.store.delete(ordered[i].key);
    total -= ordered[i].size;
  }
  await tx.done;
}

/** Clear the entire export cache (exposed for tests / settings "clear storage"). */
export async function clearExportCache(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.clear(STORE);
  } catch {
    // ignore
  }
}
