/**
 * Cross-session persistence for generated bin preview meshes.
 *
 * The bin-designer's in-memory caches (worker `shapeCache`, undo-history
 * `meshCacheManager`) do not survive a page reload, so reopening a saved custom
 * bin re-pays the full cold start: ~2-4s to load occt-wasm plus ~1-2s to run the
 * generation pipeline. The tessellated preview mesh is deterministic for a given
 * set of params (tolerance is a pure function of dimensions at `forExport=false`)
 * and `MeshData` is structured-clone-serializable, so we persist it in IndexedDB
 * keyed by a hash of the params. On the next open the exact mesh paints in tens
 * of ms as a pre-draft while the worker warms up and regenerates to confirm it.
 *
 * This is a fast pre-paint only — never a source of truth. Exports always
 * regenerate (they need the watertight fused shell), so a stale entry can never
 * corrupt an exported model; the worst case is a momentary wrong preview that
 * the background regeneration immediately replaces.
 */

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '@/shared/types/generation';
import { createLogger } from '@/core/logger';

const logger = createLogger('MeshPersistence');

const DB_NAME = 'gridfinity-mesh-cache';
const DB_VERSION = 1;
const BIN_MESHES_STORE = 'binMeshes';
// Size/timestamp metadata lives in its own store so eviction can walk it
// without deserializing the (large) mesh buffers from `binMeshes`.
const META_STORE = 'binMeshMeta';

/**
 * Bumped whenever the generated mesh bytes can change for the same params —
 * a brepjs/occt-wasm upgrade or a tessellation-tolerance change. A bump changes
 * every key, so old entries never match again and are evicted by the LRU budget.
 * Preview always uses the occt-wasm exact kernel at `forExport=false`, so the
 * kernel and quality are folded into this constant rather than the per-entry key.
 */
const MESH_CACHE_VERSION = 'v1-brepjs18.116.1';

/** Evict oldest entries once the total stored mesh bytes exceed this budget. */
const MAX_CACHE_BYTES = 64 * 1024 * 1024;

interface StoredMesh {
  readonly key: string;
  readonly mesh: MeshData;
}

/** Lightweight per-entry metadata (no mesh buffers) used to drive LRU eviction. */
interface MeshMeta {
  readonly key: string;
  readonly byteSize: number;
  readonly createdAt: number;
}

/** Whether IndexedDB is usable in this environment (absent in SSR / some test runs). */
function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbInstance: IDBPDatabase | null = null;
let openPromise: Promise<IDBPDatabase> | null = null;

async function openMeshDb(): Promise<IDBPDatabase> {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(BIN_MESHES_STORE)) {
        db.createObjectStore(BIN_MESHES_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: 'key' });
        meta.createIndex('byCreatedAt', 'createdAt', { unique: false });
      }
    },
  });

  // Drop the cached handle if the browser closes the connection (tab eviction,
  // a version change from another tab) so the next call reopens cleanly.
  db.addEventListener('close', () => {
    if (dbInstance === db) dbInstance = null;
  });

  return db;
}

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  openPromise ??= openMeshDb()
    .then((db) => {
      dbInstance = db;
      return db;
    })
    .finally(() => {
      openPromise = null;
    });
  return openPromise;
}

/**
 * Stable JSON serialization: keys sorted at every level so params from Immer /
 * undo (whose key order isn't guaranteed) hash identically. `undefined` values
 * are dropped by `JSON.stringify` already; typed arrays don't appear in params.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = obj[k];
      }
      return sorted;
    }
    return val;
  });
}

/** djb2 string hash → unsigned 32-bit hex (matches useSnapshotAutoSave's pattern). */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/** Content-addressed cache key for a bin's preview mesh. */
export function binMeshCacheKey(params: BinParams): string {
  return `${MESH_CACHE_VERSION}:${djb2(stableStringify(params))}`;
}

/** Sum the byte length of every typed array reachable from a mesh (incl. lid). */
function meshByteSize(mesh: MeshData): number {
  let bytes =
    mesh.vertices.byteLength +
    mesh.normals.byteLength +
    mesh.indices.byteLength +
    mesh.edgeVertices.byteLength;
  if (mesh.coarseLOD) {
    bytes += mesh.coarseLOD.vertices.byteLength + mesh.coarseLOD.indices.byteLength;
  }
  if (mesh.lidMesh) {
    bytes +=
      mesh.lidMesh.vertices.byteLength +
      mesh.lidMesh.normals.byteLength +
      mesh.lidMesh.indices.byteLength +
      mesh.lidMesh.edgeVertices.byteLength;
  }
  return bytes;
}

/**
 * Load a persisted preview mesh, or `null` on miss / unavailable store / error.
 * Never throws — a failed read simply means "no pre-draft", and the worker still
 * generates the exact mesh.
 */
export async function loadPersistedBinMesh(key: string): Promise<MeshData | null> {
  if (!hasIndexedDb()) return null;
  try {
    const db = await getDb();
    const stored = (await db.get(BIN_MESHES_STORE, key)) as StoredMesh | undefined;
    return stored?.mesh ?? null;
  } catch (e) {
    logger.warn('Failed to load persisted mesh', { error: String(e) });
    return null;
  }
}

/**
 * Persist a preview mesh (fire-and-forget). Refreshes `createdAt` on repeats so
 * the entry stays LRU-fresh, then evicts oldest entries over the byte budget.
 * All failures are swallowed — persistence must never block generation.
 */
export function savePersistedBinMesh(key: string, mesh: MeshData): void {
  if (!hasIndexedDb()) return;
  void persistMesh(key, mesh);
}

/**
 * Awaitable core of {@link savePersistedBinMesh}; resolves after eviction.
 * Writes the mesh and its metadata in one transaction and evicts within the
 * same transaction so the store never exceeds the budget between calls.
 */
async function persistMesh(key: string, mesh: MeshData): Promise<void> {
  try {
    const db = await getDb();
    const meta: MeshMeta = { key, byteSize: meshByteSize(mesh), createdAt: Date.now() };

    const tx = db.transaction([BIN_MESHES_STORE, META_STORE], 'readwrite');
    const meshes = tx.objectStore(BIN_MESHES_STORE);
    const metas = tx.objectStore(META_STORE);
    await Promise.all([meshes.put({ key, mesh } satisfies StoredMesh), metas.put(meta)]);

    // Walk the metadata index only — its records carry no mesh buffers, so the
    // cursor never materializes the large typed arrays in `binMeshes`.
    let total = 0;
    const ordered: MeshMeta[] = [];
    for await (const cursor of metas.index('byCreatedAt').iterate()) {
      const value = cursor.value as MeshMeta;
      total += value.byteSize;
      ordered.push(value);
    }

    // `ordered` is ascending by createdAt (oldest first).
    for (const entry of ordered) {
      if (total <= MAX_CACHE_BYTES) break;
      await Promise.all([meshes.delete(entry.key), metas.delete(entry.key)]);
      total -= entry.byteSize;
    }

    await tx.done;
  } catch (e) {
    logger.warn('Failed to persist mesh', { error: String(e) });
  }
}

/** Test-only: awaitable save (resolves after the write + eviction settle). */
export function __savePersistedBinMeshForTests(key: string, mesh: MeshData): Promise<void> {
  return persistMesh(key, mesh);
}

/** Test-only: close and drop the cached connection so the DB can be deleted. */
export function __resetMeshDbForTests(): void {
  if (dbInstance) dbInstance.close();
  dbInstance = null;
  openPromise = null;
}
