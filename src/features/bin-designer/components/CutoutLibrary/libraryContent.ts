/**
 * Library content to and from a bin's cutouts.
 *
 * Saving moves a selection so its box starts at the origin and cuts it loose
 * from any group it does not hold whole. Placing gives every cutout, group and
 * mesh a fresh id, so an item placed twice, or into the bin it came from, never
 * shares an id with what is already there.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAssetEntry } from '@/shared/generation/meshAsset';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { groupChain } from '@/features/bin-designer/utils/cutoutHierarchy';
import type {
  CutoutLibraryContent,
  LibraryParams,
} from '@/features/bin-designer/library/libraryTypes';
import { getRotatedBounds, type Bounds } from '../panel/CutoutsSection/geometryCore';
import { translateCutout } from '../panel/CutoutsSection/cutoutHelpers';

/** The box round every cutout and repeat copy, as the board measures them. */
export function contentBounds(cutouts: readonly Cutout[]): Bounds | null {
  let box: Bounds | null = null;
  for (const cutout of cutouts) {
    for (const copy of expandCutoutArray(cutout)) {
      const b = getRotatedBounds(copy);
      box = box
        ? {
            minX: Math.min(box.minX, b.minX),
            minY: Math.min(box.minY, b.minY),
            maxX: Math.max(box.maxX, b.maxX),
            maxY: Math.max(box.maxY, b.maxY),
          }
        : b;
    }
  }
  return box;
}

/** Groups that every one of their members in `all` is part of `chosen`. */
function wholeGroups(chosen: readonly Cutout[], all: readonly Cutout[]): Set<string> {
  const ids = new Set(chosen.map((c) => c.id));
  const whole = new Set(chosen.flatMap((c) => groupChain(c)));
  for (const cutout of all) {
    if (ids.has(cutout.id)) continue;
    for (const group of groupChain(cutout)) whole.delete(group);
  }
  return whole;
}

/** A cutout as saved: placement-only fields dropped, groups it does not hold whole let go. */
function saved(cutout: Cutout, whole: ReadonlySet<string>): Cutout {
  const {
    locked: _locked,
    libraryItemId: _libraryItemId,
    groupId,
    groupOp,
    parentGroups,
    ...rest
  } = cutout;
  const keepGroup = groupId !== null && whole.has(groupId);
  const parents = (parentGroups ?? []).filter((g) => whole.has(g));
  return {
    ...rest,
    groupId: keepGroup ? groupId : null,
    ...(keepGroup && groupOp !== undefined ? { groupOp } : {}),
    ...(parents.length > 0 ? { parentGroups: parents } : {}),
  };
}

function pick<T>(
  source: Readonly<Record<string, T>> | undefined,
  keys: Iterable<string>
): Record<string, T> | undefined {
  if (!source) return undefined;
  const out: Record<string, T> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * `chosen` made into library content. `all` is every cutout on its board, so a
 * group that reaches past the selection is let go rather than saved half.
 */
export function toLibraryContent(
  chosen: readonly Cutout[],
  all: readonly Cutout[],
  params: Pick<LibraryParams, 'cutoutGroupNames' | 'meshAssets'>
): CutoutLibraryContent | null {
  const box = contentBounds(chosen);
  if (!box) return null;
  const whole = wholeGroups(chosen, all);
  const cutouts = chosen.map((c) => translateCutout(saved(c, whole), -box.minX, -box.minY));
  const groupNames = pick(params.cutoutGroupNames, whole);
  const meshAssets = pick(
    params.meshAssets,
    cutouts.flatMap((c) => (c.meshId ? [c.meshId] : []))
  );
  return {
    params: {
      cutouts,
      ...(groupNames ? { cutoutGroupNames: groupNames } : {}),
      ...(meshAssets ? { meshAssets } : {}),
    },
  };
}

export interface PlacedContent {
  readonly cutouts: Cutout[];
  readonly groupNames: Record<string, string>;
  readonly meshAssets: Record<string, MeshAssetEntry>;
}

export interface PlaceOptions {
  readonly itemId: string;
  /** Where the middle of the item lands, in board mm. */
  readonly at: { readonly x: number; readonly y: number };
  readonly newCutoutId: () => string;
  readonly newGroupId: () => string;
  /**
   * The deepest a fixed-depth pocket can go in the bin it lands in. A deeper
   * one is held to it; a floor or through pocket follows its bin already.
   */
  readonly maxCutDepth?: number;
}

/** Library content made ready to add to a board. */
export function placeLibraryContent(
  content: CutoutLibraryContent,
  { itemId, at, newCutoutId, newGroupId, maxCutDepth }: PlaceOptions
): PlacedContent {
  const source = content.params.cutouts;
  const box = contentBounds(source);
  const dx = box ? at.x - (box.minX + box.maxX) / 2 : 0;
  const dy = box ? at.y - (box.minY + box.maxY) / 2 : 0;

  const groups = new Map<string, string>();
  const group = (id: string): string => {
    let next = groups.get(id);
    if (next === undefined) {
      next = newGroupId();
      groups.set(id, next);
    }
    return next;
  };
  const meshes = new Map<string, string>();

  const cutouts = source.map((c) => {
    const moved = translateCutout(c, dx, dy);
    const cap =
      maxCutDepth !== undefined && maxCutDepth > 0 && moved.depthMode === undefined
        ? maxCutDepth
        : undefined;
    if (moved.meshId !== undefined && !meshes.has(moved.meshId)) {
      meshes.set(moved.meshId, newCutoutId());
    }
    return {
      ...moved,
      id: newCutoutId(),
      groupId: moved.groupId === null ? null : group(moved.groupId),
      ...(moved.parentGroups ? { parentGroups: moved.parentGroups.map(group) } : {}),
      ...(moved.meshId !== undefined ? { meshId: meshes.get(moved.meshId) } : {}),
      ...(cap !== undefined ? { cutDepth: Math.min(moved.cutDepth, cap) } : {}),
      ...(moved.split &&
      moved.split.depthMode === undefined &&
      maxCutDepth !== undefined &&
      maxCutDepth > 0
        ? { split: { ...moved.split, cutDepth: Math.min(moved.split.cutDepth, maxCutDepth) } }
        : {}),
      libraryItemId: itemId,
    };
  });

  const groupNames: Record<string, string> = {};
  for (const [from, to] of groups) {
    const name = content.params.cutoutGroupNames?.[from];
    if (name !== undefined) groupNames[to] = name;
  }
  const meshAssets: Record<string, MeshAssetEntry> = {};
  for (const [from, to] of meshes) {
    const asset = content.params.meshAssets?.[from];
    if (asset !== undefined) meshAssets[to] = asset;
  }
  return { cutouts, groupNames, meshAssets };
}

/** The library items a board's cutouts were placed from. */
export function itemsOnBoard(cutouts: readonly Cutout[]): Set<string> {
  return new Set(cutouts.flatMap((c) => (c.libraryItemId ? [c.libraryItemId] : [])));
}
