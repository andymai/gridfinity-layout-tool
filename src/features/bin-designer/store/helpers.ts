/**
 * Shared helpers for the bin designer store slices.
 *
 * These utilities are used across multiple slices to avoid code duplication:
 * - pushHistoryEntry: push current params (with pending mesh) to history
 * - dissolveSingletonGroups: auto-dissolve groups with only one member
 * - restoreHistoryEntry: restore params + optional cached mesh from a history entry
 */

import { current, type Draft } from 'immer';
import { isSocketlessBase } from '@/features/bin-designer/types/base';
import type {
  BinParams,
  CachedMesh,
  Cutout,
  CutoutArrayConfig,
  DesignerState,
  HistoryEntry,
} from '../types';
import { groupArrayConfig } from '@/shared/utils/cutoutArray';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '../constants';
import { loadDefaultParams } from '../storage/defaultParamsStorage';
import { evictIfNeeded } from './meshCacheManager';
import { isFractional } from '@/core/constants';
import { heldCutoutFillMm, reanchorCutoutFill } from '@/features/bin-designer/utils/cutoutFill';
import { hasHalfBinDetail, isPartialMask } from '@/shared/utils/cellMask';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { trackToolActivated } from '@/shared/analytics/posthog/conversionEvents';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';

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
 *    by a mode toggle elsewhere. The check reads the
 *    *resolved* base style so a custom flat-floor default is also honored.
 *
 * Called from `newDesign` and `resetToDefaults` so both fresh-start paths
 * pick up the user default + coupling without re-implementing it.
 */
export function defaultsForNewDesign(): BinParams {
  const base = loadDefaultParams() ?? DEFAULT_BIN_PARAMS;
  const halfGridOn = useHalfGridModeStore.getState().halfGridMode;
  if (!halfGridOn || isSocketlessBase(base.base.style)) {
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
 * Hold a floor-anchored cutout fill at its height across a param change (#3697).
 *
 * Two calls, around the mutation: {@link heldCutoutFillMm} first, then this.
 * Every action that can move the wall height has to bracket itself this way,
 * which is `setParam`, `setParams` and `updateBase`. The wall height is a
 * function of the height, the height unit and the base style at once, so
 * watching a field list would miss whichever one was added next.
 */
export function applyCutoutFillAnchor(state: Draft<DesignerState>, heldMm: number | null): void {
  const topOffset = reanchorCutoutFill(state.params, heldMm);
  if (topOffset === undefined) return;
  state.params.cutoutConfig = { ...state.params.cutoutConfig, topOffset };
}

/** Fill height to carry across a param change; null when nothing is anchored. */
export function captureCutoutFill(state: Draft<DesignerState>): number | null {
  return heldCutoutFillMm(state.params);
}

/**
 * Write the Workshop selection with its invariant intact: the anchor is a
 * member of the id list (callers pass a preferred anchor; a non-member or
 * null falls back to the last id). Every selection write in the store goes
 * through here so the two fields can never disagree.
 */
export function setAssemblySelection(
  state: Draft<DesignerState>,
  ids: readonly string[],
  anchor: string | null = null
): void {
  const unique = [...new Set(ids)];
  state.ui.selectedAssemblyPartIds = unique;
  state.ui.selectedAssemblyPartId =
    anchor !== null && unique.includes(anchor) ? anchor : (unique[unique.length - 1] ?? null);
}

/** Drop selected ids that no longer resolve in the tree (undo, load, remove). */
export function pruneAssemblySelection(state: Draft<DesignerState>): void {
  const ids = state.ui.selectedAssemblyPartIds;
  if (ids.length === 0) return;
  const structure = state.structure;
  const surviving =
    structure?.kind === 'assembly' ? ids.filter((id) => findAssemblyPart(structure.parts, id)) : [];
  if (surviving.length !== ids.length) {
    setAssemblySelection(state, surviving, state.ui.selectedAssemblyPartId);
  }
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
    ...(state.itemKind !== 'bin'
      ? {
          itemKind: state.itemKind,
          structure: state.structure ? current(state.structure) : null,
          envelope: state.envelope ? current(state.envelope) : null,
        }
      : {}),
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
  trackToolActivated('designer', 'param_edit');
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
/**
 * Set or remove a cutout's repeat. An absent config DELETES the key rather than
 * storing `undefined`, so a design that never carried a repeat serializes
 * exactly as it did before the field existed and its fingerprint holds.
 */
export function withCutoutArray(cutout: Cutout, config: CutoutArrayConfig | undefined): Cutout {
  if (config === undefined) {
    const { array: _drop, ...rest } = cutout;
    return rest;
  }
  return { ...cutout, array: config };
}

/**
 * The repeat a newly formed group adopts, or undefined for none.
 *
 * Taken from the group's own members first and then from whatever is being
 * added, the same precedence the cavity color uses, so extending a repeating
 * group with a loose shape does not swap the group's pattern for the newcomer's.
 * This is also what makes "repeat first, then group" land in the same state as
 * "group first, then repeat".
 */
export function adoptedGroupArray(
  cutouts: readonly Cutout[],
  idsToGroup: ReadonlySet<string>,
  existingGroupId: string | null
): CutoutArrayConfig | undefined {
  const source =
    (existingGroupId === null
      ? undefined
      : cutouts.find((c) => c.groupId === existingGroupId && c.array !== undefined)) ??
    cutouts.find((c) => idsToGroup.has(c.id) && c.array !== undefined);
  return source?.array ? groupArrayConfig(source.array) : undefined;
}

/**
 * Which cutouts a repeat write lands on, and the config they take.
 *
 * A group repeats as ONE unit, so the config goes to every member: they
 * describe a single cavity, and two members repeating differently would
 * describe a pattern the boolean cannot be built from. Null when the write
 * cannot apply at all, which today means a group holding a path (the worker
 * rebuilds a path from its master and cannot place its vertices per copy).
 */
export function planCutoutArrayWrite(
  cutouts: readonly Cutout[],
  cutoutId: string,
  config: CutoutArrayConfig | undefined
): { readonly ids: ReadonlySet<string>; readonly config: CutoutArrayConfig | undefined } | null {
  const target = cutouts.find((c) => c.id === cutoutId);
  if (!target) return null;
  const members =
    target.groupId === null ? [target] : cutouts.filter((c) => c.groupId === target.groupId);
  if (members.some((m) => m.shape === 'path')) return null;
  return {
    ids: new Set(members.map((m) => m.id)),
    config: target.groupId === null || !config ? config : groupArrayConfig(config),
  };
}

export function restoreHistoryEntry(state: Draft<DesignerState>, entry: HistoryEntry): void {
  state.params = entry.params;
  if (entry.itemKind !== undefined) {
    state.itemKind = entry.itemKind;
    state.structure = entry.structure ?? null;
    state.envelope = entry.envelope ?? null;
    pruneAssemblySelection(state);
  }
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
