/**
 * Cross-session persistence for generated bin preview meshes.
 *
 * The bin-designer's in-memory caches (worker `shapeCache`, undo-history
 * `meshCacheManager`) do not survive a page reload, so reopening a saved custom
 * bin re-pays the full cold start: ~2-4s to load occt-wasm plus ~1-2s to run the
 * generation pipeline. The tessellated preview mesh is deterministic for a given
 * set of params (tolerance is a pure function of dimensions at `forExport=false`)
 * and `MeshData` is structured-clone-serializable, so we persist it in IndexedDB
 * keyed by a hash of the params plus the kernel that produced them. On the next
 * open the exact mesh paints in tens of ms as a pre-draft while the worker warms
 * up and regenerates to confirm it.
 *
 * This is a fast pre-paint only — never a source of truth. Exports always
 * regenerate (they need the watertight fused shell), so a stale entry can never
 * corrupt an exported model; the worst case is a momentary wrong preview that
 * the background regeneration immediately replaces.
 */

import { createDbAccessor } from '@/core/storage/backends/openSingleton';
import type { BinParams } from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { KernelName } from '@/shared/generation/bridge';
import type { MeshData } from '@/shared/types/generation';
import { meshDataByteSize } from './meshBytes';
import { createLogger } from '@/core/logger';

const logger = createLogger('MeshPersistence');

const DB_NAME = 'gridfinity-mesh-cache';
const DB_VERSION = 1;
const BIN_MESHES_STORE = 'binMeshes';
// Size/timestamp metadata lives in its own store so eviction can walk it
// without deserializing the (large) mesh buffers from `binMeshes`.
const META_STORE = 'binMeshMeta';

/**
 * Bumped whenever the generated mesh bytes can change for the same params on
 * EVERY kernel — a tessellation-tolerance change, or a geometry fix in the
 * kernel-independent pipeline. A bump changes every key, so old entries never
 * match again and are evicted by the LRU budget. For a change that only moves
 * one kernel's output, bump that kernel's {@link KERNEL_MESH_REVISION} entry
 * instead, so the other kernel's users keep their warm cache.
 *
 * `v13`: a half foot now carries magnet/screw holes, so any bin, lid, or plate
 * with a fractional dimension and attachment holes enabled generates different
 * bytes for params it already has an entry under.
 * `v12`: `MeshData` gained `knifeRestMesh`, which entries written before it
 * cannot carry — a knife block would pre-paint without its companion rest
 * until the LRU happened to evict the entry.
 * `v11`: detachable feet changed shape (blind 3mm pins, taper-floored arms)
 * and the layout preview began reading `detachableFeetMesh` off the persisted
 * entry — which pre-change entries cannot carry, and their bodies still have
 * the old through-holes. Without a bump, a linked detachable design keeps
 * rendering its pre-fix mesh until the LRU happens to evict it.
 * `v10`: the kernel id joined the key. Before this, occt-wasm and the
 * brepkit Labs kernel shared one namespace, so switching engines in Labs served
 * the previous engine's mesh for unchanged params.
 * `v9`: brepkit-wasm 3.2.24 reattaches splitter holes, so a slotted no-lip bin
 * gets back the cavity it was rendering solid. Only the Labs kernel's output
 * moved, but one namespace covered both — the last bump that had to.
 * `v8`: label-tab keep-outs on patterned dividers follow `inset` and the
 * anchor edge, so a bin with either cuts a different divider pattern.
 * `v7`: label tabs stopped being forced full-width in socket mode, so
 * the same params cut a different shelf. `useLinkedDesignMeshes` serves a hit
 * without regenerating, so without this bump a linked design in the layout
 * planner would render its pre-fix bin until the entry was evicted.
 */
const MESH_CACHE_VERSION = 'v13';

/**
 * Per-kernel revision, bumped when only THAT kernel's output moves for
 * unchanged params — a brepkit-wasm or occt-wasm upgrade, or a fix in a
 * kernel-specific code path. Bumping one leaves the other kernel's namespace
 * (and its warm entries) untouched.
 *
 * occt-wasm `r1`: brepjs 18.124.8.
 * brepkit `r1`: brepkit-wasm 3.2.28 — the interface-family winding and
 * cap-synthesis fixes move insert/cutout output that reaches a coplanar
 * interface, and the deep-cutout chain is now exact.
 * brepkit `r2`: brepkit-wasm 3.2.36 — the base-fuse island fix moves output
 * for every multi-foot bin (the feet-to-base interface), restoring exact
 * fuses across the scenario catalog.
 * brepkit `r3`: brepkit-wasm 3.2.37 — the hole-weave collinear-overlap fix
 * makes the label-bracket fuse exact (58 analytic faces replace the
 * 121-face fallback mesh), moving output for every bracket-labeled bin.
 *
 * `manifold` is the draft-preview kernel; its meshes are never persisted, but
 * the map is total so a future caller cannot fall through to `undefined`.
 */
const KERNEL_MESH_REVISION: Record<KernelName, string> = {
  'occt-wasm': 'r1',
  brepkit: 'r3',
  manifold: 'r1',
};

/** Evict oldest entries once the total stored mesh bytes exceed this budget. */
let maxCacheBytes = 64 * 1024 * 1024;

interface StoredMesh {
  readonly key: string;
  readonly mesh: MeshData;
}

/** Lightweight per-entry metadata (no mesh buffers) used to drive LRU eviction. */
interface MeshMeta {
  readonly key: string;
  readonly byteSize: number;
  /** Monotonic recency stamp (updated on every write/touch, not creation time). */
  readonly ts: number;
}

/** Whether IndexedDB is usable in this environment (absent in SSR / some test runs). */
function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

// Strictly-monotonic recency stamp: wall-clock when it advances, else +1, so
// entries written in the same millisecond still order deterministically in the
// `byTs` index (keeps LRU eviction "oldest-first" under bursty writes).
let lastStamp = 0;
function nextStamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

const meshDb = createDbAccessor({
  name: DB_NAME,
  version: DB_VERSION,
  upgrade(db) {
    if (!db.objectStoreNames.contains(BIN_MESHES_STORE)) {
      db.createObjectStore(BIN_MESHES_STORE, { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      const meta = db.createObjectStore(META_STORE, { keyPath: 'key' });
      meta.createIndex('byTs', 'ts', { unique: false });
    }
  },
});

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

/**
 * Content-addressed cache key for a bin's preview mesh, namespaced by the
 * kernel that generated it.
 *
 * `kernel` is required rather than resolved here: the same params produce
 * different bytes on each kernel, and a caller that reads a key it did not
 * generate under gets the other engine's mesh. Pass `getActiveKernel`
 * from `@/shared/generation/bridge` — the bridge is constructed from the same
 * resolution, and the Labs engine toggle forces a reload before it can change.
 */
export function binMeshCacheKey(params: BinParams, kernel: KernelName): string {
  const revision = KERNEL_MESH_REVISION[kernel];
  return `${MESH_CACHE_VERSION}:${kernel}-${revision}:${djb2(stableStringify(params))}`;
}

/**
 * Content-addressed cache key for a non-bin item's preview mesh (envelope +
 * discriminated structure). Same kernel-namespacing contract as
 * {@link binMeshCacheKey}; the `item:` segment keeps the two content spaces
 * from ever colliding on a hash.
 */
export function itemMeshCacheKey(item: GridfinityItem, kernel: KernelName): string {
  const revision = KERNEL_MESH_REVISION[kernel];
  // item2: assembly part-quality pass (fillets/chamfers) changed geometry for
  // identical structures; bumping only this segment spares the bin cache.
  return `${MESH_CACHE_VERSION}:${kernel}-${revision}:item2:${djb2(stableStringify(item))}`;
}

/**
 * Load a persisted preview mesh, or `null` on miss / unavailable store / error.
 * Never throws — a failed read simply means "no pre-draft", and the worker still
 * generates the exact mesh.
 */
export async function loadPersistedBinMesh(key: string): Promise<MeshData | null> {
  if (!hasIndexedDb()) return null;
  try {
    const db = await meshDb.get();
    const stored = (await db.get(BIN_MESHES_STORE, key)) as StoredMesh | undefined;
    return stored?.mesh ?? null;
  } catch (e) {
    logger.warn('Failed to load persisted mesh', { error: String(e) });
    return null;
  }
}

/**
 * Persist a preview mesh (fire-and-forget). Refreshes the recency stamp on
 * repeats so the entry stays LRU-fresh, then evicts oldest entries over the
 * byte budget. All failures are swallowed — persistence must never block
 * generation.
 */
export function savePersistedBinMesh(key: string, mesh: MeshData): void {
  if (!hasIndexedDb()) return;
  void persistMesh(key, mesh);
}

/**
 * Awaitable core of {@link savePersistedBinMesh}; resolves after eviction.
 *
 * Each IndexedDB transaction issues all its ops synchronously and awaits only
 * `tx.done` — never an `await` *between* ops inside a live transaction. WebKit
 * auto-commits a transaction as soon as its microtask queue drains, so an
 * `await` gap mid-transaction throws `TransactionInactiveError` on iOS/Safari
 * (see `src/core/cqrs/store/eventStore.ts`). Reads used to plan eviction happen
 * in their own single-request calls (`getAllFromIndex`), outside any open write.
 */
async function persistMesh(key: string, mesh: MeshData): Promise<void> {
  try {
    const db = await meshDb.get();
    const meta: MeshMeta = { key, byteSize: meshDataByteSize(mesh), ts: nextStamp() };

    const writeTx = db.transaction([BIN_MESHES_STORE, META_STORE], 'readwrite');
    void writeTx.objectStore(BIN_MESHES_STORE).put({ key, mesh } satisfies StoredMesh);
    void writeTx.objectStore(META_STORE).put(meta);
    await writeTx.done;

    // Plan eviction from the metadata store only (no mesh buffers), ascending by
    // recency stamp — a single indexed read, not a cursor walk over a live tx.
    const metas = (await db.getAllFromIndex(META_STORE, 'byTs')) as MeshMeta[];
    let total = metas.reduce((sum, m) => sum + m.byteSize, 0);
    if (total <= maxCacheBytes) return;

    const evictTx = db.transaction([BIN_MESHES_STORE, META_STORE], 'readwrite');
    const meshes = evictTx.objectStore(BIN_MESHES_STORE);
    const metaStore = evictTx.objectStore(META_STORE);
    for (const entry of metas) {
      if (total <= maxCacheBytes) break;
      void meshes.delete(entry.key);
      void metaStore.delete(entry.key);
      total -= entry.byteSize;
    }
    await evictTx.done;
  } catch (e) {
    logger.warn('Failed to persist mesh', { error: String(e) });
  }
}

/** Test-only: awaitable save (resolves after the write + eviction settle). */
export function __savePersistedBinMeshForTests(key: string, mesh: MeshData): Promise<void> {
  return persistMesh(key, mesh);
}

/** Test-only: override the eviction byte budget (defaults back to 64 MB). */
export function __setMaxCacheBytesForTests(bytes = 64 * 1024 * 1024): void {
  maxCacheBytes = bytes;
}

/** Test-only: close and drop the cached connection so the DB can be deleted. */
export function __resetMeshDbForTests(): void {
  meshDb.close();
}
