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

import { clone } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { CacheStats } from './lruCache';
import { LRUCache } from './lruCache';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';
/** Dispose callback for LRU caches holding WASM-backed shapes. */
const disposeShape = (_key: string, shape: Shape3D): void => {
  shape.delete();
};

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
      const shape = cache.get(key);
      return shape !== undefined ? clone(shape) : null;
    },
    set(key: string, shape: Shape3D): Shape3D {
      cache.set(key, shape);
      return clone(shape);
    },
  };
}

/** LRU shape caches — sized for iterative design workflows (3-4x previous sizes) */
const socketCache = new LRUCache<Shape3D>('socket', 20, disposeShape);
const lipCache = new LRUCache<Shape3D>('lip', 20, disposeShape);
const boxCache = new LRUCache<Shape3D>('box', 20, disposeShape);
const shellCache = new LRUCache<Shape3D>('shell', 15, disposeShape);

const socket = createCloningAccessors(socketCache);
const box = createCloningAccessors(boxCache);
const lip = createCloningAccessors(lipCache);

/** Single-entry caches — pattern template is cheap; lastSolid is always the latest */
interface CacheEntry {
  key: string;
  shape: Shape3D;
}

let patternTemplateCache: CacheEntry | null = null;
let lastSolid: Shape3D | null = null;
/** Feature tool caches — sized for multi-feature iteration workflows */
const FEATURE_NAMES = [
  'compartmentWalls',
  'insertCuts',
  'labelTabs',
  'scoopRamps',
  'slotCuts',
  'wallCutoutCuts',
] as const;

const featureToolCaches = new Map<string, LRUCache<Shape3D>>(
  FEATURE_NAMES.map((name) => [name, new LRUCache<Shape3D>(`feature-${name}`, 12, disposeShape)])
);

/** All LRU caches, for batch disposal in clearAllCaches. */
const allLruCaches: readonly LRUCache<Shape3D>[] = [
  socketCache,
  lipCache,
  boxCache,
  shellCache,
  ...featureToolCaches.values(),
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
  halfSockets: boolean
): string {
  return compactKey(
    buildCacheKey(
      'v1',
      quantize(gridW),
      quantize(gridD),
      withMagnet,
      withScrew,
      quantize(magnetRadius),
      quantize(magnetDepth),
      quantize(screwRadius),
      forExport,
      halfSockets
    )
  );
}

export const getSocketCache = socket.get;
export const setSocketCache = socket.set;
export const getBoxCache = box.get;
export const setBoxCache = box.set;
export const getLipCache = lip.get;
export const setLipCache = lip.set;
export function getShellCache(key: string): Shape3D | null {
  const shape = shellCache.get(key);
  return shape !== undefined ? clone(shape) : null;
}

export function setShellCache(key: string, shape: Shape3D): void {
  shellCache.set(key, shape);
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

export function setLastSolid(shape: Shape3D | null): void {
  if (lastSolid && lastSolid !== shape) lastSolid.delete();
  lastSolid = shape;
}
export function getFeatureCache(feature: string, key: string): Shape3D | null {
  const cache = featureToolCaches.get(feature);
  if (!cache) return null;
  const shape = cache.get(key);
  return shape !== undefined ? clone(shape) : null;
}

export function setFeatureCache(feature: string, key: string, shape: Shape3D): void {
  featureToolCaches.get(feature)?.set(key, shape);
}
/** Clear all shape caches, disposing WASM handles. Required when switching geometry kernels in tests. */
export function clearAllCaches(): void {
  for (const cache of allLruCaches) {
    cache.dispose();
  }
  if (patternTemplateCache) {
    patternTemplateCache.shape.delete();
    patternTemplateCache = null;
  }
  if (lastSolid) {
    lastSolid.delete();
    lastSolid = null;
  }
}

/** Collect stats from all shape LRU caches. */
export function getAllShapeCacheStats(): CacheStats[] {
  return allLruCaches.map((cache) => cache.getStats());
}

/** Reset stats counters on all shape LRU caches. */
export function resetAllShapeCacheStats(): void {
  for (const cache of allLruCaches) {
    cache.resetStats();
  }
}
