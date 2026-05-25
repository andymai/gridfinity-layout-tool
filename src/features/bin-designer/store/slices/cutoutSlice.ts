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
  CutoutToggleProperties,
  ReorderDirection,
  PathPoint,
  GroupOp,
} from '../../types';
import { DEFAULT_GROUP_OP } from '../../types';
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

  // CRUD actions

  return {
    // Core consolidated actions
    setCutoutProperty,
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

    removeCutout: (id: string) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.filter((c) => c.id !== id);
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
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
        state.params.cutouts = state.params.cutouts.map((c) =>
          idsToGroup.has(c.id) ? { ...c, groupId, groupOp } : c
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
      });
    },
  };
}
