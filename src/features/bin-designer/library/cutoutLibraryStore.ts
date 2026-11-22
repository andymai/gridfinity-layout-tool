/**
 * The library as the UI shows it: every item and folder, reloaded whenever the
 * store underneath changes, a pull from another device included.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { listFolders, listItems } from './CutoutLibraryService';
import { subscribeChanges } from './libraryEvents';
import type { CutoutLibraryFolder, CutoutLibraryItem } from './libraryTypes';

interface CutoutLibraryState {
  readonly items: readonly CutoutLibraryItem[];
  readonly folders: readonly CutoutLibraryFolder[];
  readonly loaded: boolean;
  readonly reload: () => Promise<void>;
}

export const useCutoutLibraryStore = create<CutoutLibraryState>((set) => ({
  items: [],
  folders: [],
  loaded: false,
  reload: async () => {
    try {
      const [items, folders] = await Promise.all([listItems(), listFolders()]);
      set({ items, folders, loaded: true });
    } catch {
      // A failed read keeps what is shown; the next change tries again.
      set({ loaded: true });
    }
  },
}));

/** Load the library once something shows it, and keep it current while it does. */
export function useCutoutLibrary(): Pick<CutoutLibraryState, 'items' | 'folders' | 'loaded'> {
  const items = useCutoutLibraryStore((s) => s.items);
  const folders = useCutoutLibraryStore((s) => s.folders);
  const loaded = useCutoutLibraryStore((s) => s.loaded);
  useEffect(() => {
    const { reload } = useCutoutLibraryStore.getState();
    void reload();
    return subscribeChanges(() => void reload());
  }, []);
  return { items, folders, loaded };
}
