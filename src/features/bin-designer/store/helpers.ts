/**
 * Shared helpers for the bin designer store slices.
 *
 * These utilities are used across multiple slices to avoid code duplication:
 * - pushHistoryEntry: push current params (with pending mesh) to history
 * - dissolveSingletonGroups: auto-dissolve groups with only one member
 * - restoreHistoryEntry: restore params + optional cached mesh from a history entry
 */

import { current, type Draft } from 'immer';
import type { DesignerState, HistoryEntry, CachedMesh, Cutout } from '../types';
import { DESIGNER_CONSTRAINTS } from '../constants';
import { evictIfNeeded } from './meshCacheManager';

/**
 * Module-level pending mesh cache: stores the mesh generated for the current
 * params, to be attached to the next history entry when params change.
 */
let pendingMeshCache: CachedMesh | null = null;

/** Get the current pending mesh cache. */
export function getPendingMeshCache(): CachedMesh | null {
  return pendingMeshCache;
}

/** Set the pending mesh cache. */
export function setPendingMeshCache(mesh: CachedMesh | null): void {
  pendingMeshCache = mesh;
}

/**
 * Push current params (with pending mesh) to history past array.
 * Skips if inside a transaction (already pushed on transaction start).
 * Evicts old caches if memory budget exceeded.
 */
export function pushHistoryEntry(state: Draft<DesignerState>): void {
  // Inside a transaction, the entry was already pushed at startTransaction
  if (state.transactionDepth > 0) return;

  const entry: HistoryEntry = {
    params: current(state.params),
    mesh: pendingMeshCache,
  };

  // Snapshot past as plain objects to avoid leaking draft proxies into
  // the new array — Immer proxies from the old draft array would be revoked
  // during finalization, causing "Cannot perform 'get' on a proxy that has
  // been revoked" errors in evictIfNeeded.
  const pastSnapshot = current(state.history).past;
  const newPast: HistoryEntry[] = [
    ...pastSnapshot.slice(-(DESIGNER_CONSTRAINTS.MAX_HISTORY - 1)),
    entry,
  ];

  // Evict old meshes if over memory budget (all entries are plain objects)
  const evicted = evictIfNeeded(newPast, []);
  state.history.past = evicted.past as HistoryEntry[];
  state.history.future = evicted.future as HistoryEntry[];
  state.generation.epoch += 1;

  // Clear cached mesh for the previous params; new params need a fresh result
  pendingMeshCache = null;
}

/**
 * Auto-dissolve groups that have only one remaining member.
 *
 * After removing cutouts, some groups may be left with a single cutout.
 * These singletons are dissolved by setting their groupId to null.
 */
export function dissolveSingletonGroups(cutouts: Cutout[]): Cutout[] {
  const groupCounts = new Map<string, number>();
  for (const c of cutouts) {
    if (c.groupId) {
      groupCounts.set(c.groupId, (groupCounts.get(c.groupId) ?? 0) + 1);
    }
  }
  return cutouts.map((c) =>
    c.groupId && (groupCounts.get(c.groupId) ?? 0) <= 1 ? { ...c, groupId: null } : c
  );
}

/**
 * Restore a history entry's params and optional cached mesh into state.
 *
 * When the entry has a cached mesh, the mesh is restored directly and no
 * regeneration is triggered (epoch unchanged). When there is no cache,
 * the epoch is incremented to trigger regeneration.
 */
export function restoreHistoryEntry(state: Draft<DesignerState>, entry: HistoryEntry): void {
  state.params = entry.params;

  if (entry.mesh) {
    // Cache hit: restore mesh directly, no regeneration needed
    state.generation.mesh = {
      vertices: entry.mesh.vertices,
      normals: entry.mesh.normals,
      indices: entry.mesh.indices,
      edgeVertices: entry.mesh.edgeVertices,
      error: null,
      timingMs: 0,
    };
    state.generation.status = 'complete';
    pendingMeshCache = entry.mesh;
    // epoch unchanged -- no regeneration needed
  } else {
    // No cache: increment epoch to trigger regeneration
    state.generation.epoch += 1;
    pendingMeshCache = null;
  }
}

/**
 * Reset the pending mesh cache (used in tests).
 * @internal
 */
export function _resetPendingMeshCache(): void {
  pendingMeshCache = null;
}
