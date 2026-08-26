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
  CutoutTarget,
  CutoutToggleProperties,
  ReorderDirection,
  PathPoint,
  GroupOp,
} from '../../types';
import {
  DEFAULT_GROUP_OP,
  DEFAULT_CUTOUT_COLOR_SCOPE,
  MAX_GROUP_NAME_LENGTH,
  MAX_LID_CUTOUTS,
} from '../../types';
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
import { scalePathPoints, translatePathPoints } from '../../utils/pathTransforms';
import {
  canNestDeeper,
  groupChain,
  insertGroupAt,
  isBooleanGroup,
  maxChainLength,
  parentGroups,
  referencedGroupIds,
  remapGroupChain,
  removeGroup,
  sameChain,
  unitTag,
  unitTagGroupId,
  unitTagShapeId,
  unitTags,
  withGroupChain,
} from '../../utils/cutoutHierarchy';

/**
 * The cutout array every action in this slice reads and writes, chosen by
 * `ui.cutoutTarget`.
 *
 * Returns the OWNER of the array (`params` or `params.lid`) rather than the array
 * itself, so a caller can both read `owner.cutouts` and assign to it — an immer
 * draft property assignment either way. That is what lets one editor serve the
 * bin's interior and the lid's plate without a target argument threaded through
 * twenty action signatures, and it means an action added later is retargetable by
 * construction instead of by remembering to be.
 *
 * Pair it with {@link cutoutList} for guards that run BEFORE any write: this one
 * materializes `lid.cutouts`, and an action that bails early would otherwise
 * leave `[]` behind on a lid that has none — enough to shift the design's
 * `communityParamsFingerprint` for a no-op.
 */
function cutoutList(state: Draft<DesignerState>): readonly Cutout[] {
  if (state.ui.cutoutTarget !== 'lid') return state.params.cutouts;
  return state.params.lid.cutouts ?? [];
}

function cutoutOwner(state: Draft<DesignerState>): { cutouts: Cutout[] } {
  if (state.ui.cutoutTarget !== 'lid') return state.params;
  const lid = state.params.lid;
  // `lid.cutouts` is absent rather than empty on a design that has none, so the
  // fingerprint of every design published before the feature is unchanged (see the
  // field's note). Materializing it here — inside a producer, so it is a real draft
  // mutation — is what lets the actions below read and write it unconditionally.
  // It only ever runs when a cutout action fires against the lid, which means the
  // user opened its editor.
  lid.cutouts ??= [];
  return lid as { cutouts: Cutout[] };
}

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
  // `state.params.cutouts`, deliberately NOT `cutoutOwner(state)`: mesh imprints
  // exist only on the bin's interior array (an imprint is subtracted after
  // tessellation, in the bin's mesh frame, so a lid can never hold one). Counting
  // references through the retargeted array would find none while the lid is the
  // target and drop every asset the BIN still uses.
  const referenced = new Set(
    state.params.cutouts.map((c) => c.meshId).filter((id): id is string => id !== undefined)
  );
  const kept = Object.entries(assets).filter(([id]) => referenced.has(id));
  if (kept.length === Object.keys(assets).length) return;
  state.params.meshAssets = kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * Drop names for groups the design no longer has. Runs after every path that
 * can empty or dissolve a group, so a deleted assembly doesn't leave its name
 * behind to be re-adopted by a later group that happens to reuse the id.
 *
 * Reads BOTH cutout arrays, unlike {@link gcMeshAssets}: one name map serves
 * the bin and its lid, so counting references through `cutoutOwner` alone would
 * drop every name the other array still uses.
 */
function gcCutoutGroupNames(state: Draft<DesignerState>): void {
  const names = state.params.cutoutGroupNames;
  if (!names) return;
  const referenced = referencedGroupIds(state.params.cutouts, state.params.lid.cutouts ?? []);
  const kept = Object.entries(names).filter(([id]) => referenced.has(id));
  if (kept.length === Object.keys(names).length) return;
  state.params.cutoutGroupNames = kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * How many more cutouts a target will accept.
 *
 * Only the LID is capped: `MAX_LID_CUTOUTS` bounds the boolean work against a
 * single plate, where nothing else does (the bin's array is bounded in practice
 * by the cavity a shape has to fit in). The client refuses past it rather than
 * letting the write through, because the server rejects an oversized payload and
 * `migrateLidCutouts` truncates one on load — so without this an honest design
 * would be silently cut down somewhere the user never sees (CLAUDE.md gotcha
 * #13b: a server cap that rejects needs a client cap that refuses).
 *
 * Exported because a batch has to size its work BEFORE it starts. `addCutout`
 * refusing one at a time is enough to hold the cap, but not enough for a
 * flatten, whose first step destroys the master's repeat config: it needs to
 * know it can finish before it begins. One definition rather than a copy in the
 * UI, since a cap and a second reading of it are exactly what drift apart.
 */
export function remainingCutoutCapacity(
  target: CutoutTarget,
  lidCutouts: readonly Cutout[] | undefined
): number {
  if (target !== 'lid') return Infinity;
  return Math.max(0, MAX_LID_CUTOUTS - (lidCutouts?.length ?? 0));
}

function remainingCapacity(state: Draft<DesignerState>): number {
  return remainingCutoutCapacity(state.ui.cutoutTarget, state.params.lid.cutouts);
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
  return cutoutOwner(state).cutouts.some((c) => c.groupId !== null);
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
  return { ...cutout, zIndex: nextTopZIndexIn(cutoutList(state)) };
}

/**
 * One past the highest occupied layer in `list`.
 *
 * Takes the list rather than the state so a caller writing to a specific array
 * ranks against THAT array. `addMeshCutout` is the one that needs it: its write
 * target is pinned to the bin, so ranking against the retargeted list would stamp
 * an imprint with the lid's next index — `0` on a lid with no cutouts, colliding
 * with every bin cutout at the default layer, which is the exact tie this helper
 * exists to prevent.
 */
function nextTopZIndexIn(list: readonly Cutout[]): number {
  return list.reduce((m, c) => Math.max(m, c.zIndex ?? 0), -1) + 1;
}

/** Where one moving cutout lands: its new ancestry, and whether it keeps its own group. */
interface UnitLanding {
  readonly chain: readonly string[];
  readonly keepsGroup: boolean;
}

/**
 * Resolve dragged {@link unitTag}s into a per-cutout landing.
 *
 * A dragged GROUP arrives intact, so its members keep everything from that
 * group down. A dragged SHAPE row is one shape: it lands as a direct child and
 * leaves whatever boolean group it was in — which is reachable by dragging a
 * member out while drilled into its group.
 */
function planUnitLandings(
  cutouts: readonly Cutout[],
  tags: readonly string[],
  destChain: readonly string[]
): Map<string, UnitLanding> {
  const landings = new Map<string, UnitLanding>();
  for (const tag of tags) {
    const groupId = unitTagGroupId(tag);
    if (groupId === null) {
      const id = unitTagShapeId(tag);
      if (id !== null && cutouts.some((c) => c.id === id)) {
        landings.set(id, { chain: destChain, keepsGroup: false });
      }
      continue;
    }
    for (const member of cutouts) {
      const chain = groupChain(member);
      const at = chain.indexOf(groupId);
      if (at === -1) continue;
      landings.set(member.id, {
        chain: [...destChain, ...chain.slice(at)],
        keepsGroup: member.groupId !== null,
      });
    }
  }
  return landings;
}

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

    groupCutouts: (cutoutIds: readonly string[], op?: GroupOp, context: readonly string[] = []) => {
      if (cutoutIds.length < 2) return;
      set((state) => {
        const owner = cutoutOwner(state);
        // Nothing may be created inside a boolean group. Its members are exactly
        // what its op fuses, so a group formed among them would silently reduce
        // that set — the one nesting move that could change existing geometry.
        if (context.length > 0 && isBooleanGroup(owner.cutouts, context[context.length - 1])) {
          return;
        }
        // Which things the selection reaches at this level. A group counts once
        // however many of its members are selected, so "two shapes of one group"
        // is one unit and correctly does nothing.
        const units = unitTags(
          owner.cutouts.filter((c) => cutoutIds.includes(c.id)),
          context
        );
        if (units.size < 2) return;

        // A selection reaching only loose shapes still forms a boolean group,
        // exactly as it did before nesting existed — that is what keeps Ctrl+G
        // then a Pathfinder op working. The moment it reaches a group, wrapping
        // is the only thing that preserves what is already there, so an explicit
        // op (a Pathfinder button) is the only way back to the flat behavior.
        if (op === undefined && [...units].some((tag) => unitTagGroupId(tag) !== null)) {
          const members = owner.cutouts.filter((c) => {
            const tag = unitTag(c, context);
            return tag !== null && units.has(tag);
          });
          if (!canNestDeeper(members)) return;
          const containerId = generateLayoutId();
          const memberIds = new Set(members.map((c) => c.id));
          pushHistoryEntry(state, { affectsGeometry: false });
          owner.cutouts = owner.cutouts.map((c) =>
            memberIds.has(c.id) ? insertGroupAt(c, containerId, context.length) : c
          );
          return;
        }
        // Reuse an existing groupId if any selected cutout already belongs to a group
        const existingMember = owner.cutouts.find(
          (c) => cutoutIds.includes(c.id) && c.groupId !== null
        );
        const existingGroupId = existingMember?.groupId ?? null;
        const groupId = existingGroupId ?? generateLayoutId();
        // When extending an existing group and the caller didn't override the op,
        // inherit the group's current op so silent regroups keep their semantics.
        const groupOp: GroupOp = op ?? existingMember?.groupOp ?? DEFAULT_GROUP_OP;
        const idsToGroup = new Set(cutoutIds);
        if (existingGroupId) {
          for (const c of owner.cutouts) {
            if (c.groupId === existingGroupId) idsToGroup.add(c.id);
          }
        }
        // One repeat per group, adopted the same way the color below is.
        const sharedArray = adoptedGroupArray(owner.cutouts, idsToGroup, existingGroupId);
        // One color per group: adopt the group's existing color, else the first
        // colored member, so a freshly grouped set can't hold mixed backings.
        const colorSource =
          (existingGroupId
            ? owner.cutouts.find((c) => c.groupId === existingGroupId && c.color !== undefined)
            : undefined) ??
          owner.cutouts.find((c) => idsToGroup.has(c.id) && c.color !== undefined);
        const colorPatch: Pick<Cutout, 'color' | 'colorScope'> | undefined = colorSource
          ? {
              color: colorSource.color,
              colorScope: colorSource.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE,
            }
          : undefined;
        // Where the boolean group sits in the tree. An EXISTING group's own
        // position wins — folding shapes into it must move them to it, not drag
        // it out to wherever the caller was looking from.
        const destParents = existingMember ? parentGroups(existingMember) : context;
        const destChain = [...destParents, groupId];
        // Re-grouping a set that already forms this exact group changes nothing,
        // and an unconditional history push would spend an undo slot on it —
        // reachable from Ctrl+G on a partial selection of one group.
        const noChange = owner.cutouts.every(
          (c) =>
            !idsToGroup.has(c.id) ||
            (c.groupId === groupId &&
              (c.groupOp ?? DEFAULT_GROUP_OP) === groupOp &&
              c.array === sharedArray &&
              sameChain(groupChain(c), destChain) &&
              (!colorPatch ||
                (c.color === colorPatch.color &&
                  (c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE) === colorPatch.colorScope)))
        );
        if (noChange) return;

        pushHistoryEntry(state);
        owner.cutouts = owner.cutouts.map((c) =>
          idsToGroup.has(c.id)
            ? withCutoutArray(
                withGroupChain({ ...c, groupId, groupOp, ...colorPatch }, destChain),
                sharedArray
              )
            : c
        );
        gcCutoutGroupNames(state);
      });
    },

    ungroupCutouts: (cutoutIds: readonly string[]) => {
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        const ungrouped = owner.cutouts.map((c) => {
          if (!cutoutIds.includes(c.id)) return c;
          const { groupOp: _omit, ...rest } = c;
          return { ...rest, groupId: null };
        });
        // A group can be left with a single member after a partial ungroup;
        // dissolve that singleton so the Pathfinder UI doesn't pretend a lone
        // cutout still belongs to an active group.
        owner.cutouts = dissolveSingletonGroups(ungrouped);
        gcCutoutGroupNames(state);
      });
    },

    /**
     * Move whole units — group rows and shape rows from the shape list — under
     * `destGroupId`, or to the top level when it is null.
     *
     * Takes {@link unitTag}s rather than cutout ids because the ids alone are
     * ambiguous: the members of a dragged group and three loose shapes that
     * happen to share a parent look identical as a flat id list, yet one has to
     * keep its own group on landing and the other must not gain one.
     */
    moveUnitsIntoGroup: (tags: readonly string[], destGroupId: string | null) => {
      if (tags.length === 0) return;
      set((state) => {
        const owner = cutoutOwner(state);
        const movingGroups = tags.map(unitTagGroupId).filter((id): id is string => id !== null);
        // A shape landing directly in a boolean group joins its boolean; every
        // other landing keeps whatever the cutout already was.
        const joinsBoolean =
          destGroupId !== null && isBooleanGroup(owner.cutouts, destGroupId) ? destGroupId : null;

        // A boolean group's members are exactly what its op fuses, so admitting
        // a subgroup would change what it carves without touching its own rows.
        if (joinsBoolean !== null && movingGroups.length > 0) return;

        let destChain: readonly string[] = [];
        if (destGroupId !== null) {
          const anchor = owner.cutouts.find((c) => groupChain(c).includes(destGroupId));
          if (!anchor) return;
          const anchorChain = groupChain(anchor);
          destChain = anchorChain.slice(0, anchorChain.indexOf(destGroupId) + 1);
        }
        // Landing a group inside itself, or anywhere in its own subtree, would
        // cut that branch loose.
        if (movingGroups.some((g) => destChain.includes(g))) return;

        const landings = planUnitLandings(owner.cutouts, tags, destChain);
        if (landings.size === 0) return;
        // Per landing, not one flat cap: a shape that lands loose stores its
        // whole chain in `parentGroups`, which the schema caps one lower.
        const overDepth = [...landings.values()].some(
          (l) => l.chain.length > maxChainLength({ groupId: l.keepsGroup ? 'kept' : null })
        );
        if (overDepth) return;

        const unchanged = owner.cutouts.every((c) => {
          const next = landings.get(c.id);
          return (
            next === undefined ||
            (sameChain(groupChain(c), next.chain) && next.keepsGroup === (c.groupId !== null))
          );
        });
        if (unchanged) return;

        pushHistoryEntry(state, { affectsGeometry: joinsBoolean !== null });
        const destOp =
          joinsBoolean === null
            ? DEFAULT_GROUP_OP
            : (owner.cutouts.find((c) => c.groupId === joinsBoolean)?.groupOp ?? DEFAULT_GROUP_OP);
        owner.cutouts = dissolveSingletonGroups(
          owner.cutouts.map((c) => {
            const landing = landings.get(c.id);
            if (landing === undefined) return c;
            if (landing.keepsGroup) return withGroupChain(c, landing.chain, true);
            // `destChain` already ends with the destination group, so a shape
            // joining a boolean group takes that chain as-is — appending the id
            // again would list it twice and make it its own ancestor.
            if (joinsBoolean !== null) {
              return withGroupChain(
                { ...c, groupId: joinsBoolean, groupOp: destOp },
                landing.chain,
                true
              );
            }
            // Leaving a boolean group takes its op along: a stale one on a now
            // loose shape would be adopted by whatever group it joins next.
            const { groupOp: _omit, ...bare } = c;
            return withGroupChain(bare, landing.chain, false);
          })
        );
        gcCutoutGroupNames(state);
      });
    },

    peelGroup: (groupId: string) => {
      set((state) => {
        const owner = cutoutOwner(state);
        if (!owner.cutouts.some((c) => groupChain(c).includes(groupId))) return;
        // Dissolving a container rearranges nothing the generator reads, but
        // dissolving a boolean group turns one fused cut tool back into several,
        // so only the latter is a geometry change.
        pushHistoryEntry(state, { affectsGeometry: isBooleanGroup(owner.cutouts, groupId) });
        const peeled = owner.cutouts.map((c) => {
          if (!groupChain(c).includes(groupId)) return c;
          // `groupOp` describes membership of the group being dissolved, so it
          // has to go with it — a stale op on a now-loose shape would be adopted
          // by whatever group the shape joins next.
          const next = removeGroup(c, groupId);
          if (c.groupId !== groupId) return next;
          const { groupOp: _omit, ...rest } = next;
          return rest;
        });
        owner.cutouts = dissolveSingletonGroups(peeled);
        gcCutoutGroupNames(state);
      });
    },

    setCutoutGroupName: (groupId: string, name: string) => {
      set((state) => {
        const trimmed = name.trim().slice(0, MAX_GROUP_NAME_LENGTH);
        const names = state.params.cutoutGroupNames ?? {};
        if ((names[groupId] ?? '') === trimmed) return;
        // Editor metadata only — a rename must never rebuild the mesh.
        pushHistoryEntry(state, { affectsGeometry: false });
        const next = Object.fromEntries(Object.entries(names).filter(([id]) => id !== groupId));
        if (trimmed !== '') next[groupId] = trimmed;
        state.params.cutoutGroupNames = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setGroupOp: (groupId: string, op: GroupOp) => {
      set((state) => {
        const owner = cutoutOwner(state);
        const hasMatchingGroup = owner.cutouts.some(
          (c) => c.groupId === groupId && (c.groupOp ?? DEFAULT_GROUP_OP) !== op
        );
        if (!hasMatchingGroup) return;
        pushHistoryEntry(state);
        owner.cutouts = owner.cutouts.map((c) =>
          c.groupId === groupId ? { ...c, groupOp: op } : c
        );
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
  };
}
