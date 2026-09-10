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
  CutoutArrayConfig,
  CutoutColorScope,
  CutoutToggleProperties,
  ReorderDirection,
  GroupOp,
} from '../../types';
import { DEFAULT_GROUP_OP, DEFAULT_CUTOUT_COLOR_SCOPE } from '../../types';
import { canArray } from '@/shared/utils/cutoutArray';
import { withTextFootprint } from '@/shared/utils/cutoutLabel';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { MAX_MESH_ASSETS_PER_DESIGN } from '@/shared/generation/meshAsset';
import {
  adoptedGroupArray,
  dissolveSingletonGroups,
  planCutoutArrayWrite,
  pushHistoryEntry,
  withCutoutArray,
} from '../helpers';
import { generateLayoutId } from '@/shared/utils/uuid';
import { translatePathPoints } from '../../utils/pathTransforms';
import {
  groupChain,
  parentGroups,
  remapGroupChain,
  sameChain,
  withGroupChain,
} from '../../utils/cutoutHierarchy';
import {
  cutoutList,
  cutoutOwner,
  applyPathTransform,
  expandIdsToGroups,
  gcMeshAssets,
  gcCutoutGroupNames,
  remainingCapacity,
  togglePropertyAffectsGeometry,
  zOrderAffectsGeometry,
  withTopZIndex,
  nextTopZIndexIn,
} from './cutoutSliceHelpers';
import type { Set } from './cutoutSliceHelpers';
import { createCutoutGroupActions } from './cutoutGroupActions';
export { remainingCutoutCapacity } from './cutoutSliceHelpers';

export function createCutoutSlice(rawSet: Set) {
  /**
   * Every producer in this slice, wrapped so an emptied lid array collapses back
   * to absent.
   *
   * `LidConfig.cutouts` is absent rather than `[]` when there are none, because
   * `communityParamsFingerprint` hashes the whole params object and keys the
   * moderation tombstone — an always-present field re-hashes every design already
   * published. Removing the last shape, clearing, or a batch delete would each
   * leave `[]`, and so would `cutoutOwner` materializing the array for a producer
   * that then bailed out.
   *
   * Enforced here rather than at the ~40 assignment sites for the same reason
   * `lipHasSupport` is derived once: an action added later cannot reintroduce the
   * empty array by forgetting about it.
   */
  const set: Set = (fn) =>
    rawSet((state) => {
      fn(state);
      const lid = state.params.lid;
      if (lid.cutouts !== undefined && lid.cutouts.length === 0) {
        delete lid.cutouts;
      }
    });

  // Core actions

  /**
   * `locked` is editor-only, but `hidden` is NOT: the worker skips
   * hidden cutouts (`cutoutBuilder.ts`), so toggling it changes the generated
   * part and has to bump the generation epoch. Suppressing that regeneration
   * left the preview showing a pocket the export would not cut — a silent
   * preview-vs-export divergence.
   *
   * `zIndex` only reorders boolean ops within a group, so it regenerates too
   * whenever the design has any grouped cutouts; a flat design's ordering is
   * purely visual and can skip the worker.
   */
  const setCutoutProperty = (ids: readonly string[], partial: CutoutToggleProperties): void => {
    if (ids.length === 0) return;
    set((state) => {
      const owner = cutoutOwner(state);
      const idSet = new Set(ids);
      const keys = Object.keys(partial) as (keyof CutoutToggleProperties)[];
      // Bail on a no-op: unknown ids, or the property already holds the wanted
      // value. Now that `hidden` bumps the generation epoch, re-hiding an
      // already-hidden cutout would otherwise cost a full worker rebuild on top
      // of a redundant undo entry.
      const changed = owner.cutouts.some(
        (c) => idSet.has(c.id) && keys.some((k) => c[k] !== partial[k])
      );
      if (!changed) return;

      pushHistoryEntry(state, { affectsGeometry: togglePropertyAffectsGeometry(partial) });
      owner.cutouts = owner.cutouts.map((c) => (idSet.has(c.id) ? { ...c, ...partial } : c));
    });
  };

  /**
   * Current stack, bottom to top.
   *
   * Ties break on array order so an all-default design (every `zIndex` absent,
   * i.e. 0) still has a stable, predictable starting stack rather than an
   * arbitrary one.
   */
  const stackBottomToTop = (cutouts: readonly Cutout[]): Cutout[] => {
    const indexById = new Map(cutouts.map((c, i) => [c.id, i]));
    return [...cutouts].sort(
      (a, b) =>
        (a.zIndex ?? 0) - (b.zIndex ?? 0) || (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0)
    );
  };

  /**
   * Move the selection one slot through an ordered stack, as a block.
   *
   * Walks from the far end so a contiguous run of selected shapes shifts
   * together instead of collapsing onto itself, and a selection already at the
   * end simply stays put.
   */
  const shiftOneSlot = (order: Cutout[], isSelected: (c: Cutout) => boolean, up: boolean): void => {
    if (up) {
      for (let i = order.length - 2; i >= 0; i--) {
        if (isSelected(order[i]) && !isSelected(order[i + 1])) {
          [order[i], order[i + 1]] = [order[i + 1], order[i]];
        }
      }
    } else {
      for (let i = 1; i < order.length; i++) {
        if (isSelected(order[i]) && !isSelected(order[i - 1])) {
          [order[i], order[i - 1]] = [order[i - 1], order[i]];
        }
      }
    }
  };

  /**
   * Re-stack the selection and renumber onto contiguous `zIndex` values 0..n-1.
   *
   * Reordering positions rather than doing arithmetic on `zIndex` is what makes
   * "send to back" mean anything: the old code wrote absolute values against a
   * field that defaults to 0 for every cutout, so `back` set 0 on something
   * already at 0 and `backward` clamped to `max(-1, 0)`. Both silently did
   * nothing until some other shape had been sent forward first.
   */
  const reorderCutouts = (ids: readonly string[], direction: ReorderDirection): void => {
    if (ids.length === 0) return;
    set((state) => {
      const idSet = new Set(ids);
      const cutouts = cutoutOwner(state).cutouts;
      if (!cutouts.some((c) => idSet.has(c.id))) return;

      const isSelected = (c: Cutout): boolean => idSet.has(c.id);
      const order = stackBottomToTop(cutouts);
      let next: Cutout[];

      switch (direction) {
        // Front/back preserve the selection's own internal order — bringing two
        // shapes forward together must not shuffle them relative to each other.
        case 'front':
          next = [...order.filter((c) => !isSelected(c)), ...order.filter(isSelected)];
          break;
        case 'back':
          next = [...order.filter(isSelected), ...order.filter((c) => !isSelected(c))];
          break;
        case 'forward':
          next = order;
          shiftOneSlot(next, isSelected, true);
          break;
        case 'backward':
          next = order;
          shiftOneSlot(next, isSelected, false);
          break;
      }

      commitStack(state, next);
    });
  };

  /**
   * Renumber onto contiguous `zIndex` values from a bottom-to-top order and
   * commit, skipping history entirely when nothing actually moved.
   */
  const commitStack = (state: Draft<DesignerState>, bottomToTop: readonly Cutout[]): void => {
    const owner = cutoutOwner(state);
    const cutouts = owner.cutouts;
    // Compare ORDER, not the stored values: a legacy design has every zIndex at
    // the default 0, so renumbering would rewrite each one and push an undo
    // entry for a drag that moved nothing.
    const current = stackBottomToTop(cutouts);
    if (current.every((c, i) => c.id === bottomToTop[i]?.id)) return;
    const zById = new Map(bottomToTop.map((c, i) => [c.id, i]));
    const restacked = cutouts.map((c) => {
      const z = zById.get(c.id) ?? 0;
      return c.zIndex === z ? c : { ...c, zIndex: z };
    });
    if (restacked.every((c, i) => c === cutouts[i])) return;

    pushHistoryEntry(state, { affectsGeometry: zOrderAffectsGeometry(state) });
    owner.cutouts = restacked;
  };

  /**
   * Drag-and-drop reorder: lift `ids` out of the stack and drop them directly
   * above `targetId`, or onto the bottom when it is null.
   *
   * The moved shapes keep their order among themselves, and a target inside the
   * moved set is ignored (dropping a selection onto itself is a no-op rather
   * than a reshuffle).
   */
  const moveCutoutsAbove = (ids: readonly string[], targetId: string | null): void => {
    if (ids.length === 0) return;
    set((state) => {
      const idSet = new Set(ids);
      if (targetId !== null && idSet.has(targetId)) return;

      const order = stackBottomToTop(cutoutOwner(state).cutouts);
      const moved = order.filter((c) => idSet.has(c.id));
      if (moved.length === 0) return;
      const rest = order.filter((c) => !idSet.has(c.id));

      const at = targetId === null ? 0 : rest.findIndex((c) => c.id === targetId) + 1;
      // An unknown target would splice at 0 and silently send the selection to
      // the bottom; leave the stack alone instead.
      if (targetId !== null && at === 0) return;

      commitStack(state, [...rest.slice(0, at), ...moved, ...rest.slice(at)]);
    });
  };

  const showAllCutouts = (): void => {
    set((state) => {
      const owner = cutoutOwner(state);
      const hasHidden = owner.cutouts.some((c) => c.hidden);
      if (!hasHidden) return;
      // Unhiding restores cuts the worker had dropped, so this regenerates.
      pushHistoryEntry(state, { affectsGeometry: true });
      owner.cutouts = owner.cutouts.map((c) => (c.hidden ? { ...c, hidden: false } : c));
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
      const owner = cutoutOwner(state);
      const affected = expandIdsToGroups(owner.cutouts, ids);
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

      const nextCutouts = owner.cutouts.map((c) => (affected.has(c.id) ? applyColor(c) : c));
      const changed = nextCutouts.some((c, i) => c !== owner.cutouts[i]);

      // Applying a color implies the user wants multi-color output; auto-enable
      // so the swatch shows instead of silently no-op'ing until they find the
      // Multi-Color panel toggle. Worth committing even if values were unchanged.
      const shouldEnable = typeof patch.color === 'string' && !state.params.featureColors.enabled;
      if (!changed && !shouldEnable) return;

      pushHistoryEntry(state, { affectsGeometry: false });
      owner.cutouts = nextCutouts;
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
    moveCutoutsAbove,
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
    /**
     * Add one cutout, reporting whether it landed.
     *
     * The boolean is what a batch caller needs: a loop over this stops adding
     * silently once the lid is full, so an import that reports its REQUESTED
     * count tells the user it stored shapes it dropped. Callers adding a single
     * shape can ignore it — the refusal is already visible as nothing happening.
     */
    addCutout: (cutout: Cutout): boolean => {
      let added = false;
      set((state) => {
        if (remainingCapacity(state) < 1) return;
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        owner.cutouts = [...owner.cutouts, withTopZIndex(state, cutout)];
        added = true;
      });
      return added;
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
        // The bin's array regardless of the editor target: a lid cutout cannot be
        // a mesh imprint, and `gcMeshAssets` counts references there. The z-index
        // has to rank against that same array, or the imprint lands on the lid's
        // next layer instead of the bin's.
        const placed =
          cutout.zIndex !== undefined
            ? cutout
            : { ...cutout, zIndex: nextTopZIndexIn(state.params.cutouts) };
        state.params.cutouts = [...state.params.cutouts, placed];
      });
    },

    removeCutout: (id: string) => {
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        owner.cutouts = dissolveSingletonGroups(owner.cutouts.filter((c) => c.id !== id));
        gcMeshAssets(state);
        gcCutoutGroupNames(state);
      });
    },

    updateCutout: (id: string, updates: Partial<Cutout>) => {
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        owner.cutouts = owner.cutouts.map((c) => {
          if (c.id !== id) return c;
          const transformedPath = applyPathTransform(c, updates);
          return withTextFootprint(
            transformedPath ? { ...c, ...updates, path: transformedPath } : { ...c, ...updates }
          );
        });
      });
    },

    clearCutouts: () => {
      set((state) => {
        pushHistoryEntry(state);
        cutoutOwner(state).cutouts = [];
        gcMeshAssets(state);
        gcCutoutGroupNames(state);
      });
    },

    duplicateCutouts: (cutoutIds: readonly string[]) => {
      if (cutoutIds.length === 0) return;
      set((state) => {
        // Checked before the history push: a refusal must not spend an undo slot
        // or bump the generation epoch for a batch that never lands.
        const room = remainingCapacity(state);
        if (room < 1) return;
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        const toDuplicate = owner.cutouts.filter((c) => cutoutIds.includes(c.id));
        // One map across the batch: see `remapGroupChain`.
        const groupMap = new Map<string, string>();
        const topZ = nextTopZIndexIn(cutoutList(state));
        const duplicated = toDuplicate.map((c, i) => {
          // Path points are absolute, so shifting x/y must shift them too —
          // otherwise duplicates render with the original path geometry.
          const translatedPath = c.path ? translatePathPoints(c.path, 5, 5) : c.path;
          return {
            ...remapGroupChain(c, groupMap, generateLayoutId),
            id: generateLayoutId(),
            x: c.x + 5,
            y: c.y + 5,
            // Copies land above the originals, keeping their relative order.
            // Inheriting `c.zIndex` would put a duplicate on the same layer as
            // its source with an identical area — a tie neither stacking
            // channel can break consistently.
            zIndex: topZ + i,
            ...(translatedPath ? { path: translatedPath } : {}),
          };
        });
        // Truncate rather than refuse the whole batch: duplicating six shapes with
        // room for two should give two, not nothing. Groups survive because
        // `groupMap` was built over the same ordered list. An uncapped target
        // reports `Infinity`, which `slice` reads as "all of them".
        owner.cutouts = [...owner.cutouts, ...duplicated.slice(0, room)];
      });
    },

    /**
     * Reparent for drag-and-drop.
     *
     * `groupCutouts` cannot express this: it reuses whichever member happens to
     * be grouped FIRST IN ARRAY ORDER, so dragging a grouped shape onto another
     * group could absorb the destination into the source instead of the other
     * way round. Here the destination always wins, and the dragged shapes
     * always leave whatever group they were in.
     *
     * - `targetId` null: pull `ids` out of any group.
     * - target is grouped: join exactly that group, inheriting its op.
     * - target is loose: form a fresh group of `ids` + the target.
     */
    reparentCutouts: (ids: readonly string[], targetId: string | null) => {
      if (ids.length === 0) return;
      set((state) => {
        const moving = new Set(ids);
        if (targetId !== null && moving.has(targetId)) return;
        const owner = cutoutOwner(state);
        const target =
          targetId === null ? null : (owner.cutouts.find((c) => c.id === targetId) ?? null);

        if (targetId !== null && !target) return;

        const destGroupId = target?.groupId ?? (target ? generateLayoutId() : null);
        // Forming a fresh pair means the target joins too.
        if (target && target.groupId === null) moving.add(target.id);

        // The destination keeps its own place in the tree; a fresh pair forms
        // where the target already sits.
        const destChain =
          target && destGroupId !== null ? [...parentGroups(target), destGroupId] : [];
        const noChange = owner.cutouts.every(
          (c) =>
            !moving.has(c.id) || (c.groupId === destGroupId && sameChain(groupChain(c), destChain))
        );
        if (noChange) return;

        const destOp: GroupOp =
          (target?.groupId
            ? owner.cutouts.find((c) => c.groupId === target.groupId)?.groupOp
            : undefined) ?? DEFAULT_GROUP_OP;
        // A newcomer adopts the destination's repeat too, not just its op.
        // Landing in a repeating group holding no repeat (or its own) leaves
        // the group describing a pattern only some of it is part of, which the
        // editor and the worker then read differently.
        //
        // Shaped like `destOp` above: an EXISTING group's answer wins outright,
        // "no repeat" included, because the destination is what the mover is
        // joining. Only a fresh pair has no answer yet, and there the newcomers
        // bring one between them.
        const destArray =
          destGroupId === null
            ? undefined
            : target?.groupId
              ? owner.cutouts.find((c) => c.groupId === target.groupId)?.array
              : adoptedGroupArray(owner.cutouts, moving, null);

        pushHistoryEntry(state);
        const reparented = owner.cutouts.map((c) =>
          moving.has(c.id)
            ? destGroupId === null
              ? withGroupChain({ ...c, groupId: destGroupId }, destChain)
              : withCutoutArray(
                  withGroupChain({ ...c, groupId: destGroupId, groupOp: destOp }, destChain),
                  destArray
                )
            : c
        );
        // Pulling members out can strand a one-member group behind.
        owner.cutouts = dissolveSingletonGroups(reparented);
        gcCutoutGroupNames(state);
      });
    },

    setCutoutArray: (
      cutoutId: string,
      config: CutoutArrayConfig | undefined,
      context?: readonly string[]
    ) => {
      set((state) => {
        const owner = cutoutOwner(state);
        const plan = planCutoutArrayWrite(owner.cutouts, cutoutId, config, context);
        if (!plan) return;
        pushHistoryEntry(state, { affectsGeometry: true });
        owner.cutouts = owner.cutouts.map((c) =>
          plan.ids.has(c.id) ? withCutoutArray(c, plan.config) : c
        );
      });
    },

    // Batch operations
    updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => {
      if (updates.size === 0) return;
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        owner.cutouts = owner.cutouts.map((c) => {
          const u = updates.get(c.id);
          if (!u) return c;
          const transformedPath = applyPathTransform(c, u);
          return withTextFootprint(
            transformedPath ? { ...c, ...u, path: transformedPath } : { ...c, ...u }
          );
        });
      });
    },

    removeCutoutsBatch: (ids: readonly string[]) => {
      if (ids.length === 0) return;
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        const idSet = new Set(ids);
        owner.cutouts = dissolveSingletonGroups(owner.cutouts.filter((c) => !idSet.has(c.id)));
        gcMeshAssets(state);
        gcCutoutGroupNames(state);
      });
    },

    mergeCutoutsIntoArray: (
      masterId: string,
      config: CutoutArrayConfig,
      absorbedIds: readonly string[]
    ) => {
      let merged = false;
      set((state) => {
        const master = cutoutList(state).find((c) => c.id === masterId);
        // `array !== undefined` guards replacing a repeat the master gained
        // since detection ran, which would silently discard its config.
        if (!master || !canArray(master) || master.locked === true || master.array !== undefined) {
          return;
        }

        // The ids come from a detection that ran against an older snapshot, so
        // re-check ELIGIBILITY rather than mere existence. Anything grouped,
        // locked, or given its own repeat since then is no longer something the
        // user asked to absorb, and deleting it would destroy work: this action
        // removes cutouts, so a stale id is a data-loss bug, not a no-op.
        const eligible = (c: Cutout): boolean =>
          c.id !== masterId && canArray(c) && c.locked !== true && c.array === undefined;
        const absorbed = new Set(
          absorbedIds.filter((id) => cutoutList(state).some((c) => c.id === id && eligible(c)))
        );
        // All-or-nothing: absorbing a subset would leave strays sitting on top
        // of instances the config now generates, which is worse than declining.
        if (absorbed.size === 0 || absorbed.size !== absorbedIds.length) return;

        pushHistoryEntry(state, { affectsGeometry: true });
        const owner = cutoutOwner(state);
        owner.cutouts = dissolveSingletonGroups(
          owner.cutouts
            .filter((c) => !absorbed.has(c.id))
            .map((c) => (c.id === masterId ? { ...c, array: config } : c))
        );
        gcMeshAssets(state);
        gcCutoutGroupNames(state);
        merged = true;
      });
      // Reported back so callers do not toast "merged" or count a merge that
      // the guards above declined.
      return merged;
    },
    ...createCutoutGroupActions(set),
  };
}
