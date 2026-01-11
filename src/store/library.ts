import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { LayoutLibrary, LayoutEntry, LayoutPreview, Layout, OperationResult, ThumbnailBin, CloudShareInfo, ShareExpiration } from '../types';
import { CONSTRAINTS, STAGING_ID } from '../constants';
import { generateUUID } from '../utils/uuid';

/**
 * Compute preview data from a layout for display in the library.
 * Includes a binMap for thumbnail rendering (top-down view of all bins).
 */
export function computePreview(layout: Layout): LayoutPreview {
  // Build category color lookup
  const categoryColors = new Map<string, string>();
  for (const cat of layout.categories) {
    categoryColors.set(cat.id, cat.color);
  }

  // Generate bin map for thumbnail (exclude staged bins)
  const binMap: ThumbnailBin[] = layout.bins
    .filter(bin => bin.layerId !== STAGING_ID)
    .map(bin => ({
      x: bin.x,
      y: bin.y,
      w: bin.width,
      d: bin.depth,
      c: categoryColors.get(bin.category) || '#6B7280', // fallback gray
    }));

  return {
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
    drawerHeight: layout.drawer.height,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    binMap,
  };
}

/**
 * Create a default empty library with one default layout entry.
 */
export function createDefaultLibrary(initialLayoutId: string, initialLayoutName: string): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: initialLayoutId,
    settings: {},
    entries: [{
      id: initialLayoutId,
      name: initialLayoutName,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      },
    }],
  };
}

interface LibraryState {
  library: LayoutLibrary;
  isLoaded: boolean;
  showLayoutManager: boolean;

  // Initialize library
  initLibrary: (library: LayoutLibrary) => void;

  // Replace library (for cross-tab sync)
  setLibrary: (library: LayoutLibrary) => void;

  // Entry CRUD (pure library operations, no cross-store mutations)
  createEntry: (name: string, layoutId: string, preview: LayoutPreview, author?: string) => LayoutEntry;
  deleteEntry: (id: string) => OperationResult;
  updateEntry: (id: string, updates: Partial<Omit<LayoutEntry, 'id'>>) => void;
  duplicateEntry: (sourceEntry: LayoutEntry, newLayoutId: string) => LayoutEntry;

  // Query
  getEntry: (id: string) => LayoutEntry | undefined;
  getRecentEntries: (count: number) => LayoutEntry[];

  // Active layout (just updates the library index, not the actual layout)
  setActiveLayoutId: (id: string) => void;

  // Settings
  setAuthorName: (name: string) => void;
  setLastShareExpiration: (days: ShareExpiration) => void;

  // Cloud sharing
  setCloudShare: (layoutId: string, share: CloudShareInfo) => void;
  clearCloudShare: (layoutId: string) => void;

  // UI state
  setShowLayoutManager: (show: boolean) => void;
}

export const useLibraryStore = create<LibraryState>()(
  immer((set, get) => ({
    library: createDefaultLibrary(generateUUID(), 'Untitled layout'),
    isLoaded: false,
    showLayoutManager: false,

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

      set(state => {
        state.library.entries.push(entry);
      });

      return entry;
    },

    deleteEntry: (id) => {
      const { library } = get();

      // Can't delete last layout
      if (library.entries.length <= 1) {
        return { success: false, error: 'Cannot delete the only layout' };
      }

      // Can't delete if at limit warning threshold would be violated
      // (This is just for soft limits, not hard enforcement)

      set(state => {
        state.library.entries = state.library.entries.filter(e => e.id !== id);

        // If deleting active layout, switch to first remaining
        if (state.library.activeLayoutId === id) {
          state.library.activeLayoutId = state.library.entries[0].id;
        }
      });

      return { success: true };
    },

    updateEntry: (id, updates) => {
      set(state => {
        const entry = state.library.entries.find(e => e.id === id);
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

      set(state => {
        state.library.entries.push(newEntry);
      });

      return newEntry;
    },

    getEntry: (id) => {
      return get().library.entries.find(e => e.id === id);
    },

    getRecentEntries: (count) => {
      const { entries } = get().library;
      return [...entries]
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .slice(0, count);
    },

    setActiveLayoutId: (id) => {
      set(state => {
        state.library.activeLayoutId = id;
      });
    },

    setAuthorName: (name) => {
      set(state => {
        state.library.settings.authorName = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
      });
    },

    setLastShareExpiration: (days) => {
      set(state => {
        state.library.settings.lastShareExpiration = days;
      });
    },

    setCloudShare: (layoutId, share) => {
      set(state => {
        const entry = state.library.entries.find(e => e.id === layoutId);
        if (entry) {
          entry.cloudShare = share;
        }
      });
    },

    clearCloudShare: (layoutId) => {
      set(state => {
        const entry = state.library.entries.find(e => e.id === layoutId);
        if (entry) {
          entry.cloudShare = undefined;
        }
      });
    },

    setShowLayoutManager: (show) => {
      set({ showLayoutManager: show });
    },
  }))
);
