/**
 * Module-scoped LRU caches for baseplate generation.
 *
 * Three caches at three points in the pipeline:
 * - pocketTemplateCache: per-cell-size loft templates (cloned per position)
 * - slabWithPocketsCache: slab + pocket cuts (before magnets/connectors)
 * - meshResultCache: full tessellated MeshData (skips BREP entirely on hit)
 *
 * Cache eviction disposes the underlying WASM handles via `disposeShape`.
 */

import type { Shape3D } from 'brepjs';
import type { MeshData } from '../../bridge/types';
import type { CacheStats } from './lruCache';
import { LRUCache } from './lruCache';

const disposeShape = (_key: string, shape: Shape3D): void => {
  shape.delete();
};

/** Per-cell-size loft templates. Clone+translate for each grid position. */
export const pocketTemplateCache = new LRUCache<Shape3D>(
  'baseplate-pocket-template',
  48,
  disposeShape
);

/** Fully tessellated mesh data keyed by generation params. Plain JS — no WASM disposal. */
export const meshResultCache = new LRUCache<MeshData>('baseplate-mesh-result', 32);

/**
 * Slab+pockets BREP solid before magnets/connectors. The most expensive
 * boolean step — when only magnet/connector params change, we resume from this
 * cached solid and skip the pocket cuts entirely.
 */
export const slabWithPocketsCache = new LRUCache<Shape3D>(
  'baseplate-slab-with-pockets',
  16,
  disposeShape
);

/** Clear all baseplate shape caches, disposing WASM handles. */
export function clearBaseplateCaches(): void {
  pocketTemplateCache.dispose();
  meshResultCache.clear(); // MeshData is plain JS — no WASM disposal needed
  slabWithPocketsCache.dispose();
}

/** Collect stats from all baseplate LRU caches. */
export function getBaseplateCacheStats(): CacheStats[] {
  return [pocketTemplateCache, meshResultCache, slabWithPocketsCache].map((c) => c.getStats());
}

/** Reset stats counters on all baseplate LRU caches. */
export function resetBaseplateCacheStats(): void {
  pocketTemplateCache.resetStats();
  meshResultCache.resetStats();
  slabWithPocketsCache.resetStats();
}
