/**
 * Pure helpers behind the cutout slice: owner lookup, group expansion, asset
 * and group-name garbage collection, z-order and unit-landing planning.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  Cutout,
  CutoutTarget,
  CutoutToggleProperties,
  PathPoint,
} from '../../types';
import { MAX_LID_CUTOUTS } from '../../types';
import { scalePathPoints, translatePathPoints } from '../../utils/pathTransforms';
import {
  groupChain,
  referencedGroupIds,
  unitTagGroupId,
  unitTagShapeId,
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
export function cutoutList(state: Draft<DesignerState>): readonly Cutout[] {
  if (state.ui.cutoutTarget !== 'lid') return state.params.cutouts;
  return state.params.lid.cutouts ?? [];
}

export function cutoutOwner(state: Draft<DesignerState>): { cutouts: Cutout[] } {
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
export function applyPathTransform(c: Cutout, updates: Partial<Cutout>): PathPoint[] | undefined {
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
export function expandIdsToGroups(
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
export function gcMeshAssets(state: Draft<DesignerState>): void {
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
export function gcCutoutGroupNames(state: Draft<DesignerState>): void {
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

export function remainingCapacity(state: Draft<DesignerState>): number {
  return remainingCutoutCapacity(state.ui.cutoutTarget, state.params.lid.cutouts);
}

export type Set = (fn: (state: Draft<DesignerState>) => void) => void;

/**
 * Whether a toggle-property edit changes the generated part.
 *
 * Only `hidden` does: the worker drops hidden cutouts (`cutoutBuilder.ts`), so
 * toggling it changes the geometry. `locked` is editor state the worker
 * never reads.
 */
export function togglePropertyAffectsGeometry(partial: CutoutToggleProperties): boolean {
  return partial.hidden !== undefined;
}

/**
 * Whether a z-order change reaches the geometry.
 *
 * `zIndex`'s only geometry consumer is boolean-op ordering inside a group
 * (`cutoutGroupOps.ts`), so a design with nothing grouped can reorder purely
 * visually and skip the worker.
 */
export function zOrderAffectsGeometry(state: Draft<DesignerState>): boolean {
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
export function withTopZIndex(state: Draft<DesignerState>, cutout: Cutout): Cutout {
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
export function nextTopZIndexIn(list: readonly Cutout[]): number {
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
export function planUnitLandings(
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
