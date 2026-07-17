/**
 * Cutout slice: cutout CRUD, batch operations, property toggling, z-ordering.
 *
 * Consolidates lock/unlock/hide/show into a single `setCutoutProperty` action,
 * and bringForward/sendBackward/bringToFront/sendToBack into `reorderCutouts`.
 * Legacy action names are kept as thin convenience wrappers.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  Cutout,
  CutoutColorScope,
  CutoutToggleProperties,
  ReorderDirection,
  PathPoint,
  GroupOp,
} from '../../types';
import { DEFAULT_GROUP_OP, DEFAULT_CUTOUT_COLOR_SCOPE } from '../../types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { MAX_MESH_ASSETS_PER_DESIGN } from '@/shared/generation/meshAsset';
import { pushHistoryEntry, dissolveSingletonGroups } from '../helpers';
import { generateLayoutId } from '@/shared/utils/uuid';
import { scalePathPoints, translatePathPoints } from '../../utils/pathTransforms';

// Points are absolute, handles are relative — scale around the old origin
// first so the bounds end up flush with the new x/y, then translate.
function applyPathTransform(c: Cutout, updates: Partial<Cutout>): PathPoint[] | undefined {
  if (!c.path || c.path.length === 0 || updates.path) return undefined;
  const newX = updates.x ?? c.x;
  const newY = updates.y ?? c.y;
  const newW = updates.width ?? c.width;
  const newD = updates.depth ?? c.depth;
  const scaleX = c.width !== 0 ? newW / c.width : 1;
  const scaleY = c.depth !== 0 ? newD / c.depth : 1;
  const scaled = scaleX !== 1 || scaleY !== 1;
  const dx = newX - c.x;
  const dy = newY - c.y;
  const translated = dx !== 0 || dy !== 0;
  if (!scaled && !translated) return undefined;
  const scaledPoints = scaled ? scalePathPoints(c.path, scaleX, scaleY, c.x, c.y) : c.path;
  return translated ? translatePathPoints(scaledPoints, dx, dy) : [...scaledPoints];
}

// Expand a target id set to include every member of any group those ids touch,
// so a per-group property (color) is written to the whole group at once.
function expandIdsToGroups(
  cutouts: readonly Cutout[],
  ids: readonly string[]
): ReadonlySet<string> {
  const idSet = new Set(ids);
  const groupIds = new Set<string>();
  for (const c of cutouts) {
    if (idSet.has(c.id) && c.groupId !== null) groupIds.add(c.groupId);
  }
  if (groupIds.size > 0) {
    for (const c of cutouts) {
      if (c.groupId !== null && groupIds.has(c.groupId)) idSet.add(c.id);
    }
  }
  return idSet;
}

/**
 * Drop mesh assets no cutout references anymore. Runs after every deletion
 * path so a deleted mesh cutout doesn't strand its (100KB+) asset in the
 * design; undo restores both together because history snapshots full params.
 */
function gcMeshAssets(state: Draft<DesignerState>): void {
  const assets = state.params.meshAssets;
  if (!assets) return;
  const referenced = new Set(
    state.params.cutouts.map((c) => c.meshId).filter((id): id is string => id !== undefined)
  );
  const kept = Object.entries(assets).filter(([id]) => referenced.has(id));
  if (kept.length === Object.keys(assets).length) return;
  state.params.meshAssets = kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

type Set = (fn: (state: Draft<DesignerState>) => void) => void;

export function createCutoutSlice(set: Set) {
  // Core actions

  // locked/hidden/zIndex are editor-only state — the worker reads neither
  // (see cutoutBuilder.ts), so these mutations get history but skip the
  // generation epoch.
  const setCutoutProperty = (ids: readonly string[], partial: CutoutToggleProperties): void => {
    if (ids.length === 0) return;
    set((state) => {
      pushHistoryEntry(state, { affectsGeometry: false });
      const idSet = new Set(ids);
      state.params.cutouts = state.params.cutouts.map((c) =>
        idSet.has(c.id) ? { ...c, ...partial } : c
      );
    });
  };

  const reorderCutouts = (ids: readonly string[], direction: ReorderDirection): void => {
    if (ids.length === 0) return;
    set((state) => {
      pushHistoryEntry(state, { affectsGeometry: false });
      const idSet = new Set(ids);

      switch (direction) {
        case 'forward': {
          const maxZ = Math.max(0, ...state.params.cutouts.map((c) => c.zIndex ?? 0));
          state.params.cutouts = state.params.cutouts.map((c) =>
            idSet.has(c.id) ? { ...c, zIndex: Math.min((c.zIndex ?? 0) + 1, maxZ + 1) } : c
          );
          break;
        }
        case 'backward': {
          state.params.cutouts = state.params.cutouts.map((c) =>
            idSet.has(c.id) ? { ...c, zIndex: Math.max((c.zIndex ?? 0) - 1, 0) } : c
          );
          break;
        }
        case 'front': {
          const maxZ = Math.max(0, ...state.params.cutouts.map((c) => c.zIndex ?? 0));
          state.params.cutouts = state.params.cutouts.map((c) =>
            idSet.has(c.id) ? { ...c, zIndex: maxZ + 1 } : c
          );
          break;
        }
        case 'back': {
          state.params.cutouts = state.params.cutouts.map((c) =>
            idSet.has(c.id) ? { ...c, zIndex: 0 } : c
          );
          break;
        }
      }
    });
  };

  const showAllCutouts = (): void => {
    set((state) => {
      const hasHidden = state.params.cutouts.some((c) => c.hidden);
      if (!hasHidden) return;
      pushHistoryEntry(state, { affectsGeometry: false });
      state.params.cutouts = state.params.cutouts.map((c) =>
        c.hidden ? { ...c, hidden: false } : c
      );
    });
  };

  // Color is a per-group property — writing it to one member writes it to the
  // whole group (like groupOp). Setting `color: null` clears it back to the body
  // color. Purely cosmetic: the worker bakes per-cutout face tags regardless of
  // color, so recoloring never regenerates geometry (`affectsGeometry: false`).
  const setCutoutColor = (
    ids: readonly string[],
    patch: { color?: string | null; colorScope?: CutoutColorScope }
  ): void => {
    if (ids.length === 0) return;
    set((state) => {
      const affected = expandIdsToGroups(state.params.cutouts, ids);
      const clearing = patch.color === null;

      const applyColor = (c: Cutout): Cutout => {
        if (clearing) {
          if (c.color === undefined && c.colorScope === undefined) return c;
          const { color: _color, colorScope: _scope, ...rest } = c;
          return rest;
        }
        const nextColor = patch.color ?? c.color;
        // Scope-only edit on an uncolored cutout paints nothing — ignore it.
        if (nextColor === undefined) return c;
        const nextScope = patch.colorScope ?? c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE;
        if (c.color === nextColor && c.colorScope === nextScope) return c;
        return { ...c, color: nextColor, colorScope: nextScope };
      };

      const nextCutouts = state.params.cutouts.map((c) => (affected.has(c.id) ? applyColor(c) : c));
      const changed = nextCutouts.some((c, i) => c !== state.params.cutouts[i]);

      // Applying a color implies the user wants multi-color output; auto-enable
      // so the swatch shows instead of silently no-op'ing until they find the
      // Multi-Color panel toggle. Worth committing even if values were unchanged.
      const shouldEnable = typeof patch.color === 'string' && !state.params.featureColors.enabled;
      if (!changed && !shouldEnable) return;

      pushHistoryEntry(state, { affectsGeometry: false });
      state.params.cutouts = nextCutouts;
      if (shouldEnable) {
        state.params.featureColors = { ...state.params.featureColors, enabled: true };
      }
    });
  };

  // CRUD actions

  return {
    // Core consolidated actions
    setCutoutProperty,
    setCutoutColor,
    reorderCutouts,
    showAllCutouts,

    // Convenience wrappers for backward compatibility
    lockCutouts: (ids: readonly string[]) => setCutoutProperty(ids, { locked: true }),
    unlockCutouts: (ids: readonly string[]) => setCutoutProperty(ids, { locked: false }),
    hideCutouts: (ids: readonly string[]) => setCutoutProperty(ids, { hidden: true }),
    showCutouts: (ids: readonly string[]) => setCutoutProperty(ids, { hidden: false }),
    bringForward: (ids: readonly string[]) => reorderCutouts(ids, 'forward'),
    sendBackward: (ids: readonly string[]) => reorderCutouts(ids, 'backward'),
    bringToFront: (ids: readonly string[]) => reorderCutouts(ids, 'front'),
    sendToBack: (ids: readonly string[]) => reorderCutouts(ids, 'back'),

    // CRUD
    addCutout: (cutout: Cutout) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = [...state.params.cutouts, cutout];
      });
    },

    /**
     * Add a mesh imprint cutout together with its stored asset (one history
     * entry, so undo removes both). No-ops when the design is already at the
     * asset cap — callers surface that limit before invoking.
     */
    addMeshCutout: (cutout: Cutout, asset: MeshAsset) => {
      const meshId = cutout.meshId;
      if (cutout.shape !== 'mesh' || meshId === undefined) return;
      set((state) => {
        const existing = state.params.meshAssets ?? {};
        if (!(meshId in existing) && Object.keys(existing).length >= MAX_MESH_ASSETS_PER_DESIGN) {
          return;
        }
        pushHistoryEntry(state);
        state.params.meshAssets = { ...existing, [meshId]: asset };
        state.params.cutouts = [...state.params.cutouts, cutout];
      });
    },

    removeCutout: (id: string) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.filter((c) => c.id !== id);
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
        gcMeshAssets(state);
      });
    },

    updateCutout: (id: string, updates: Partial<Cutout>) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) => {
          if (c.id !== id) return c;
          const transformedPath = applyPathTransform(c, updates);
          return transformedPath
            ? { ...c, ...updates, path: transformedPath }
            : { ...c, ...updates };
        });
      });
    },

    clearCutouts: () => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = [];
        gcMeshAssets(state);
      });
    },

    duplicateCutouts: (cutoutIds: readonly string[]) => {
      if (cutoutIds.length === 0) return;
      set((state) => {
        pushHistoryEntry(state);
        const toDuplicate = state.params.cutouts.filter((c) => cutoutIds.includes(c.id));
        // Map old groupId -> new groupId so groups are preserved
        const groupMap = new Map<string, string>();
        const duplicated = toDuplicate.map((c) => {
          let newGroupId: string | null = null;
          if (c.groupId) {
            if (!groupMap.has(c.groupId)) {
              groupMap.set(c.groupId, generateLayoutId());
            }
            newGroupId = groupMap.get(c.groupId) ?? null;
          }
          // Path points are absolute, so shifting x/y must shift them too —
          // otherwise duplicates render with the original path geometry.
          const translatedPath = c.path ? translatePathPoints(c.path, 5, 5) : c.path;
          return {
            ...c,
            id: generateLayoutId(),
            x: c.x + 5,
            y: c.y + 5,
            groupId: newGroupId,
            ...(translatedPath ? { path: translatedPath } : {}),
          };
        });
        state.params.cutouts = [...state.params.cutouts, ...duplicated];
      });
    },

    groupCutouts: (cutoutIds: readonly string[], op?: GroupOp) => {
      if (cutoutIds.length < 2) return;
      set((state) => {
        pushHistoryEntry(state);
        // Reuse an existing groupId if any selected cutout already belongs to a group
        const existingMember = state.params.cutouts.find(
          (c) => cutoutIds.includes(c.id) && c.groupId !== null
        );
        const existingGroupId = existingMember?.groupId ?? null;
        const groupId = existingGroupId ?? generateLayoutId();
        // When extending an existing group and the caller didn't override the op,
        // inherit the group's current op so silent regroups keep their semantics.
        const groupOp: GroupOp = op ?? existingMember?.groupOp ?? DEFAULT_GROUP_OP;
        const idsToGroup = new Set(cutoutIds);
        if (existingGroupId) {
          for (const c of state.params.cutouts) {
            if (c.groupId === existingGroupId) idsToGroup.add(c.id);
          }
        }
        // One color per group: adopt the group's existing color, else the first
        // colored member, so a freshly grouped set can't hold mixed backings.
        const colorSource =
          (existingGroupId
            ? state.params.cutouts.find(
                (c) => c.groupId === existingGroupId && c.color !== undefined
              )
            : undefined) ??
          state.params.cutouts.find((c) => idsToGroup.has(c.id) && c.color !== undefined);
        const colorPatch: Pick<Cutout, 'color' | 'colorScope'> | undefined = colorSource
          ? {
              color: colorSource.color,
              colorScope: colorSource.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE,
            }
          : undefined;
        state.params.cutouts = state.params.cutouts.map((c) =>
          idsToGroup.has(c.id) ? { ...c, groupId, groupOp, ...colorPatch } : c
        );
      });
    },

    ungroupCutouts: (cutoutIds: readonly string[]) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) => {
          if (!cutoutIds.includes(c.id)) return c;
          const { groupOp: _omit, ...rest } = c;
          return { ...rest, groupId: null };
        });
        // A group can be left with a single member after a partial ungroup;
        // dissolve that singleton so the Pathfinder UI doesn't pretend a lone
        // cutout still belongs to an active group.
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
      });
    },

    setGroupOp: (groupId: string, op: GroupOp) => {
      set((state) => {
        const hasMatchingGroup = state.params.cutouts.some(
          (c) => c.groupId === groupId && (c.groupOp ?? DEFAULT_GROUP_OP) !== op
        );
        if (!hasMatchingGroup) return;
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) =>
          c.groupId === groupId ? { ...c, groupOp: op } : c
        );
      });
    },

    // Batch operations
    updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => {
      if (updates.size === 0) return;
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) => {
          const u = updates.get(c.id);
          if (!u) return c;
          const transformedPath = applyPathTransform(c, u);
          return transformedPath ? { ...c, ...u, path: transformedPath } : { ...c, ...u };
        });
      });
    },

    removeCutoutsBatch: (ids: readonly string[]) => {
      if (ids.length === 0) return;
      set((state) => {
        pushHistoryEntry(state);
        const idSet = new Set(ids);
        state.params.cutouts = state.params.cutouts.filter((c) => !idSet.has(c.id));
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
        gcMeshAssets(state);
      });
    },
  };
}
