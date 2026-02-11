/**
 * Manages mesh cache memory in undo/redo history.
 *
 * Tracks total cached mesh bytes and evicts oldest entries
 * when memory usage exceeds the budget (100MB).
 */

import type { HistoryEntry, CachedMesh } from '../types';

/** Maximum total bytes for cached meshes across all history entries */
const MAX_CACHE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Calculate the byte size of a cached mesh (vertices + normals + indices + edgeVertices).
 */
export function meshByteSize(
  vertices: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  edgeVertices: Float32Array
): number {
  return vertices.byteLength + normals.byteLength + indices.byteLength + edgeVertices.byteLength;
}

/**
 * Create a CachedMesh from generation result data.
 */
export function createCachedMesh(
  vertices: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  edgeVertices: Float32Array,
  triangleCount: number
): CachedMesh {
  return {
    vertices,
    normals,
    indices,
    edgeVertices,
    triangleCount,
    byteSize: meshByteSize(vertices, normals, indices, edgeVertices),
  };
}

/**
 * Evict oldest mesh caches from history when total exceeds budget.
 *
 * This function is pure: it does not mutate the provided arrays. It returns
 * new arrays with `mesh` set to null on the oldest entries first (from the
 * beginning of past, then from the end of future) until the budget is met.
 *
 * @returns New arrays with evicted entries (mesh set to null)
 */
export function evictIfNeeded(
  past: readonly HistoryEntry[],
  future: readonly HistoryEntry[]
): { past: readonly HistoryEntry[]; future: readonly HistoryEntry[] } {
  let totalBytes = 0;

  // Count total cached bytes
  for (const entry of past) {
    if (entry.mesh) totalBytes += entry.mesh.byteSize;
  }
  for (const entry of future) {
    if (entry.mesh) totalBytes += entry.mesh.byteSize;
  }

  if (totalBytes <= MAX_CACHE_BYTES) {
    return { past, future };
  }

  // Evict from oldest past entries first
  const newPast = [...past];
  for (let i = 0; i < newPast.length && totalBytes > MAX_CACHE_BYTES; i++) {
    const entry = newPast[i];
    if (entry.mesh) {
      totalBytes -= entry.mesh.byteSize;
      newPast[i] = { params: entry.params, mesh: null };
    }
  }

  // If still over budget, evict from oldest future entries (end of array)
  const newFuture = [...future];
  for (let i = newFuture.length - 1; i >= 0 && totalBytes > MAX_CACHE_BYTES; i--) {
    const entry = newFuture[i];
    if (entry.mesh) {
      totalBytes -= entry.mesh.byteSize;
      newFuture[i] = { params: entry.params, mesh: null };
    }
  }

  return { past: newPast, future: newFuture };
}
