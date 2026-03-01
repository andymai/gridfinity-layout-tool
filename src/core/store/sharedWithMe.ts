/**
 * Store for "Shared with me" layouts.
 *
 * Manages the list of layouts other users have shared with the current user.
 * This state is persisted separately from the main library (localStorage via
 * SharedWithMeService) and has an independent lifecycle.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SharedWithMeEntry, SharePermission, LayoutPreview } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { saveSharedWithMe } from '@/core/storage/SharedWithMeService';

/** Mutable fields on SharedWithMeEntry (excludes id, sourceShareId, addedAt). */
type SharedWithMeUpdates = Partial<
  Pick<
    SharedWithMeEntry,
    'name' | 'authorName' | 'permission' | 'lastAccessedAt' | 'preview' | 'status'
  >
>;

interface SharedWithMeState {
  entries: SharedWithMeEntry[];
  isLoaded: boolean;

  init: (entries: SharedWithMeEntry[]) => void;
  add: (entry: {
    sourceShareId: string;
    name: string;
    authorName?: string;
    permission: SharePermission;
    preview?: LayoutPreview;
  }) => SharedWithMeEntry;
  update: (id: string, updates: SharedWithMeUpdates) => void;
  remove: (id: string) => void;
  getByShareId: (shareId: string) => SharedWithMeEntry | undefined;
  markAccessed: (shareId: string) => void;
}

export const useSharedWithMeStore = create<SharedWithMeState>()(
  immer((set, get) => ({
    entries: [],
    isLoaded: false,

    init: (entries) => {
      set({ entries, isLoaded: true });
    },

    add: (entry) => {
      const newEntry: SharedWithMeEntry = {
        id: crypto.randomUUID(),
        sourceShareId: entry.sourceShareId,
        name: entry.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
        authorName: entry.authorName,
        permission: entry.permission,
        addedAt: Date.now(),
        lastAccessedAt: Date.now(),
        preview: entry.preview,
        status: 'available',
      };

      set((state) => {
        state.entries.push(newEntry);
      });

      saveSharedWithMe(get().entries);

      return newEntry;
    },

    update: (id, updates) => {
      let didUpdate = false;

      set((state) => {
        const entry = state.entries.find((e) => e.id === id);
        if (!entry) return;

        didUpdate = true;
        if (updates.name !== undefined) {
          entry.name = updates.name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
        }
        if (updates.authorName !== undefined) {
          entry.authorName = updates.authorName;
        }
        if (updates.permission !== undefined) {
          entry.permission = updates.permission;
        }
        if (updates.lastAccessedAt !== undefined) {
          entry.lastAccessedAt = updates.lastAccessedAt;
        }
        if (updates.preview !== undefined) {
          entry.preview = updates.preview;
        }
        if (updates.status !== undefined) {
          entry.status = updates.status;
        }
      });

      if (didUpdate) {
        saveSharedWithMe(get().entries);
      }
    },

    remove: (id) => {
      set((state) => {
        state.entries = state.entries.filter((e) => e.id !== id);
      });

      saveSharedWithMe(get().entries);
    },

    getByShareId: (shareId) => {
      return get().entries.find((e) => e.sourceShareId === shareId);
    },

    markAccessed: (shareId) => {
      let didUpdate = false;

      set((state) => {
        const entry = state.entries.find((e) => e.sourceShareId === shareId);
        if (entry) {
          entry.lastAccessedAt = Date.now();
          didUpdate = true;
        }
      });

      if (didUpdate) {
        saveSharedWithMe(get().entries);
      }
    },
  }))
);

export const INITIAL_SHARED_WITH_ME_STATE: Pick<SharedWithMeState, 'entries' | 'isLoaded'> = {
  entries: [],
  isLoaded: false,
};
