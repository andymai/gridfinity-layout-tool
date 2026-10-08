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
 *
 * A file this page has used is marked used again at most once per
 * {@link MESH_USE_REFRESH_MS}, on reads and through
 * {@link refreshMeshFileUse}, so another tab's sweep never takes a file that a
 * long-open tab still holds a ref to (in its undo history, say).
 */

import { createDbAccessor } from '@/core/storage';
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

/** How stale a used file's last use may get before this page writes it again. */
export const MESH_USE_REFRESH_MS = 24 * 60 * 60 * 1000;

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
/** Every file this page has used, and when it last wrote that use. */
const lastUseWritten = new Map<string, number>();

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

const arrivalListeners = new Set<(hash: string) => void>();

/** Hear of each file that arrives on this device; answers the unsubscribe. */
export function subscribeMeshFileArrivals(listener: (hash: string) => void): () => void {
  arrivalListeners.add(listener);
  return () => arrivalListeners.delete(listener);
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
    const files = tx.objectStore(FILES_STORE);
    const arrived = (await files.getKey(hash)) === undefined;
    if (arrived) void files.put({ hash, bytes } satisfies StoredMeshFile);
    void tx
      .objectStore(META_STORE)
      .put({ hash, size: bytes.byteLength, touchedAt: Date.now() } satisfies MeshFileMeta);
    await tx.done;
    lastUseWritten.set(hash, Date.now());
    remember(hash, bytes);
    if (arrived) for (const listener of arrivalListeners) listener(hash);
    return hash;
  } catch (e) {
    logger.warn('Failed to store mesh file', { error: String(e) });
    return null;
  }
}

/**
 * Write `now` as the last use of each hash. A file another tab has already
 * swept is stored again from memory when this page still has its bytes.
 */
async function writeUse(hashes: readonly string[], now: number): Promise<void> {
  if (hashes.length === 0 || !hasIndexedDb()) return;
  const database = await db.get();
  if (!database) return;
  // Read and write in one transaction, so another tab's sweep lands wholly
  // before it (the file reads as missing and is stored again) or after it.
  const tx = database.transaction([FILES_STORE, META_STORE], 'readwrite');
  const files = tx.objectStore(FILES_STORE);
  const meta = tx.objectStore(META_STORE);
  const [keys, metas] = await Promise.all([
    Promise.all(hashes.map((hash) => files.getKey(hash))),
    Promise.all(hashes.map((hash) => meta.get(hash) as Promise<MeshFileMeta | undefined>)),
  ]);
  const restored: string[] = [];
  hashes.forEach((hash, i) => {
    const bytes = memory.get(hash);
    if (keys[i] === undefined) {
      if (!bytes) return;
      void files.put({ hash, bytes } satisfies StoredMeshFile);
      restored.push(hash);
    }
    const size = bytes?.byteLength ?? metas[i]?.size ?? 0;
    void meta.put({ hash, size, touchedAt: now } satisfies MeshFileMeta);
  });
  await tx.done;
  for (const hash of hashes) lastUseWritten.set(hash, now);
  for (const hash of restored) for (const listener of arrivalListeners) listener(hash);
}

async function noteUse(hash: string): Promise<void> {
  const now = Date.now();
  const written = lastUseWritten.get(hash);
  if (written !== undefined && now - written < MESH_USE_REFRESH_MS) return;
  lastUseWritten.set(hash, now);
  try {
    await writeUse([hash], now);
  } catch (e) {
    logger.warn('Failed to mark a mesh file used', { error: String(e) });
  }
}

/**
 * Mark used again every file this page has used whose last use is going
 * stale. Run on a timer by a long-open page; a no-op otherwise.
 */
export async function refreshMeshFileUse(now: number = Date.now()): Promise<void> {
  const due = [...lastUseWritten].filter(([, at]) => now - at >= MESH_USE_REFRESH_MS);
  try {
    await writeUse(
      due.map(([hash]) => hash),
      now
    );
  } catch (e) {
    logger.warn('Failed to refresh mesh file use', { error: String(e) });
  }
}

/** The file's bytes, or null when this device does not have it. */
export async function getMeshFile(hash: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const cached = memory.get(hash);
  if (cached) {
    remember(hash, cached);
    await noteUse(hash);
    return cached;
  }
  if (!hasIndexedDb()) return null;
  try {
    const database = await db.get();
    if (!database) return null;
    const stored = (await database.get(FILES_STORE, hash)) as StoredMeshFile | undefined;
    if (!stored) return null;
    remember(hash, stored.bytes);
    await noteUse(hash);
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
    for (const hash of doomed) forget(hash);
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
  lastUseWritten.clear();
}
