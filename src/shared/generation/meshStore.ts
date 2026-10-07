/**
 * Local store for mesh files (see `meshFile.ts`), keyed by the SHA-256 of
 * their bytes. Designs, versions, duplicates and variants hold small refs into
 * it, so a mesh is stored once however many records name it.
 *
 * Its own database rather than a third store in the designer's: opening an
 * existing database at a higher version waits until every other tab holding it
 * closes, and the tabs open today never close on a version change, so a new
 * tab's designs would hang behind an old one.
 *
 * Every file read since the page loaded stays in a byte-budgeted memory cache:
 * the generation worker is sent the same few files on every edit.
 */

import { createDbAccessor } from '@/core/storage/backends/openSingleton';
import { createLogger } from '@/core/logger';
import { sha256Hex } from './sha256';

const logger = createLogger('MeshStore');

const DB_NAME = 'gridfinity-mesh-files';
const DB_VERSION = 1;
const FILES_STORE = 'files';
// Size and last use per file, apart from the bytes, so the sweep reads no mesh.
const META_STORE = 'meta';

interface StoredMeshFile {
  readonly hash: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

interface MeshFileMeta {
  readonly hash: string;
  readonly size: number;
  readonly touchedAt: number;
}

/**
 * How long an unreferenced file outlives its last use. Long enough that an undo
 * in a tab left open, or a design saved a while after its mesh was stored,
 * still finds the file.
 */
export const MESH_SWEEP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const MEMORY_BUDGET_BYTES = 16 * 1024 * 1024;

const db = createDbAccessor({
  name: DB_NAME,
  version: DB_VERSION,
  upgrade(database) {
    if (!database.objectStoreNames.contains(FILES_STORE)) {
      database.createObjectStore(FILES_STORE, { keyPath: 'hash' });
    }
    if (!database.objectStoreNames.contains(META_STORE)) {
      database.createObjectStore(META_STORE, { keyPath: 'hash' });
    }
  },
  onUnavailable: () => null,
});

/** Insertion order is recency order. */
const memory = new Map<string, Uint8Array<ArrayBuffer>>();
let memoryBytes = 0;
const touchedThisSession = new Set<string>();

function remember(hash: string, bytes: Uint8Array<ArrayBuffer>): void {
  const existing = memory.get(hash);
  if (existing) memoryBytes -= existing.byteLength;
  memory.delete(hash);
  memory.set(hash, bytes);
  memoryBytes += bytes.byteLength;
  for (const [key, value] of memory) {
    if (memoryBytes <= MEMORY_BUDGET_BYTES || key === hash) break;
    memory.delete(key);
    memoryBytes -= value.byteLength;
  }
}

function forget(hash: string): void {
  const existing = memory.get(hash);
  if (!existing) return;
  memoryBytes -= existing.byteLength;
  memory.delete(hash);
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Store a mesh file and answer its hash, or null when it could not be written
 * (no IndexedDB, quota). A file already stored is only marked as used.
 */
export async function putMeshFile(bytes: Uint8Array<ArrayBuffer>): Promise<string | null> {
  if (!hasIndexedDb()) return null;
  try {
    const hash = await sha256Hex(bytes);
    const database = await db.get();
    if (!database) return null;
    const tx = database.transaction([FILES_STORE, META_STORE], 'readwrite');
    const meta = tx.objectStore(META_STORE);
    const existing = (await meta.get(hash)) as MeshFileMeta | undefined;
    if (!existing) {
      void tx.objectStore(FILES_STORE).put({ hash, bytes } satisfies StoredMeshFile);
    }
    void meta.put({ hash, size: bytes.byteLength, touchedAt: Date.now() } satisfies MeshFileMeta);
    await tx.done;
    touchedThisSession.add(hash);
    remember(hash, bytes);
    return hash;
  } catch (e) {
    logger.warn('Failed to store mesh file', { error: String(e) });
    return null;
  }
}

/** The file's bytes, or null when this device does not have it. */
export async function getMeshFile(hash: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const cached = memory.get(hash);
  if (cached) {
    remember(hash, cached);
    return cached;
  }
  if (!hasIndexedDb()) return null;
  try {
    const database = await db.get();
    if (!database) return null;
    const stored = (await database.get(FILES_STORE, hash)) as StoredMeshFile | undefined;
    if (!stored) return null;
    if (!touchedThisSession.has(hash)) {
      touchedThisSession.add(hash);
      const meta: MeshFileMeta = { hash, size: stored.bytes.byteLength, touchedAt: Date.now() };
      await database.put(META_STORE, meta);
    }
    remember(hash, stored.bytes);
    return stored.bytes;
  } catch (e) {
    logger.warn('Failed to read mesh file', { error: String(e) });
    return null;
  }
}

export async function hasMeshFile(hash: string): Promise<boolean> {
  if (memory.has(hash)) return true;
  if (!hasIndexedDb()) return false;
  try {
    const database = await db.get();
    if (!database) return false;
    return (await database.getKey(FILES_STORE, hash)) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Delete every file outside `referenced` that has not been used within
 * {@link MESH_SWEEP_GRACE_MS}, and answer the hashes deleted. The grace period
 * is what makes this safe beside an import still being saved, or another tab's
 * undo history: both used their file recently.
 */
export async function sweepMeshFiles(
  referenced: ReadonlySet<string>,
  now: number = Date.now()
): Promise<string[]> {
  if (!hasIndexedDb()) return [];
  try {
    const database = await db.get();
    if (!database) return [];
    const tx = database.transaction([FILES_STORE, META_STORE], 'readwrite');
    const metas = (await tx.objectStore(META_STORE).getAll()) as MeshFileMeta[];
    const doomed = metas
      .filter((m) => !referenced.has(m.hash) && now - m.touchedAt > MESH_SWEEP_GRACE_MS)
      .map((m) => m.hash);
    for (const hash of doomed) {
      void tx.objectStore(FILES_STORE).delete(hash);
      void tx.objectStore(META_STORE).delete(hash);
    }
    await tx.done;
    for (const hash of doomed) {
      forget(hash);
      touchedThisSession.delete(hash);
    }
    return doomed;
  } catch (e) {
    logger.warn('Mesh file sweep failed', { error: String(e) });
    return [];
  }
}

/** Test-only: drop the connection and every in-memory record. */
export function __resetMeshStoreForTests(): void {
  db.close();
  memory.clear();
  memoryBytes = 0;
  touchedThisSession.clear();
}
