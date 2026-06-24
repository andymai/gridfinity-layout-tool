/**
 * Shape caching layer for bin generation.
 *
 * LRU caches for expensive intermediate shapes. Each stores recent results
 * and their cache keys, returning a clone on hit. This avoids rebuilding
 * shapes whose parameters haven't changed between generation calls.
 *
 * Switching between bin sizes now hits cache instead of rebuilding, since
 * the LRU retains up to 5 recent entries per shape type.
 *
 * Cache hierarchy (rough timing share):
 * - socketCache: lofts + fuseAll + cutAll holes (~30% of CAD time)
 * - lipCache: sweep + fillet (~10-15% of CAD time)
 * - boxCache: extrude + shell (~10% of CAD time)
 * - shellCache: assembled base + box + lip (~15% of CAD time for the 2-3 fuses)
 * - patternTemplateCache: pattern shape template (single-entry, cheap to rebuild)
 */

import { clone, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { CacheStats } from './lruCache';
import { LRUCache } from './lruCache';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
import { GRIDFINITY } from '@/shared/constants/bin';
import { clearSocketMeshCache } from './socketMeshCache';
import { clearTextMetricsMemo } from './textBuilder';
import {
  clearTextSolidCache,
  getTextSolidCacheStats,
  resetTextSolidCacheStats,
} from './textSolidCache';

/** Dispose callback for LRU caches holding WASM-backed shapes. */
const disposeShape = (_key: string, shape: Shape3D): void => {
  shape.delete();
};

/** Clone a shape from an LRU cache hit, or return null on miss. Caller owns the clone. */
function cloneFromCache(cache: LRUCache<Shape3D>, key: string): Shape3D | null {
  const shape = cache.get(key);
  return shape !== undefined ? unwrap(clone(shape)) : null;
}

/**
 * Create a cloning cache accessor pair for an LRU cache.
 * On get: returns a clone of the cached shape (caller owns the clone).
 * On set: stores the shape and returns a clone (caller owns the clone, cache owns the original).
 */
function createCloningAccessors(cache: LRUCache<Shape3D>): {
  get: (key: string) => Shape3D | null;
  set: (key: string, shape: Shape3D) => Shape3D;
} {
  return {
    get(key: string): Shape3D | null {
      return cloneFromCache(cache, key);
    },
    set(key: string, shape: Shape3D): Shape3D {
      cache.set(key, shape);
      return unwrap(clone(shape));
    },
  };
}

/** LRU shape caches — sized for iterative design workflows (3-4x previous sizes) */
const socketCache = new LRUCache<Shape3D>('socket', 20, disposeShape);
const lipCache = new LRUCache<Shape3D>('lip', 20, disposeShape);
const boxCache = new LRUCache<Shape3D>('box', 20, disposeShape);
const shellCache = new LRUCache<Shape3D>('shell', 15, disposeShape);
// Post-boolean body (shell + features cut/fused in), keyed on shell + feature
// geometry. Lets a metadata-only edit (label text, notes, category) reuse the
// booleaned body and skip the whole boolean stage — mirrors the baseplate's
// slabWithPocketsCache resume. Like shellCache it holds BASE/LIP/feature
// face-origin tags, so reads must preserve metadata (see getBinBodyCache).
const binBodyCache = new LRUCache<Shape3D>('bin-body', 12, disposeShape);

// Per-cell-size loft templates. A uniform grid lofts one cell socket and clones
// it per position instead of re-lofting every cell (mirrors the baseplate
// pocket template). Keyed on intrinsic cell size + profile detail, so it's
// placement-invariant and shared across grids of any layout.
const cellSocketTemplateCache = new LRUCache<Shape3D>('cell-socket-template', 16, disposeShape);

const socket = createCloningAccessors(socketCache);
const box = createCloningAccessors(boxCache);
const lip = createCloningAccessors(lipCache);
const cellSocketTemplate = createCloningAccessors(cellSocketTemplateCache);

/** Single-entry caches — pattern template is cheap; lastSolid is always the latest */
interface CacheEntry {
  key: string;
  shape: Shape3D;
}

let patternTemplateCache: CacheEntry | null = null;
let lastSolid: Shape3D | null = null;
let lastSolidIsExportQuality = false;

/**
 * Feature tool caches — created lazily by builder name.
 * New builders automatically get their own LRU cache on first use.
 */
const featureToolCaches = new Map<string, LRUCache<Shape3D>>();

/** Get or create a feature cache by name. */
function getOrCreateFeatureCache(name: string): LRUCache<Shape3D> {
  let cache = featureToolCaches.get(name);
  if (!cache) {
    cache = new LRUCache<Shape3D>(`feature-${name}`, 12, disposeShape);
    featureToolCaches.set(name, cache);
  }
  return cache;
}

/** Static LRU caches (socket, lip, box, shell, cell-socket template, bin-body). */
const staticLruCaches: readonly LRUCache<Shape3D>[] = [
  socketCache,
  lipCache,
  boxCache,
  shellCache,
  cellSocketTemplateCache,
  binBodyCache,
];

export function socketCacheKey(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport: boolean,
  halfSockets: boolean,
  gridUnitMm: number = GRIDFINITY.GRID_SIZE,
  maskHash?: string,
  fractionalEdgeX: 'start' | 'end' = 'end',
  fractionalEdgeY: 'start' | 'end' = 'end'
): string {
  // Only append when non-default so 'end'/'end' keys stay byte-identical to
  // pre-feature keys (no needless cache invalidation; existing tests stable).
  const fracSegments =
    fractionalEdgeX === 'end' && fractionalEdgeY === 'end'
      ? []
      : [`frac:${fractionalEdgeX}:${fractionalEdgeY}`];
  return compactKey(
    buildCacheKey(
      'v2',
      quantize(gridW),
      quantize(gridD),
      quantize(gridUnitMm),
      withMagnet,
      withScrew,
      quantize(magnetRadius),
      quantize(magnetDepth),
      quantize(screwRadius),
      forExport,
      halfSockets,
      maskHash ?? 'rect',
      ...fracSegments
    )
  );
}

export const getSocketCache = socket.get;
export const setSocketCache = socket.set;
export const getBoxCache = box.get;
export const setBoxCache = box.set;
export const getLipCache = lip.get;
export const setLipCache = lip.set;

/**
 * Get/set a per-cell-size socket loft template. `get` returns a clone the
 * caller owns (register + translate it); `set` stores the original and returns
 * a clone. Lets the socket grid clone one loft per cell instead of re-lofting.
 */
export const getCellSocketTemplateCache = cellSocketTemplate.get;
export const setCellSocketTemplateCache = cellSocketTemplate.set;

export function getShellCache(key: string): Shape3D | null {
  const cached = shellCache.get(key);
  if (cached === undefined) return null;
  // `clone()` rewraps the topology in a new JS Shape, but the face-origin
  // WeakMap is keyed by `.wrapped` and does not follow. A zero-vector
  // `translate` goes through `translateWithHistory` and calls
  // `propagateAllMetadata`, giving us a metadata-preserving clone — without
  // this the multi-color preview collapses to a single material.
  return translate(cached, [0, 0, 0]);
}

export function setShellCache(key: string, shape: Shape3D): void {
  shellCache.set(key, shape);
}

/**
 * Post-boolean body cache. Same metadata-preserving clone as `getShellCache`:
 * `translate([0,0,0])` carries the BASE/LIP/feature face-origin tags that a bare
 * `clone()` would drop (which would collapse the multi-color preview/export).
 * Returns null on miss. The cache owns the stored shape; callers own the clone.
 */
export function getBinBodyCache(key: string): Shape3D | null {
  const cached = binBodyCache.get(key);
  if (cached === undefined) return null;
  return translate(cached, [0, 0, 0]);
}

export function setBinBodyCache(key: string, shape: Shape3D): void {
  binBodyCache.set(key, shape);
}

/** Returns raw shape (no clone) — caller uses transformCopy which is non-destructive. */
export function getPatternTemplateCache(key: string): Shape3D | null {
  return patternTemplateCache?.key === key ? patternTemplateCache.shape : null;
}

export function setPatternTemplateCache(key: string, shape: Shape3D): void {
  if (patternTemplateCache && patternTemplateCache.shape !== shape) {
    patternTemplateCache.shape.delete();
  }
  patternTemplateCache = { key, shape };
}

export function getLastSolid(): Shape3D | null {
  return lastSolid;
}

/**
 * Whether the cached `lastSolid` was produced by a `forExport=true` pass.
 *
 * Distinguishes solids generated for export from solids left behind by a
 * preview pass. Preview passes run `mesh()` at coarse tolerances, which
 * attaches triangulation to the solid's faces. A subsequent `exportSTL()`
 * call can reuse that stale coarse triangulation instead of re-meshing at
 * export tolerance, causing intermittent STL write failures. Export paths
 * should check this predicate and regenerate when the cached solid is not
 * marked export-quality. See GH #1339.
 */
export function isLastSolidExportQuality(): boolean {
  return lastSolid !== null && lastSolidIsExportQuality;
}

export function setLastSolid(shape: Shape3D | null, isExportQuality = false): void {
  if (lastSolid && lastSolid !== shape) {
    // Defensive: the prior solid may already be disposed or in a corrupt
    // state (e.g. after an export retry path), in which case .delete()
    // can throw. We still want to null the pointer — leaking one WASM
    // handle on an error path is better than failing the retry.
    try {
      lastSolid.delete();
    } catch {
      // Swallow — the handle is unusable either way, and rethrowing would
      // block callers (notably exportBin's retry-after-failure path).
    }
  }
  lastSolid = shape;
  lastSolidIsExportQuality = shape !== null && isExportQuality;
}

export function getFeatureCache(feature: string, key: string): Shape3D | null {
  return cloneFromCache(getOrCreateFeatureCache(feature), key);
}

export function setFeatureCache(feature: string, key: string, shape: Shape3D): void {
  getOrCreateFeatureCache(feature).set(key, shape);
}

// Non-cloning probes for the generation cost estimator — it only needs to know
// whether a stage would be a cache hit, and the metadata-preserving clone in
// the getters is far too expensive for a prediction.

export function hasShellCache(key: string): boolean {
  return shellCache.get(key) !== undefined;
}

export function hasFeatureCache(feature: string, key: string): boolean {
  return getOrCreateFeatureCache(feature).get(key) !== undefined;
}

/** Clear all shape caches, disposing WASM handles. Required when switching geometry kernels in tests. */
export function clearAllCaches(): void {
  for (const cache of staticLruCaches) {
    cache.dispose();
  }
  for (const cache of featureToolCaches.values()) {
    cache.dispose();
  }
  clearSocketMeshCache();
  clearTextMetricsMemo();
  clearTextSolidCache();
  if (patternTemplateCache) {
    patternTemplateCache.shape.delete();
    patternTemplateCache = null;
  }
  if (lastSolid) {
    // Same defensive rationale as setLastSolid: the handle may be corrupt
    // (e.g. mid-retry teardown after an export failure). Always null the
    // pointer even if .delete() throws.
    try {
      lastSolid.delete();
    } catch {
      // Swallow — leaking one WASM handle is better than leaving the
      // cache in an inconsistent state.
    }
    lastSolid = null;
  }
  lastSolidIsExportQuality = false;
}

/** Collect stats from all shape LRU caches. */
export function getAllShapeCacheStats(): CacheStats[] {
  return [
    ...staticLruCaches.map((cache) => cache.getStats()),
    ...[...featureToolCaches.values()].map((cache) => cache.getStats()),
    getTextSolidCacheStats(),
  ];
}

/** Reset stats counters on all shape LRU caches. */
export function resetAllShapeCacheStats(): void {
  for (const cache of staticLruCaches) {
    cache.resetStats();
  }
  for (const cache of featureToolCaches.values()) {
    cache.resetStats();
  }
  resetTextSolidCacheStats();
}
