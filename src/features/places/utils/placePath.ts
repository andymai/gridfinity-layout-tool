import { entryFolderId, folderPath } from '@/core/storage';
import type { LayoutId, LayoutLibrary } from '@/core/types';

/**
 * Where a layout sits, place first. A layout outside every place folder is in
 * the user's own place, which is the library root and has no folder to name it,
 * so the caller passes that name.
 */
export function placePath(
  library: LayoutLibrary,
  layoutId: LayoutId | null,
  myPlace: string
): string[] {
  const entry = layoutId ? library.entries.find((e) => e.id === layoutId) : undefined;
  if (!entry) return [];
  const folders = folderPath(library, entryFolderId(library, entry));
  const names = folders.map((folder) => folder.name);
  return folders[0]?.kind === 'place' ? names : [myPlace, ...names];
}
