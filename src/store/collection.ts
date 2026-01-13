/**
 * Collection Store
 *
 * Manages collection membership, sync state, and active collection data.
 * Collections enable real-time collaboration on layouts without user accounts.
 *
 * Architecture:
 * - Memberships: Which collections this device has joined (localStorage)
 * - Active Collection: Currently viewed collection metadata
 * - Active Collection Layouts: Layout list for the active collection
 * - Sync States: Per-layout timestamps for optimistic concurrency control
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Layout,
  Collection,
  CollectionLayoutRef,
  CollectionMembership,
  LayoutSyncState,
} from '../types';
import * as collectionApi from '../api/collection';
import type {
  CollectionErrorResponse,
  CreateCollectionResponse,
  FetchCollectionResponse,
} from '../api/collection';
import {
  saveCollectionMemberships,
  loadCollectionMemberships,
} from '../utils/storage';

// ============================================================================
// Types
// ============================================================================

export type LoadingState = 'idle' | 'loading' | 'syncing' | 'error';

export type CollectionResult<T> =
  | { success: true; data: T }
  | { success: false; error: CollectionErrorResponse };

/**
 * Pending collection invite - shown when user visits a collection URL directly.
 * Lets user preview collection info before joining.
 */
export interface PendingCollectionInvite {
  collectionId: string;
  viewOnly: boolean;
  // Fetched collection info (null while loading, undefined if failed)
  collectionInfo?: {
    name: string;
    layoutCount: number;
    expiresAt: number;
  } | null;
  error?: string;
}

interface CollectionState {
  // Local membership tracking
  memberships: CollectionMembership[];

  // Active collection state
  activeCollection: Collection | null;
  activeCollectionLayouts: CollectionLayoutRef[];

  // Sync state per layout
  syncStates: Record<string, LayoutSyncState>;

  // Pending invite (when visiting collection URL directly)
  pendingInvite: PendingCollectionInvite | null;

  // Loading/error state
  loadingState: LoadingState;
  error: string | null;

  // ========== Membership Operations ==========
  initMemberships: () => void;
  addMembership: (membership: CollectionMembership) => void;
  removeMembership: (collectionId: string) => void;
  updateMembershipAccess: (collectionId: string) => void;
  setMembershipActiveLayout: (collectionId: string, layoutId: string) => void;
  getRecentMemberships: (count: number) => CollectionMembership[];
  getMembership: (collectionId: string) => CollectionMembership | undefined;

  // ========== Sync State Operations ==========
  setSyncState: (layoutId: string, state: LayoutSyncState) => void;
  getSyncState: (layoutId: string) => LayoutSyncState | undefined;
  markLayoutModified: (layoutId: string) => void;
  clearLocalModification: (layoutId: string) => void;
  hasLocalChanges: (layoutId: string) => boolean;

  // ========== Active Collection Operations ==========
  setActiveCollection: (collection: Collection) => void;
  clearActiveCollection: () => void;
  setActiveCollectionLayouts: (layouts: CollectionLayoutRef[]) => void;
  updateActiveCollectionLayout: (
    layoutId: string,
    updates: Partial<CollectionLayoutRef>
  ) => void;
  removeActiveCollectionLayout: (layoutId: string) => void;

  // ========== Loading State ==========
  setLoadingState: (state: LoadingState) => void;
  setError: (error: string | null) => void;

  // ========== Pending Invite Operations ==========
  setPendingInvite: (collectionId: string, viewOnly: boolean) => Promise<void>;
  clearPendingInvite: () => void;
  acceptPendingInvite: () => Promise<CollectionResult<FetchCollectionResponse>>;

  // ========== API Operations ==========
  joinCollection: (collectionId: string) => Promise<CollectionResult<FetchCollectionResponse>>;
  createNewCollection: (
    name: string,
    initialLayout?: Layout
  ) => Promise<CollectionResult<CreateCollectionResponse>>;
  syncLayout: (
    layoutId: string,
    layout: Layout,
    options?: { name?: string }
  ) => Promise<CollectionResult<{ modifiedAt: number }>>;
  addLayoutToCollection: (
    layout: Layout
  ) => Promise<CollectionResult<collectionApi.AddLayoutResponse>>;
  deleteLayoutFromCollection: (
    layoutId: string
  ) => Promise<CollectionResult<collectionApi.DeleteResponse>>;
  leaveCollection: () => void;

  // ========== Computed Helpers ==========
  isInCollectionMode: () => boolean;
  getLayoutCount: () => number;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useCollectionStore = create<CollectionState>()(
  immer((set, get) => ({
    // Initial state
    memberships: [],
    activeCollection: null,
    activeCollectionLayouts: [],
    syncStates: {},
    pendingInvite: null,
    loadingState: 'idle',
    error: null,

    // ========== Membership Operations ==========

    initMemberships: () => {
      const memberships = loadCollectionMemberships();
      set({ memberships });
    },

    addMembership: (membership) => {
      set((state) => {
        const existingIndex = state.memberships.findIndex(
          (m) => m.collectionId === membership.collectionId
        );

        if (existingIndex >= 0) {
          // Update existing membership
          state.memberships[existingIndex] = membership;
        } else {
          // Add new membership
          state.memberships.push(membership);
        }
      });
      // Persist after update
      saveCollectionMemberships(get().memberships);
    },

    removeMembership: (collectionId) => {
      set((state) => {
        state.memberships = state.memberships.filter(
          (m) => m.collectionId !== collectionId
        );
      });
      // Persist after update
      saveCollectionMemberships(get().memberships);
    },

    updateMembershipAccess: (collectionId) => {
      set((state) => {
        const membership = state.memberships.find(
          (m) => m.collectionId === collectionId
        );
        if (membership) {
          membership.lastAccessedAt = Date.now();
        }
      });
      // Persist after update
      saveCollectionMemberships(get().memberships);
    },

    setMembershipActiveLayout: (collectionId, layoutId) => {
      set((state) => {
        const membership = state.memberships.find(
          (m) => m.collectionId === collectionId
        );
        if (membership) {
          membership.activeLayoutId = layoutId;
          membership.lastAccessedAt = Date.now();
        }
      });
      // Persist after update
      saveCollectionMemberships(get().memberships);
    },

    getRecentMemberships: (count) => {
      const { memberships } = get();
      return [...memberships]
        .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
        .slice(0, count);
    },

    getMembership: (collectionId) => {
      return get().memberships.find((m) => m.collectionId === collectionId);
    },

    // ========== Sync State Operations ==========

    setSyncState: (layoutId, syncState) => {
      set((state) => {
        state.syncStates[layoutId] = syncState;
      });
    },

    getSyncState: (layoutId) => {
      return get().syncStates[layoutId];
    },

    markLayoutModified: (layoutId) => {
      set((state) => {
        const existing = state.syncStates[layoutId];
        if (existing) {
          existing.localModifiedAt = Date.now();
        }
      });
    },

    clearLocalModification: (layoutId) => {
      set((state) => {
        const existing = state.syncStates[layoutId];
        if (existing) {
          existing.localModifiedAt = undefined;
        }
      });
    },

    hasLocalChanges: (layoutId) => {
      const state = get().syncStates[layoutId];
      return state?.localModifiedAt !== undefined;
    },

    // ========== Active Collection Operations ==========

    setActiveCollection: (collection) => {
      set({ activeCollection: collection });
    },

    clearActiveCollection: () => {
      set({
        activeCollection: null,
        activeCollectionLayouts: [],
        syncStates: {},
      });
    },

    setActiveCollectionLayouts: (layouts) => {
      set({ activeCollectionLayouts: layouts });
    },

    updateActiveCollectionLayout: (layoutId, updates) => {
      set((state) => {
        const layout = state.activeCollectionLayouts.find((l) => l.id === layoutId);
        if (layout) {
          Object.assign(layout, updates);
        }
      });
    },

    removeActiveCollectionLayout: (layoutId) => {
      set((state) => {
        state.activeCollectionLayouts = state.activeCollectionLayouts.filter(
          (l) => l.id !== layoutId
        );
        if (state.activeCollection) {
          state.activeCollection.layoutCount = state.activeCollectionLayouts.length;
        }
        // Remove sync state for this layout by filtering
        const { [layoutId]: _removed, ...remaining } = state.syncStates;
        state.syncStates = remaining;
      });
    },

    // ========== Loading State ==========

    setLoadingState: (loadingState) => {
      set({ loadingState });
    },

    setError: (error) => {
      set({ error, loadingState: error ? 'error' : 'idle' });
    },

    // ========== Pending Invite Operations ==========

    setPendingInvite: async (collectionId, viewOnly) => {
      // Set pending invite with loading state
      set({
        pendingInvite: {
          collectionId,
          viewOnly,
          collectionInfo: null, // null means loading
        },
      });

      // Fetch collection info for preview
      const result = await collectionApi.fetchCollection(collectionId);

      if (result.success) {
        set((state) => {
          if (state.pendingInvite?.collectionId === collectionId) {
            state.pendingInvite.collectionInfo = {
              name: result.data.name,
              layoutCount: result.data.layoutCount,
              expiresAt: result.data.expiresAt,
            };
          }
        });
      } else {
        set((state) => {
          if (state.pendingInvite?.collectionId === collectionId) {
            state.pendingInvite.collectionInfo = undefined;
            state.pendingInvite.error = result.error.error;
          }
        });
      }
    },

    clearPendingInvite: () => {
      set({ pendingInvite: null });
    },

    acceptPendingInvite: async () => {
      const { pendingInvite, joinCollection } = get();

      if (!pendingInvite) {
        return {
          success: false,
          error: {
            error: 'No pending invite',
            code: 'VALIDATION_ERROR' as const,
          },
        };
      }

      const result = await joinCollection(pendingInvite.collectionId);

      if (result.success) {
        set({ pendingInvite: null });
      }

      return result;
    },

    // ========== API Operations ==========

    joinCollection: async (collectionId) => {
      set({ loadingState: 'loading', error: null });

      const result = await collectionApi.fetchCollection(collectionId);

      if (!result.success) {
        set({ loadingState: 'error', error: result.error.error });
        return result;
      }

      const { data } = result;
      const now = Date.now();

      // Create membership
      const membership: CollectionMembership = {
        collectionId: data.id,
        collectionName: data.name,
        joinedAt: now,
        lastSyncAt: now,
        lastAccessedAt: now,
      };

      // Initialize sync states for all layouts
      const syncStates: Record<string, LayoutSyncState> = {};
      for (const layout of data.layouts) {
        syncStates[layout.id] = {
          modifiedAt: layout.modifiedAt,
          lastSyncAt: now,
        };
      }

      set((state) => {
        // Add/update membership
        const existingIndex = state.memberships.findIndex(
          (m) => m.collectionId === collectionId
        );
        if (existingIndex >= 0) {
          state.memberships[existingIndex] = membership;
        } else {
          state.memberships.push(membership);
        }

        // Set active collection
        state.activeCollection = {
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          modifiedAt: data.modifiedAt,
          expiresAt: data.expiresAt,
          layoutCount: data.layoutCount,
        };
        state.activeCollectionLayouts = data.layouts;
        state.syncStates = syncStates;
        state.loadingState = 'idle';
        state.error = null;
      });

      // Persist memberships after update
      saveCollectionMemberships(get().memberships);

      return result;
    },

    createNewCollection: async (name, initialLayout) => {
      set({ loadingState: 'loading', error: null });

      const result = await collectionApi.createCollection(name, initialLayout);

      if (!result.success) {
        set({ loadingState: 'error', error: result.error.error });
        return result;
      }

      const { data } = result;
      const now = Date.now();

      // Create membership
      const membership: CollectionMembership = {
        collectionId: data.id,
        collectionName: data.name,
        joinedAt: now,
        lastSyncAt: now,
        lastAccessedAt: now,
      };

      // Initialize sync states for any initial layouts
      const syncStates: Record<string, LayoutSyncState> = {};
      for (const layout of data.layouts) {
        syncStates[layout.id] = {
          modifiedAt: layout.modifiedAt,
          lastSyncAt: now,
        };
      }

      set((state) => {
        state.memberships.push(membership);
        state.activeCollection = {
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          modifiedAt: data.createdAt,
          expiresAt: data.expiresAt,
          layoutCount: data.layouts.length,
        };
        state.activeCollectionLayouts = data.layouts;
        state.syncStates = syncStates;
        state.loadingState = 'idle';
        state.error = null;
      });

      // Persist memberships after update
      saveCollectionMemberships(get().memberships);

      return result;
    },

    syncLayout: async (layoutId, layout, options) => {
      const { activeCollection, syncStates } = get();

      if (!activeCollection) {
        return {
          success: false,
          error: {
            error: 'No active collection',
            code: 'VALIDATION_ERROR' as const,
          },
        };
      }

      const currentSyncState = syncStates[layoutId];

      set({ loadingState: 'syncing' });

      const result = await collectionApi.updateLayout(
        activeCollection.id,
        layoutId,
        layout,
        {
          expectedModifiedAt: currentSyncState?.modifiedAt,
          name: options?.name,
        }
      );

      if (!result.success) {
        set({ loadingState: 'idle' });
        return result;
      }

      // Update sync state with new server timestamp
      set((state) => {
        state.syncStates[layoutId] = {
          modifiedAt: result.data.modifiedAt,
          lastSyncAt: Date.now(),
          // Clear local modification since we've synced
        };
        state.loadingState = 'idle';
      });

      return result;
    },

    addLayoutToCollection: async (layout) => {
      const { activeCollection } = get();

      if (!activeCollection) {
        return {
          success: false,
          error: {
            error: 'No active collection',
            code: 'VALIDATION_ERROR' as const,
          },
        };
      }

      set({ loadingState: 'syncing' });

      const result = await collectionApi.addLayout(activeCollection.id, layout);

      if (!result.success) {
        set({ loadingState: 'idle' });
        return result;
      }

      const now = Date.now();

      // Add the new layout to local state
      set((state) => {
        const newLayoutRef: CollectionLayoutRef = {
          id: result.data.id,
          name: result.data.name,
          modifiedAt: result.data.modifiedAt,
          preview: result.data.preview,
        };
        state.activeCollectionLayouts.push(newLayoutRef);

        if (state.activeCollection) {
          state.activeCollection.layoutCount = state.activeCollectionLayouts.length;
        }

        // Initialize sync state for the new layout
        state.syncStates[result.data.id] = {
          modifiedAt: result.data.modifiedAt,
          lastSyncAt: now,
        };

        state.loadingState = 'idle';
      });

      return result;
    },

    deleteLayoutFromCollection: async (layoutId) => {
      const { activeCollection, activeCollectionLayouts } = get();

      if (!activeCollection) {
        return {
          success: false,
          error: {
            error: 'No active collection',
            code: 'VALIDATION_ERROR' as const,
          },
        };
      }

      // Check if this is the last layout
      if (activeCollectionLayouts.length <= 1) {
        return {
          success: false,
          error: {
            error: 'Cannot delete the last layout in a collection',
            code: 'VALIDATION_ERROR' as const,
          },
        };
      }

      set({ loadingState: 'syncing' });

      const result = await collectionApi.deleteLayout(activeCollection.id, layoutId);

      if (!result.success) {
        set({ loadingState: 'idle' });
        return result;
      }

      // Remove the layout from local state
      set((state) => {
        state.activeCollectionLayouts = state.activeCollectionLayouts.filter(
          (l) => l.id !== layoutId
        );

        if (state.activeCollection) {
          state.activeCollection.layoutCount = state.activeCollectionLayouts.length;
        }

        // Remove sync state using destructuring to avoid dynamic delete lint error
        const { [layoutId]: _removed, ...remainingSyncStates } = state.syncStates;
        state.syncStates = remainingSyncStates;

        state.loadingState = 'idle';
      });

      return result;
    },

    leaveCollection: () => {
      const { activeCollection, removeMembership, clearActiveCollection } = get();

      if (activeCollection) {
        removeMembership(activeCollection.id);
      }
      clearActiveCollection();
    },

    // ========== Computed Helpers ==========

    isInCollectionMode: () => {
      return get().activeCollection !== null;
    },

    getLayoutCount: () => {
      return get().activeCollectionLayouts.length;
    },
  }))
);
