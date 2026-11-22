/** The library's folder tree, flattened for lists and pickers. */

import type { SelectOption } from '@/design-system';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';

export interface FolderRow {
  readonly folder: CutoutLibraryFolder;
  readonly depth: number;
}

/**
 * Every folder in tree order, each with its depth. A folder whose parent is
 * missing (pulled before its parent, or the parent deleted elsewhere) shows at
 * the top, as sync treats it.
 */
export function folderRows(folders: readonly CutoutLibraryFolder[]): FolderRow[] {
  const ids = new Set(folders.map((f) => f.id));
  const byParent = new Map<string | null, CutoutLibraryFolder[]>();
  for (const folder of folders) {
    const parent = folder.parentId !== null && ids.has(folder.parentId) ? folder.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), folder]);
  }
  const rows: FolderRow[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    const children = [...(byParent.get(parent) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
    for (const folder of children) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      rows.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  // Folders caught in a loop never hang from the top, so show them there.
  for (const folder of folders) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    rows.push({ folder, depth: 0 });
    walk(folder.id, 1);
  }
  return rows;
}

/** The items in `folderId`, or at the top level for null. An unknown folder counts as the top. */
export function itemsIn(
  items: readonly CutoutLibraryItem[],
  folderId: string | null,
  folders: readonly CutoutLibraryFolder[]
): CutoutLibraryItem[] {
  const ids = new Set(folders.map((f) => f.id));
  return items.filter((item) => {
    const home = item.folderId !== null && ids.has(item.folderId) ? item.folderId : null;
    return home === folderId;
  });
}

/** Whether an item's name holds every word of `query`, in any case. */
export function matchesQuery(item: CutoutLibraryItem, query: string): boolean {
  const name = item.name.toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

/** No-break spaces: a select drops leading plain ones. */
const INDENT = String.fromCharCode(0xa0, 0xa0);

/** Folder options in tree order, each indented by its depth, after the no-folder choice (''). */
export function folderOptions(
  folders: readonly CutoutLibraryFolder[],
  noFolderLabel: string
): SelectOption[] {
  return [
    { id: '', name: noFolderLabel },
    ...folderRows(folders).map(({ folder, depth }) => ({
      id: folder.id,
      name: `${INDENT.repeat(depth)}${folder.name}`,
    })),
  ];
}
