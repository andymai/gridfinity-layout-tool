/**
 * Tessellation cache for the deferred base socket.
 *
 * The base socket is geometrically stable across most preview edits (it only
 * tracks grid dimensions, magnet/screw holes, half-sockets, mask, and overhang
 * feet — never the body's features). Yet every generation builds a fresh WASM
 * solid for it, so brepjs's identity-keyed (WeakMap) mesh cache misses and the
 * socket is re-tessellated each frame. This keys the socket's *mesh* (triangles
 * + feature edge lines) by geometry identity instead, so a non-dimension edit
 * (compartments, labels, dividers, magnets…) reuses the prior socket mesh.
 *
 * Stored arrays are JS-owned (brepjs copies them out of the WASM heap) and the
 * tessellate stage only ever *reads* them — `mergeShapeMeshes`/`concatFloat32`
 * allocate fresh output — so a cached entry is safe to hand back repeatedly.
 */

import { LRUCache } from './lruCache';
import type { CacheStats } from './lruCache';
import type { ShapeMesh } from './utils/mesh';

export interface CachedSocketMesh {
  readonly mesh: ShapeMesh;
  readonly edgeLines: ArrayLike<number>;
}

const socketMeshCache = new LRUCache<CachedSocketMesh>('socket-mesh', 16);

/**
 * Compose the full mesh-cache key from the socket's geometry key (built in the
 * shell stage) and the tessellation parameters that change its triangle output.
 * `buildTime` distinguishes the analytic edge extractor from the crease-edge
 * fallback so a kernel switch can't serve edges from the wrong extractor.
 */
export function socketMeshKey(
  geometryKey: string,
  tolerance: number,
  angularTolerance: number,
  buildTime: boolean
): string {
  return `${geometryKey}|${tolerance}:${angularTolerance}|${buildTime ? 'b' : 'e'}`;
}

export function getSocketMesh(key: string): CachedSocketMesh | null {
  return socketMeshCache.get(key) ?? null;
}

export function setSocketMesh(key: string, value: CachedSocketMesh): void {
  socketMeshCache.set(key, value);
}

export function getSocketMeshCacheStats(): CacheStats {
  return socketMeshCache.getStats();
}

export function clearSocketMeshCache(): void {
  socketMeshCache.dispose();
  // Reset hit/miss/eviction counters too, so perf diagnostics read after a
  // kernel switch (clearAllCaches) don't carry stale cross-kernel totals.
  socketMeshCache.resetStats();
}
