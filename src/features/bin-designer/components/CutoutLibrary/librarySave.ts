/** What a save from the board offers: the item to update, and the name to start from. */

import type { Cutout } from '@/features/bin-designer/types';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { MAX_LIBRARY_NAME_LENGTH } from '@/features/bin-designer/library/libraryTypes';

/**
 * The item every chosen cutout was placed from or saved to, when they agree on
 * one that is still in the library. Saving again can update it.
 */
export function saveSource(
  chosen: readonly Cutout[],
  items: readonly CutoutLibraryItem[]
): CutoutLibraryItem | null {
  const ids = new Set(chosen.map((c) => c.libraryItemId));
  if (ids.size !== 1) return null;
  const [id] = ids;
  return id === undefined ? null : (items.find((item) => item.id === id) ?? null);
}

/** The source item's name, else one group's name, else one cutout's label, else `fallback`. */
export function defaultSaveName(
  chosen: readonly Cutout[],
  source: CutoutLibraryItem | null,
  groupNames: Readonly<Record<string, string>> | undefined,
  fallback: string
): string {
  if (source) return source.name;
  const groups = new Set(chosen.map((c) => c.parentGroups?.[0] ?? c.groupId));
  const [group] = groups;
  const groupName = groups.size === 1 && group ? groupNames?.[group]?.trim() : undefined;
  if (groupName) return groupName.slice(0, MAX_LIBRARY_NAME_LENGTH);
  const label = chosen.length === 1 ? chosen[0].label.trim() : '';
  return label ? label.slice(0, MAX_LIBRARY_NAME_LENGTH) : fallback;
}
