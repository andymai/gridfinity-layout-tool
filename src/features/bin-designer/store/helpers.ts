/**
 * Shared helpers for the bin designer store slices.
 *
 * These utilities are used across multiple slices to avoid code duplication:
 * - pushHistoryEntry: push current params (with pending mesh) to history
 * - dissolveSingletonGroups: auto-dissolve groups with only one member
 * - restoreHistoryEntry: restore params + optional cached mesh from a history entry
 */

import { current, type Draft } from 'immer';
import type { BinParams, DesignerState, HistoryEntry, CachedMesh, Cutout } from '../types';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '../constants';
import { loadDefaultParams } from '../storage/defaultParamsStorage';
import { evictIfNeeded } from './meshCacheManager';
import { isFractional } from '@/core/constants';
import { hasHalfBinDetail, isPartialMask } from '@/shared/utils/cellMask';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';

/**
 * Resolve the parameters a fresh bin starts from.
 *
 * Layered, in order of precedence:
 * 1. The user's saved "default for new bins" (style-only) if present,
 *    otherwise the hardcoded factory `DEFAULT_BIN_PARAMS`.
 * 2. `base.halfSockets = true` when the layout-level half-grid mode is
 *    active. Skipped for flat-floor bins — the `halfSockets ⇔ flat-floor`
 *    mutual-exclusion constraint takes precedence, and a user who switched
 *    to a flat floor made an explicit choice that shouldn't be overridden
 *    by a mode toggle elsewhere (issue #1752). The check reads the
 *    *resolved* base style so a custom flat-floor default is also honored.
 *
 * Called from `newDesign` and `resetToDefaults` so both fresh-start paths
 * pick up the user default + coupling without re-implementing it.
 */
export function defaultsForNewDesign(): BinParams {
  const base = loadDefaultParams() ?? DEFAULT_BIN_PARAMS;
  const halfGridOn = useHalfGridModeStore.getState().halfGridMode;
  if (!halfGridOn || base.base.style === 'flat') {
    return base;
  }
  return {
    ...base,
    base: { ...base.base, halfSockets: true },
  };
}

/**
 * Module-level pending mesh cache: stores the mesh generated for the current
 * params, to be attached to the next history entry when params change.
 */
let pendingMeshCache: CachedMesh | null = null;

/**
 * Shared with `persistenceSlice.loadDesign`: `halfGridMode` must be on
 * whenever the params require 0.5u granularity (fractional dimensions or
 * a cellMask with mixed-detail 1u blocks). Kept here so both load paths
 * and history restore pick up the same rule.
 */
export function paramsNeedHalfGridMode(params: BinParams): boolean {
  if (isFractional(params.width) || isFractional(params.depth)) return true;
  if (isPartialMask(params.cellMask) && hasHalfBinDetail(params.cellMask)) return true;
  return false;
}

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
 *
 * Pass `{ affectsGeometry: false }` for cosmetic mutations (lock, hide,
 * z-reorder, etc.) — the entry is still captured for undo, but the
 * generation epoch isn't bumped, so the worker doesn't re-run on every
 * lock/hide click.
 */
export function pushHistoryEntry(
  state: Draft<DesignerState>,
  options: { affectsGeometry?: boolean } = {}
): void {
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
  if (options.affectsGeometry ?? true) {
    state.generation.epoch += 1;
    // Clear cached mesh for the previous params; new params need a fresh result
    pendingMeshCache = null;
  }
}

/**
 * Auto-dissolve groups that have only one remaining member.
 *
 * After removing or ungrouping cutouts, some groups may be left with a
 * single cutout. These singletons are dissolved by clearing both `groupId`
 * and `groupOp` so the invariant "`groupOp` set ⇒ `groupId` set" holds and
 * the Pathfinder UI doesn't treat a lone cutout as an active group.
 */
export function dissolveSingletonGroups(cutouts: Cutout[]): Cutout[] {
  const groupCounts = new Map<string, number>();
  for (const c of cutouts) {
    if (c.groupId) {
      groupCounts.set(c.groupId, (groupCounts.get(c.groupId) ?? 0) + 1);
    }
  }
  return cutouts.map((c) => {
    if (!c.groupId || (groupCounts.get(c.groupId) ?? 0) > 1) return c;
    const { groupOp: _omit, ...rest } = c;
    return { ...rest, groupId: null };
  });
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
  // Keep UI toggles consistent with the restored params. Without this,
  // undoing across a custom-shape paint leaves `shapeEditorOpen` stuck on
  // after the mask is gone, and undoing across a dimension change can
  // leave `halfGridMode` out of sync with the new dimensions. Mirrors the
  // normalisation in `loadDesign`.
  state.ui.halfGridMode = paramsNeedHalfGridMode(entry.params);
  state.ui.shapeEditorOpen = isPartialMask(entry.params.cellMask);

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
