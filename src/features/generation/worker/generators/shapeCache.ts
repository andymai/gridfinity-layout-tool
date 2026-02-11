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
import { LRUCache } from './lruCache';

// ─── Cache State ─────────────────────────────────────────────────────────────

/** LRU shape caches — maxSize=5 lets users toggle between a few bin sizes without misses */
const socketCache = new LRUCache<Shape3D>(5);
const lipCache = new LRUCache<Shape3D>(5);
const boxCache = new LRUCache<Shape3D>(5);
const shellCache = new LRUCache<Shape3D>(5);

/** Single-entry caches — pattern template is cheap; lastSolid is always the latest */
interface CacheEntry {
  key: string;
  shape: Shape3D;
}

let patternTemplateCache: CacheEntry | null = null;
let lastSolid: Shape3D | null = null;

// ─── Socket Cache ────────────────────────────────────────────────────────────

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
  return `${gridW}|${gridD}|${withMagnet}|${withScrew}|${magnetRadius}|${magnetDepth}|${screwRadius}|${forExport}|${halfSockets}`;
}

export function getSocketCache(key: string): Shape3D | null {
  const shape = socketCache.get(key);
  if (shape !== undefined) {
    return clone(shape);
  }
  return null;
}

export function setSocketCache(key: string, shape: Shape3D): Shape3D {
  socketCache.set(key, shape);
  return clone(shape);
}

// ─── Box Cache ───────────────────────────────────────────────────────────────

export function getBoxCache(key: string): Shape3D | null {
  const shape = boxCache.get(key);
  if (shape !== undefined) {
    return clone(shape);
  }
  return null;
}

export function setBoxCache(key: string, shape: Shape3D): Shape3D {
  boxCache.set(key, shape);
  return clone(shape);
}

// ─── Lip Cache ───────────────────────────────────────────────────────────────

export function getLipCache(key: string): Shape3D | null {
  const shape = lipCache.get(key);
  if (shape !== undefined) {
    return clone(shape);
  }
  return null;
}

export function setLipCache(key: string, shape: Shape3D): Shape3D {
  lipCache.set(key, shape);
  return clone(shape);
}

// ─── Shell Cache ─────────────────────────────────────────────────────────────

export function getShellCache(key: string): Shape3D | null {
  const shape = shellCache.get(key);
  if (shape !== undefined) {
    return clone(shape);
  }
  return null;
}

export function setShellCache(key: string, shape: Shape3D): void {
  shellCache.set(key, shape);
}

// ─── Pattern Template Cache ──────────────────────────────────────────────────

export function getPatternTemplateCache(key: string): Shape3D | null {
  if (patternTemplateCache?.key === key) {
    return patternTemplateCache.shape;
  }
  return null;
}

export function setPatternTemplateCache(key: string, shape: Shape3D): void {
  patternTemplateCache = { key, shape };
}

// ─── Last Solid Cache ────────────────────────────────────────────────────────

/** Get the last generated solid for export operations. */
export function getLastSolid(): Shape3D | null {
  return lastSolid;
}

/** Store the last generated solid for export operations. */
export function setLastSolid(shape: Shape3D | null): void {
  lastSolid = shape;
}

// ─── Feature Tool Caches ─────────────────────────────────────────────────────
// Cache the expensive tool shape (before boolean application) for each feature.
// maxSize=3: typical user edits one feature at a time; 3 entries covers recent sizes.

const featureToolCaches = new Map<string, LRUCache<Shape3D>>([
  ['compartmentWalls', new LRUCache<Shape3D>(3)],
  ['insertCuts', new LRUCache<Shape3D>(3)],
  ['labelTabs', new LRUCache<Shape3D>(3)],
  ['scoopRamps', new LRUCache<Shape3D>(3)],
  ['slotCuts', new LRUCache<Shape3D>(3)],
]);

export function getFeatureCache(feature: string, key: string): Shape3D | null {
  const cache = featureToolCaches.get(feature);
  if (!cache) return null;
  const shape = cache.get(key);
  if (shape !== undefined) {
    return clone(shape);
  }
  return null;
}

export function setFeatureCache(feature: string, key: string, shape: Shape3D): void {
  const cache = featureToolCaches.get(feature);
  if (cache) {
    cache.set(key, shape);
  }
}
