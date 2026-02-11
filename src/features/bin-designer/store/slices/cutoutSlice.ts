/**
 * Cutout slice: cutout CRUD, batch operations, property toggling, z-ordering.
 *
 * Consolidates lock/unlock/hide/show into a single `setCutoutProperty` action,
 * and bringForward/sendBackward/bringToFront/sendToBack into `reorderCutouts`.
 * Legacy action names are kept as thin convenience wrappers.
 */

import type { Draft } from 'immer';
import type { DesignerState, Cutout, CutoutToggleProperties, ReorderDirection } from '../../types';
import { pushHistoryEntry, dissolveSingletonGroups } from '../helpers';
import { generateUUID } from '@/shared/utils/uuid';

type Set = (fn: (state: Draft<DesignerState>) => void) => void;

export function createCutoutSlice(set: Set) {
  // -------------------------------------------------------------------
  // Core actions
  // -------------------------------------------------------------------

  const setCutoutProperty = (ids: readonly string[], partial: CutoutToggleProperties): void => {
    if (ids.length === 0) return;
    set((state) => {
      pushHistoryEntry(state);
      const idSet = new Set(ids);
      state.params.cutouts = state.params.cutouts.map((c) =>
        idSet.has(c.id) ? { ...c, ...partial } : c
      );
    });
  };

  const reorderCutouts = (ids: readonly string[], direction: ReorderDirection): void => {
    if (ids.length === 0) return;
    set((state) => {
      pushHistoryEntry(state);
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
      pushHistoryEntry(state);
      state.params.cutouts = state.params.cutouts.map((c) =>
        c.hidden ? { ...c, hidden: false } : c
      );
    });
  };

  // -------------------------------------------------------------------
  // CRUD actions
  // -------------------------------------------------------------------

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
        state.params.cutouts = state.params.cutouts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
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
              groupMap.set(c.groupId, generateUUID());
            }
            newGroupId = groupMap.get(c.groupId) ?? null;
          }
          return {
            ...c,
            id: generateUUID(),
            x: c.x + 5,
            y: c.y + 5,
            groupId: newGroupId,
          };
        });
        state.params.cutouts = [...state.params.cutouts, ...duplicated];
      });
    },

    groupCutouts: (cutoutIds: readonly string[]) => {
      if (cutoutIds.length < 2) return;
      set((state) => {
        pushHistoryEntry(state);
        // Reuse an existing groupId if any selected cutout already belongs to a group
        const existingGroupId = state.params.cutouts.find(
          (c) => cutoutIds.includes(c.id) && c.groupId !== null
        )?.groupId;
        const groupId = existingGroupId ?? generateUUID();
        // Include all existing members of the reused group
        const idsToGroup = new Set(cutoutIds);
        if (existingGroupId) {
          for (const c of state.params.cutouts) {
            if (c.groupId === existingGroupId) idsToGroup.add(c.id);
          }
        }
        state.params.cutouts = state.params.cutouts.map((c) =>
          idsToGroup.has(c.id) ? { ...c, groupId } : c
        );
      });
    },

    ungroupCutouts: (cutoutIds: readonly string[]) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) =>
          cutoutIds.includes(c.id) ? { ...c, groupId: null } : c
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
          return u ? { ...c, ...u } : c;
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
