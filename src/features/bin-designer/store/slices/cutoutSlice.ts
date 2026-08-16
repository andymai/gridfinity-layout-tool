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
  PathPoint,
  GroupOp,
} from '../../types';
import { DEFAULT_GROUP_OP, DEFAULT_CUTOUT_COLOR_SCOPE } from '../../types';
import { canArray } from '@/shared/utils/cutoutArray';
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

/**
 * Whether a toggle-property edit changes the generated part.
 *
 * Only `hidden` does: the worker drops hidden cutouts (`cutoutBuilder.ts`), so
 * toggling it changes the geometry. `locked` is editor state the worker
 * never reads.
 */
function togglePropertyAffectsGeometry(partial: CutoutToggleProperties): boolean {
  return partial.hidden !== undefined;
}

/**
 * Whether a z-order change reaches the geometry.
 *
 * `zIndex`'s only geometry consumer is boolean-op ordering inside a group
 * (`cutoutGroupOps.ts`), so a design with nothing grouped can reorder purely
 * visually and skip the worker.
 */
function zOrderAffectsGeometry(state: Draft<DesignerState>): boolean {
  return state.params.cutouts.some((c) => c.groupId !== null);
}

/**
 * Put a new cutout on its own layer at the top of the stack.
 *
 * Two purposes: a freshly drawn shape should land on top, and giving every
 * cutout a distinct `zIndex` keeps the renderer's stacking key strict. Two
 * shapes sharing a layer AND an area would otherwise have identical scene Z and
 * `renderOrder`, leaving the tie to be broken by raycast traversal order on one
 * side and object id on the other — which can disagree.
 *
 * An explicit `zIndex` on the incoming cutout is honoured (paste/duplicate
 * carry their own ordering).
 */
function withTopZIndex(state: Draft<DesignerState>, cutout: Cutout): Cutout {
  if (cutout.zIndex !== undefined) return cutout;
  return { ...cutout, zIndex: nextTopZIndex(state) };
}

/** One past the highest occupied layer. */
function nextTopZIndex(state: Draft<DesignerState>): number {
  return state.params.cutouts.reduce((m, c) => Math.max(m, c.zIndex ?? 0), -1) + 1;
}

export function createCutoutSlice(set: Set) {
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
      const idSet = new Set(ids);
      const keys = Object.keys(partial) as (keyof CutoutToggleProperties)[];
      // Bail on a no-op: unknown ids, or the property already holds the wanted
      // value. Now that `hidden` bumps the generation epoch, re-hiding an
      // already-hidden cutout would otherwise cost a full worker rebuild on top
      // of a redundant undo entry.
      const changed = state.params.cutouts.some(
        (c) => idSet.has(c.id) && keys.some((k) => c[k] !== partial[k])
      );
      if (!changed) return;

      pushHistoryEntry(state, { affectsGeometry: togglePropertyAffectsGeometry(partial) });
      state.params.cutouts = state.params.cutouts.map((c) =>
        idSet.has(c.id) ? { ...c, ...partial } : c
      );
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
      const cutouts = state.params.cutouts;
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
    const cutouts = state.params.cutouts;
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
    state.params.cutouts = restacked;
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

      const order = stackBottomToTop(state.params.cutouts);
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
      const hasHidden = state.params.cutouts.some((c) => c.hidden);
      if (!hasHidden) return;
      // Unhiding restores cuts the worker had dropped, so this regenerates.
      pushHistoryEntry(state, { affectsGeometry: true });
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
    addCutout: (cutout: Cutout) => {
      set((state) => {
        pushHistoryEntry(state);
        state.params.cutouts = [...state.params.cutouts, withTopZIndex(state, cutout)];
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
        state.params.cutouts = [...state.params.cutouts, withTopZIndex(state, cutout)];
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
        const topZ = nextTopZIndex(state);
        const duplicated = toDuplicate.map((c, i) => {
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
            // Copies land above the originals, keeping their relative order.
            // Inheriting `c.zIndex` would put a duplicate on the same layer as
            // its source with an identical area — a tie neither stacking
            // channel can break consistently.
            zIndex: topZ + i,
            ...(translatedPath ? { path: translatedPath } : {}),
          };
        });
        state.params.cutouts = [...state.params.cutouts, ...duplicated];
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
        const target =
          targetId === null ? null : (state.params.cutouts.find((c) => c.id === targetId) ?? null);
        if (targetId !== null && !target) return;

        const destGroupId = target?.groupId ?? (target ? generateLayoutId() : null);
        // Forming a fresh pair means the target joins too.
        if (target && target.groupId === null) moving.add(target.id);

        const noChange = state.params.cutouts.every(
          (c) => !moving.has(c.id) || c.groupId === destGroupId
        );
        if (noChange) return;

        const destOp: GroupOp =
          (target?.groupId
            ? state.params.cutouts.find((c) => c.groupId === target.groupId)?.groupOp
            : undefined) ?? DEFAULT_GROUP_OP;

        pushHistoryEntry(state);
        state.params.cutouts = state.params.cutouts.map((c) =>
          moving.has(c.id)
            ? {
                ...c,
                groupId: destGroupId,
                ...(destGroupId === null ? {} : { groupOp: destOp }),
              }
            : c
        );
        // Pulling members out can strand a one-member group behind.
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
      });
    },

    groupCutouts: (cutoutIds: readonly string[], op?: GroupOp) => {
      if (cutoutIds.length < 2) return;
      set((state) => {
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
        // Re-grouping a set that already forms this exact group changes nothing,
        // and an unconditional history push would spend an undo slot on it —
        // reachable from Ctrl+G on a partial selection of one group.
        const noChange = state.params.cutouts.every(
          (c) =>
            !idsToGroup.has(c.id) ||
            (c.groupId === groupId &&
              (c.groupOp ?? DEFAULT_GROUP_OP) === groupOp &&
              (!colorPatch ||
                (c.color === colorPatch.color &&
                  (c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE) === colorPatch.colorScope)))
        );
        if (noChange) return;

        pushHistoryEntry(state);
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

    mergeCutoutsIntoArray: (
      masterId: string,
      config: CutoutArrayConfig,
      absorbedIds: readonly string[]
    ) => {
      let merged = false;
      set((state) => {
        const master = state.params.cutouts.find((c) => c.id === masterId);
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
          absorbedIds.filter((id) => state.params.cutouts.some((c) => c.id === id && eligible(c)))
        );
        // All-or-nothing: absorbing a subset would leave strays sitting on top
        // of instances the config now generates, which is worse than declining.
        if (absorbed.size === 0 || absorbed.size !== absorbedIds.length) return;

        pushHistoryEntry(state, { affectsGeometry: true });
        state.params.cutouts = state.params.cutouts
          .filter((c) => !absorbed.has(c.id))
          .map((c) => (c.id === masterId ? { ...c, array: config } : c));
        state.params.cutouts = dissolveSingletonGroups(state.params.cutouts);
        gcMeshAssets(state);
        merged = true;
      });
      // Reported back so callers do not toast "merged" or count a merge that
      // the guards above declined.
      return merged;
    },
  };
}
