import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  LayoutLibrary,
  LayoutEntry,
  LayoutPreview,
  CloudShareInfo,
  NameSuggestionState,
  LayoutId,
} from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import { CONSTRAINTS, getDefaultDrawerSize } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import type { Result, Unit, LayoutError } from '@/core/result';
import { err, layoutLastEntity, OK, isErr } from '@/core/result';
import { saveLibrary } from '@/core/storage';

/**
 * Persist library in the background, logging on failure.
 * Replaces bare `void saveLibrary()` calls that silently dropped errors.
 */
function persistLibrary(library: LayoutLibrary): void {
  void saveLibrary(library).then((result) => {
    if (isErr(result)) {
      console.warn('[library] Background save failed:', result.error.code, result.error.message);
    }
  });
}

// Re-export computePreview for backward compatibility with existing imports
export { computePreview } from '@/core/storage';

/**
 * Create a default empty library with one default layout entry.
 */
export function createDefaultLibrary(
  initialLayoutId: LayoutId,
  initialLayoutName: string
): LayoutLibrary {
  const drawer = getDefaultDrawerSize();
  return {
    version: '1.0',
    activeLayoutId: initialLayoutId,
    settings: {},
    entries: [
      {
        id: initialLayoutId,
        name: initialLayoutName,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: gridUnits(drawer.width),
          drawerDepth: gridUnits(drawer.depth),
          drawerHeight: heightUnits(drawer.height),
          binCount: 0,
          layerCount: 1,
        },
      },
    ],
  };
}

interface LibraryState {
  library: LayoutLibrary;
  isLoaded: boolean;

  initLibrary: (library: LayoutLibrary) => void;
  setLibrary: (library: LayoutLibrary) => void;

  createEntry: (
    name: string,
    layoutId: LayoutId,
    preview: LayoutPreview,
    author?: string
  ) => LayoutEntry;
  deleteEntry: (id: LayoutId) => Result<Unit, LayoutError>;
  updateEntry: (id: LayoutId, updates: Partial<Omit<LayoutEntry, 'id'>>) => void;
  duplicateEntry: (sourceEntry: LayoutEntry, newLayoutId: LayoutId) => LayoutEntry;

  getEntry: (id: LayoutId) => LayoutEntry | undefined;
  getRecentEntries: (count: number) => LayoutEntry[];

  setActiveLayoutId: (id: LayoutId) => void;

  setAuthorName: (name: string) => void;

  setCloudShare: (layoutId: LayoutId, share: CloudShareInfo) => void;
  clearCloudShare: (layoutId: LayoutId) => void;

  // Name suggestion state actions
  setNameSuggestionDismissed: (layoutId: LayoutId, dismissed: boolean) => void;
  clearNameSuggestionState: (layoutId: LayoutId) => void;
  getNameSuggestionState: (layoutId: LayoutId) => NameSuggestionState | undefined;
}

/**
 * Library store — manages the multi-layout library index.
 * Tracks `activeLayoutId`, layout entries (metadata + thumbnails), and sorting.
 * Persisted to IndexedDB via {@link saveLibrary}. A small breadcrumb
 * (active layout ID) is kept in localStorage (`gridfinity-library-v1`).
 */
export const useLibraryStore = create<LibraryState>()(
  immer((set, get) => ({
    library: createDefaultLibrary(generateLayoutId(), 'Untitled layout'),
    isLoaded: false,

    initLibrary: (library) => {
      set({ library, isLoaded: true });
    },

    setLibrary: (library) => {
      set({ library });
    },

    createEntry: (name, layoutId, preview, author) => {
      const entry: LayoutEntry = {
        id: layoutId,
        name: name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        author: author || get().library.settings.authorName,
        preview,
      };

      set((state) => {
        state.library.entries.push(entry);
      });

      return entry;
    },

    deleteEntry: (id) => {
      const { library } = get();

      // Can't delete last layout
      if (library.entries.length <= 1) {
        return err(layoutLastEntity('layout'));
      }

      set((state) => {
        state.library.entries = state.library.entries.filter((e) => e.id !== id);

        // If deleting active layout, switch to first remaining
        if (state.library.activeLayoutId === id) {
          state.library.activeLayoutId = state.library.entries[0].id;
        }
      });

      return OK;
    },

    updateEntry: (id, updates) => {
      set((state) => {
        const entry = state.library.entries.find((e) => e.id === id);
        if (entry) {
          if (updates.name !== undefined) {
            entry.name = updates.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
          }
          if (updates.modifiedAt !== undefined) {
            entry.modifiedAt = updates.modifiedAt;
          }
          if (updates.preview !== undefined) {
            entry.preview = updates.preview;
          }
          if (updates.author !== undefined) {
            entry.author = updates.author;
          }
          if (updates.forkedFrom !== undefined) {
            entry.forkedFrom = updates.forkedFrom;
          }
        }
      });
    },

    duplicateEntry: (sourceEntry, newLayoutId) => {
      const newEntry: LayoutEntry = {
        id: newLayoutId,
        name: `${sourceEntry.name} (copy)`.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        author: get().library.settings.authorName,
        preview: { ...sourceEntry.preview },
      };

      set((state) => {
        state.library.entries.push(newEntry);
      });

      return newEntry;
    },

    getEntry: (id) => {
      return get().library.entries.find((e) => e.id === id);
    },

    getRecentEntries: (count) => {
      const { entries } = get().library;
      return [...entries].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, count);
    },

    setActiveLayoutId: (id) => {
      set((state) => {
        state.library.activeLayoutId = id;
      });
    },

    setAuthorName: (name) => {
      set((state) => {
        state.library.settings.authorName = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
      });
    },

    setCloudShare: (layoutId, share) => {
      set((state) => {
        const entry = state.library.entries.find((e) => e.id === layoutId);
        if (entry) {
          entry.cloudShare = share;
        }
      });
      // Persist library immediately so cloudShare survives refresh
      persistLibrary(get().library);
    },

    clearCloudShare: (layoutId) => {
      set((state) => {
        const entry = state.library.entries.find((e) => e.id === layoutId);
        if (entry) {
          entry.cloudShare = undefined;
        }
      });
      // Persist library immediately
      persistLibrary(get().library);
    },

    // === Name suggestion state actions ===

    setNameSuggestionDismissed: (layoutId, dismissed) => {
      set((state) => {
        const entry = state.library.entries.find((e) => e.id === layoutId);
        if (entry) {
          if (dismissed) {
            // Set or increment dismiss state
            entry.nameSuggestionState = {
              dismissed: true,
              dismissedAt: Date.now(),
              dismissCount: (entry.nameSuggestionState?.dismissCount ?? 0) + 1,
            };
          } else {
            // Clear dismiss state
            entry.nameSuggestionState = undefined;
          }
        }
      });
      // Persist library immediately so dismiss state survives refresh
      persistLibrary(get().library);
    },

    clearNameSuggestionState: (layoutId) => {
      set((state) => {
        const entry = state.library.entries.find((e) => e.id === layoutId);
        if (entry) {
          entry.nameSuggestionState = undefined;
        }
      });
      // Persist library immediately
      persistLibrary(get().library);
    },

    getNameSuggestionState: (layoutId) => {
      const entry = get().library.entries.find((e) => e.id === layoutId);
      return entry?.nameSuggestionState;
    },
  }))
);
