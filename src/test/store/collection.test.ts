/**
 * Tests for collection store.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useCollectionStore } from '../../store/collection';
import type { Layout, CollectionMembership, LayoutSyncState } from '../../types';
import * as collectionApi from '../../api/collection';
import * as storage from '../../utils/storage';

// Mock the API module
vi.mock('../../api/collection');

// Mock storage functions
vi.mock('../../utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof storage>();
  return {
    ...actual,
    saveCollectionMemberships: vi.fn(),
    loadCollectionMemberships: vi.fn(() => []),
  };
});

// Test fixtures
const mockLayout: Layout = {
  name: 'Test Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  bins: [],
  layers: [{ id: 'layer-1', name: 'Base', height: 3 }],
  categories: [{ id: 'cat-1', name: 'Default', color: '#3b82f6' }],
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
};

const mockMembership: CollectionMembership = {
  collectionId: 'abc123def456',
  collectionName: 'Test Collection',
  joinedAt: Date.now() - 1000,
  lastSyncAt: Date.now() - 500,
  lastAccessedAt: Date.now(),
};

const mockCollectionResponse = {
  id: 'abc123def456',
  name: 'Test Collection',
  createdAt: Date.now() - 5000,
  modifiedAt: Date.now() - 1000,
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  layoutCount: 1,
  layouts: [
    {
      id: 'layout-uuid-1',
      name: 'Test Layout',
      modifiedAt: Date.now() - 1000,
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      },
    },
  ],
};

describe('Collection Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCollectionStore.setState({
      memberships: [],
      activeCollection: null,
      activeCollectionLayouts: [],
      syncStates: {},
      loadingState: 'idle',
      error: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Membership Management', () => {
    it('should add a membership', () => {
      const { addMembership } = useCollectionStore.getState();

      addMembership(mockMembership);

      const updated = useCollectionStore.getState().memberships;
      expect(updated).toHaveLength(1);
      expect(updated[0].collectionId).toBe('abc123def456');
    });

    it('should not duplicate memberships', () => {
      const { addMembership } = useCollectionStore.getState();

      addMembership(mockMembership);
      addMembership(mockMembership);

      const { memberships } = useCollectionStore.getState();
      expect(memberships).toHaveLength(1);
    });

    it('should update existing membership on re-add', () => {
      const { addMembership } = useCollectionStore.getState();

      addMembership(mockMembership);
      const newAccess = Date.now() + 1000;
      addMembership({ ...mockMembership, lastAccessedAt: newAccess });

      const { memberships } = useCollectionStore.getState();
      expect(memberships).toHaveLength(1);
      expect(memberships[0].lastAccessedAt).toBe(newAccess);
    });

    it('should remove a membership', () => {
      const { addMembership, removeMembership } = useCollectionStore.getState();

      addMembership(mockMembership);
      removeMembership('abc123def456');

      const { memberships } = useCollectionStore.getState();
      expect(memberships).toHaveLength(0);
    });

    it('should get memberships sorted by recency', () => {
      const { addMembership } = useCollectionStore.getState();

      const older: CollectionMembership = {
        ...mockMembership,
        collectionId: 'older123',
        lastAccessedAt: Date.now() - 10000,
      };
      const newer: CollectionMembership = {
        ...mockMembership,
        collectionId: 'newer123',
        lastAccessedAt: Date.now(),
      };

      addMembership(older);
      addMembership(newer);

      const recent = useCollectionStore.getState().getRecentMemberships(2);
      expect(recent[0].collectionId).toBe('newer123');
      expect(recent[1].collectionId).toBe('older123');
    });

    it('should update membership access time', () => {
      const { addMembership, updateMembershipAccess } = useCollectionStore.getState();

      // Create membership with an older access time
      const olderMembership = {
        ...mockMembership,
        lastAccessedAt: Date.now() - 10000, // 10 seconds ago
      };
      addMembership(olderMembership);
      const before = useCollectionStore.getState().memberships[0].lastAccessedAt;

      updateMembershipAccess('abc123def456');

      const after = useCollectionStore.getState().memberships[0].lastAccessedAt;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('Sync State Tracking', () => {
    it('should set sync state for a layout', () => {
      const { setSyncState } = useCollectionStore.getState();
      const syncState: LayoutSyncState = {
        modifiedAt: Date.now(),
        lastSyncAt: Date.now(),
      };

      setSyncState('layout-uuid-1', syncState);

      const { syncStates } = useCollectionStore.getState();
      expect(syncStates['layout-uuid-1']).toEqual(syncState);
    });

    it('should get sync state for a layout', () => {
      const { setSyncState } = useCollectionStore.getState();
      const syncState: LayoutSyncState = {
        modifiedAt: Date.now(),
        localModifiedAt: Date.now() - 100,
        lastSyncAt: Date.now() - 50,
      };

      setSyncState('layout-uuid-1', syncState);
      const retrieved = useCollectionStore.getState().getSyncState('layout-uuid-1');

      expect(retrieved).toEqual(syncState);
    });

    it('should return undefined for unknown layout', () => {
      const { getSyncState } = useCollectionStore.getState();
      const result = getSyncState('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should mark layout as locally modified', () => {
      const { setSyncState, markLayoutModified } = useCollectionStore.getState();

      // First set initial sync state
      setSyncState('layout-uuid-1', {
        modifiedAt: Date.now() - 1000,
        lastSyncAt: Date.now() - 500,
      });

      markLayoutModified('layout-uuid-1');

      const state = useCollectionStore.getState().getSyncState('layout-uuid-1');
      expect(state?.localModifiedAt).toBeDefined();
    });

    it('should clear local modification after sync', () => {
      const { setSyncState, markLayoutModified, clearLocalModification } = useCollectionStore.getState();

      setSyncState('layout-uuid-1', {
        modifiedAt: Date.now() - 1000,
        lastSyncAt: Date.now() - 500,
      });
      markLayoutModified('layout-uuid-1');
      clearLocalModification('layout-uuid-1');

      const state = useCollectionStore.getState().getSyncState('layout-uuid-1');
      expect(state?.localModifiedAt).toBeUndefined();
    });

    it('should check if layout has local changes', () => {
      const { setSyncState, markLayoutModified } = useCollectionStore.getState();

      setSyncState('layout-uuid-1', {
        modifiedAt: Date.now() - 1000,
        lastSyncAt: Date.now() - 500,
      });

      expect(useCollectionStore.getState().hasLocalChanges('layout-uuid-1')).toBe(false);

      markLayoutModified('layout-uuid-1');

      expect(useCollectionStore.getState().hasLocalChanges('layout-uuid-1')).toBe(true);
    });
  });

  describe('Active Collection', () => {
    it('should set active collection', () => {
      const { setActiveCollection } = useCollectionStore.getState();

      setActiveCollection({
        id: 'abc123def456',
        name: 'Test Collection',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        layoutCount: 1,
      });

      const { activeCollection } = useCollectionStore.getState();
      expect(activeCollection?.id).toBe('abc123def456');
    });

    it('should clear active collection', () => {
      const { setActiveCollection, clearActiveCollection } = useCollectionStore.getState();

      setActiveCollection({
        id: 'abc123def456',
        name: 'Test Collection',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        layoutCount: 1,
      });

      clearActiveCollection();

      const { activeCollection, activeCollectionLayouts, syncStates } =
        useCollectionStore.getState();
      expect(activeCollection).toBeNull();
      expect(activeCollectionLayouts).toHaveLength(0);
      expect(Object.keys(syncStates)).toHaveLength(0);
    });

    it('should set active collection layouts', () => {
      const { setActiveCollectionLayouts } = useCollectionStore.getState();

      setActiveCollectionLayouts(mockCollectionResponse.layouts);

      const { activeCollectionLayouts } = useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(1);
      expect(activeCollectionLayouts[0].id).toBe('layout-uuid-1');
    });

    it('should update active collection layout', () => {
      // Set up layouts
      useCollectionStore.setState({
        activeCollectionLayouts: mockCollectionResponse.layouts,
      });

      const { updateActiveCollectionLayout } = useCollectionStore.getState();
      updateActiveCollectionLayout('layout-uuid-1', { name: 'Updated Name' });

      const { activeCollectionLayouts } = useCollectionStore.getState();
      expect(activeCollectionLayouts[0].name).toBe('Updated Name');
    });

    it('should handle updating non-existent layout gracefully', () => {
      useCollectionStore.setState({
        activeCollectionLayouts: mockCollectionResponse.layouts,
      });

      const { updateActiveCollectionLayout } = useCollectionStore.getState();
      // This should not throw - it silently does nothing if layout not found
      updateActiveCollectionLayout('non-existent-id', { name: 'Updated' });

      const { activeCollectionLayouts } = useCollectionStore.getState();
      expect(activeCollectionLayouts[0].name).toBe('Test Layout');
    });

    it('should remove active collection layout', () => {
      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test Collection',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          layoutCount: 2,
        },
        activeCollectionLayouts: [
          ...mockCollectionResponse.layouts,
          { id: 'layout-2', name: 'Layout 2', modifiedAt: Date.now(), preview: { drawerWidth: 10, drawerDepth: 8, binCount: 5, layerCount: 1 } },
        ],
        syncStates: {
          'layout-uuid-1': { modifiedAt: Date.now(), lastSyncAt: Date.now() },
          'layout-2': { modifiedAt: Date.now(), lastSyncAt: Date.now() },
        },
      });

      const { removeActiveCollectionLayout } = useCollectionStore.getState();
      removeActiveCollectionLayout('layout-uuid-1');

      const { activeCollectionLayouts, syncStates, activeCollection } = useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(1);
      expect(activeCollectionLayouts[0].id).toBe('layout-2');
      expect(syncStates['layout-uuid-1']).toBeUndefined();
      expect(syncStates['layout-2']).toBeDefined();
      expect(activeCollection?.layoutCount).toBe(1);
    });

    it('should handle removing layout when no active collection', () => {
      useCollectionStore.setState({
        activeCollection: null,
        activeCollectionLayouts: mockCollectionResponse.layouts,
        syncStates: {
          'layout-uuid-1': { modifiedAt: Date.now(), lastSyncAt: Date.now() },
        },
      });

      const { removeActiveCollectionLayout } = useCollectionStore.getState();
      // Should not throw when no active collection
      removeActiveCollectionLayout('layout-uuid-1');

      const { activeCollectionLayouts, syncStates } = useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(0);
      expect(syncStates['layout-uuid-1']).toBeUndefined();
    });
  });

  describe('Loading State', () => {
    it('should set loading state', () => {
      const { setLoadingState } = useCollectionStore.getState();

      setLoadingState('loading');
      expect(useCollectionStore.getState().loadingState).toBe('loading');

      setLoadingState('syncing');
      expect(useCollectionStore.getState().loadingState).toBe('syncing');

      setLoadingState('idle');
      expect(useCollectionStore.getState().loadingState).toBe('idle');
    });

    it('should set error', () => {
      const { setError } = useCollectionStore.getState();

      setError('Something went wrong');
      expect(useCollectionStore.getState().error).toBe('Something went wrong');

      setError(null);
      expect(useCollectionStore.getState().error).toBeNull();
    });
  });

  describe('API Operations', () => {
    describe('joinCollection', () => {
      it('should join a collection and update state', async () => {
        vi.mocked(collectionApi.fetchCollection).mockResolvedValueOnce({
          success: true,
          data: mockCollectionResponse,
        });

        const { joinCollection } = useCollectionStore.getState();
        const result = await joinCollection('abc123def456');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe('abc123def456');
        }

        const { memberships, activeCollection, activeCollectionLayouts } =
          useCollectionStore.getState();
        expect(memberships).toHaveLength(1);
        expect(memberships[0].collectionId).toBe('abc123def456');
        expect(activeCollection?.id).toBe('abc123def456');
        expect(activeCollectionLayouts).toHaveLength(1);
      });

      it('should handle join failure', async () => {
        vi.mocked(collectionApi.fetchCollection).mockResolvedValueOnce({
          success: false,
          error: { error: 'Not found', code: 'NOT_FOUND' },
        });

        const { joinCollection } = useCollectionStore.getState();
        const result = await joinCollection('nonexistent');

        expect(result.success).toBe(false);

        const { memberships, activeCollection } = useCollectionStore.getState();
        expect(memberships).toHaveLength(0);
        expect(activeCollection).toBeNull();
      });

      it('should update existing membership when re-joining a collection', async () => {
        // Set up existing membership
        const oldJoinedAt = Date.now() - 86400000; // 1 day ago
        useCollectionStore.setState({
          memberships: [{
            collectionId: 'abc123def456',
            collectionName: 'Old Name',
            joinedAt: oldJoinedAt,
            lastSyncAt: oldJoinedAt,
            lastAccessedAt: oldJoinedAt,
          }],
        });

        vi.mocked(collectionApi.fetchCollection).mockResolvedValueOnce({
          success: true,
          data: mockCollectionResponse,
        });

        const { joinCollection } = useCollectionStore.getState();
        const result = await joinCollection('abc123def456');

        expect(result.success).toBe(true);

        const { memberships } = useCollectionStore.getState();
        // Should still have 1 membership, not 2
        expect(memberships).toHaveLength(1);
        expect(memberships[0].collectionId).toBe('abc123def456');
        // The membership should be updated with new timestamps
        expect(memberships[0].joinedAt).toBeGreaterThan(oldJoinedAt);
      });
    });

    describe('createNewCollection', () => {
      it('should handle creation failure', async () => {
        vi.mocked(collectionApi.createCollection).mockResolvedValueOnce({
          success: false,
          error: { error: 'Rate limited', code: 'RATE_LIMITED', retryAfter: 3600 },
        });

        const { createNewCollection } = useCollectionStore.getState();
        const result = await createNewCollection('Test');

        expect(result.success).toBe(false);

        const { loadingState, error, memberships } = useCollectionStore.getState();
        expect(loadingState).toBe('error');
        expect(error).toBe('Rate limited');
        expect(memberships).toHaveLength(0);
      });

      it('should create a collection and join it', async () => {
        const createResponse = {
          id: 'new123',
          name: 'New Collection',
          createdAt: Date.now(),
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          url: 'http://localhost:3000/c/new123',
          viewOnlyUrl: 'http://localhost:3000/c/new123/view',
          layouts: [
            {
              id: 'layout-1',
              name: 'Test Layout',
              modifiedAt: Date.now(),
              preview: {
                drawerWidth: 10,
                drawerDepth: 8,
                drawerHeight: 12,
                binCount: 0,
                layerCount: 1,
              },
            },
          ],
        };

        vi.mocked(collectionApi.createCollection).mockResolvedValueOnce({
          success: true,
          data: createResponse,
        });

        const { createNewCollection } = useCollectionStore.getState();
        const result = await createNewCollection('New Collection', mockLayout);

        expect(result.success).toBe(true);

        const { memberships, activeCollection } = useCollectionStore.getState();
        expect(memberships).toHaveLength(1);
        expect(memberships[0].collectionId).toBe('new123');
        expect(activeCollection?.id).toBe('new123');
      });
    });

    describe('syncLayout', () => {
      it('should fail if no active collection', async () => {
        const { syncLayout } = useCollectionStore.getState();
        const result = await syncLayout('layout-uuid-1', mockLayout);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error).toBe('No active collection');
        }
      });

      it('should sync layout to server', async () => {
        const serverModifiedAt = Date.now();
        vi.mocked(collectionApi.updateLayout).mockResolvedValueOnce({
          success: true,
          data: { modifiedAt: serverModifiedAt },
        });

        // Set up active collection
        useCollectionStore.setState({
          activeCollection: {
            id: 'abc123def456',
            name: 'Test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            expiresAt: Date.now() + 1000000,
            layoutCount: 1,
          },
          syncStates: {
            'layout-uuid-1': {
              modifiedAt: Date.now() - 1000,
              localModifiedAt: Date.now(),
              lastSyncAt: Date.now() - 500,
            },
          },
        });

        const { syncLayout } = useCollectionStore.getState();
        const result = await syncLayout('layout-uuid-1', mockLayout);

        expect(result.success).toBe(true);

        const syncState = useCollectionStore.getState().getSyncState('layout-uuid-1');
        expect(syncState?.modifiedAt).toBe(serverModifiedAt);
        expect(syncState?.localModifiedAt).toBeUndefined();
      });

      it('should handle conflict during sync', async () => {
        const serverLayout = { ...mockLayout, name: 'Server Version' };
        vi.mocked(collectionApi.updateLayout).mockResolvedValueOnce({
          success: false,
          error: {
            error: 'Conflict',
            code: 'CONFLICT',
            serverModifiedAt: Date.now(),
            serverLayout,
          },
        });

        useCollectionStore.setState({
          activeCollection: {
            id: 'abc123def456',
            name: 'Test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            expiresAt: Date.now() + 1000000,
            layoutCount: 1,
          },
          syncStates: {
            'layout-uuid-1': {
              modifiedAt: Date.now() - 5000,
              localModifiedAt: Date.now(),
              lastSyncAt: Date.now() - 1000,
            },
          },
        });

        const { syncLayout } = useCollectionStore.getState();
        const result = await syncLayout('layout-uuid-1', mockLayout);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('CONFLICT');
          expect(result.error.serverLayout).toEqual(serverLayout);
        }
      });
    });
  });

  describe('addLayoutToCollection', () => {
    it('should fail if no active collection', async () => {
      const { addLayoutToCollection } = useCollectionStore.getState();
      const result = await addLayoutToCollection(mockLayout);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.error).toBe('No active collection');
      }
    });

    it('should add layout to collection', async () => {
      const addResponse = {
        id: 'new-layout-id',
        name: 'Test Layout',
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 0,
          layerCount: 1,
        },
      };

      vi.mocked(collectionApi.addLayout).mockResolvedValueOnce({
        success: true,
        data: addResponse,
      });

      // Set up active collection
      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 1,
        },
        activeCollectionLayouts: mockCollectionResponse.layouts,
      });

      const { addLayoutToCollection } = useCollectionStore.getState();
      const result = await addLayoutToCollection(mockLayout);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('new-layout-id');
      }

      const { activeCollectionLayouts, activeCollection, syncStates } =
        useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(2);
      expect(activeCollectionLayouts[1].id).toBe('new-layout-id');
      expect(activeCollection?.layoutCount).toBe(2);
      expect(syncStates['new-layout-id']).toBeDefined();
    });

    it('should handle add layout failure', async () => {
      vi.mocked(collectionApi.addLayout).mockResolvedValueOnce({
        success: false,
        error: { error: 'Collection full', code: 'COLLECTION_FULL' },
      });

      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 50,
        },
      });

      const { addLayoutToCollection } = useCollectionStore.getState();
      const result = await addLayoutToCollection(mockLayout);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('COLLECTION_FULL');
      }
    });
  });

  describe('deleteLayoutFromCollection', () => {
    it('should fail if no active collection', async () => {
      const { deleteLayoutFromCollection } = useCollectionStore.getState();
      const result = await deleteLayoutFromCollection('layout-uuid-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.error).toBe('No active collection');
      }
    });

    it('should prevent deleting last layout', async () => {
      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 1,
        },
        activeCollectionLayouts: [mockCollectionResponse.layouts[0]],
      });

      const { deleteLayoutFromCollection } = useCollectionStore.getState();
      const result = await deleteLayoutFromCollection('layout-uuid-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Cannot delete the last layout in a collection');
      }
    });

    it('should delete layout from collection', async () => {
      vi.mocked(collectionApi.deleteLayout).mockResolvedValueOnce({
        success: true,
        data: { success: true, message: 'Layout deleted' },
      });

      const secondLayout = {
        id: 'layout-uuid-2',
        name: 'Second Layout',
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 0,
          layerCount: 1,
        },
      };

      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 2,
        },
        activeCollectionLayouts: [mockCollectionResponse.layouts[0], secondLayout],
        syncStates: {
          'layout-uuid-1': { modifiedAt: Date.now(), lastSyncAt: Date.now() },
          'layout-uuid-2': { modifiedAt: Date.now(), lastSyncAt: Date.now() },
        },
      });

      const { deleteLayoutFromCollection } = useCollectionStore.getState();
      const result = await deleteLayoutFromCollection('layout-uuid-1');

      expect(result.success).toBe(true);

      const { activeCollectionLayouts, activeCollection, syncStates } =
        useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(1);
      expect(activeCollectionLayouts[0].id).toBe('layout-uuid-2');
      expect(activeCollection?.layoutCount).toBe(1);
      expect(syncStates['layout-uuid-1']).toBeUndefined();
    });

    it('should handle delete layout failure', async () => {
      vi.mocked(collectionApi.deleteLayout).mockResolvedValueOnce({
        success: false,
        error: { error: 'Network error', code: 'NETWORK_ERROR' },
      });

      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123def456',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 2,
        },
        activeCollectionLayouts: [
          mockCollectionResponse.layouts[0],
          { ...mockCollectionResponse.layouts[0], id: 'layout-uuid-2' },
        ],
      });

      const { deleteLayoutFromCollection } = useCollectionStore.getState();
      const result = await deleteLayoutFromCollection('layout-uuid-1');

      expect(result.success).toBe(false);

      // State should remain unchanged
      const { activeCollectionLayouts } = useCollectionStore.getState();
      expect(activeCollectionLayouts).toHaveLength(2);
    });
  });

  describe('leaveCollection', () => {
    it('should remove membership and clear active collection', () => {
      // Setup: join a collection
      useCollectionStore.setState({
        memberships: [mockMembership],
        activeCollection: {
          id: 'abc123def456',
          name: 'Test Collection',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 1,
        },
        activeCollectionLayouts: mockCollectionResponse.layouts,
        syncStates: { 'layout-uuid-1': { modifiedAt: Date.now(), lastSyncAt: Date.now() } },
      });

      const { leaveCollection } = useCollectionStore.getState();
      leaveCollection();

      const { memberships, activeCollection, activeCollectionLayouts, syncStates } =
        useCollectionStore.getState();
      expect(memberships).toHaveLength(0);
      expect(activeCollection).toBeNull();
      expect(activeCollectionLayouts).toHaveLength(0);
      expect(Object.keys(syncStates)).toHaveLength(0);
    });

    it('should handle leaving when no active collection', () => {
      const { leaveCollection } = useCollectionStore.getState();
      // Should not throw
      leaveCollection();
      expect(useCollectionStore.getState().activeCollection).toBeNull();
    });
  });

  describe('Computed Helpers', () => {
    it('should check if in collection mode', () => {
      const { isInCollectionMode } = useCollectionStore.getState();
      expect(isInCollectionMode()).toBe(false);

      useCollectionStore.setState({
        activeCollection: {
          id: 'abc123',
          name: 'Test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          layoutCount: 0,
        },
      });

      expect(useCollectionStore.getState().isInCollectionMode()).toBe(true);
    });

    it('should get layout count in active collection', () => {
      expect(useCollectionStore.getState().getLayoutCount()).toBe(0);

      useCollectionStore.setState({
        activeCollectionLayouts: mockCollectionResponse.layouts,
      });

      expect(useCollectionStore.getState().getLayoutCount()).toBe(1);
    });
  });

  describe('Persistence', () => {
    it('should load memberships on init', () => {
      const savedMemberships: CollectionMembership[] = [
        {
          collectionId: 'saved123',
          collectionName: 'Saved Collection',
          joinedAt: Date.now() - 10000,
          lastSyncAt: Date.now() - 5000,
          lastAccessedAt: Date.now() - 1000,
        },
      ];
      vi.mocked(storage.loadCollectionMemberships).mockReturnValueOnce(savedMemberships);

      const { initMemberships } = useCollectionStore.getState();
      initMemberships();

      const { memberships } = useCollectionStore.getState();
      expect(memberships).toHaveLength(1);
      expect(memberships[0].collectionId).toBe('saved123');
    });

    it('should save memberships when adding', () => {
      const { addMembership } = useCollectionStore.getState();

      addMembership(mockMembership);

      expect(storage.saveCollectionMemberships).toHaveBeenCalled();
    });

    it('should save memberships when removing', () => {
      // First add a membership
      useCollectionStore.setState({ memberships: [mockMembership] });

      const { removeMembership } = useCollectionStore.getState();
      removeMembership('abc123def456');

      expect(storage.saveCollectionMemberships).toHaveBeenCalled();
    });

    it('should save memberships when updating access', () => {
      useCollectionStore.setState({ memberships: [mockMembership] });

      const { updateMembershipAccess } = useCollectionStore.getState();
      updateMembershipAccess('abc123def456');

      expect(storage.saveCollectionMemberships).toHaveBeenCalled();
    });

    it('should save memberships after joining collection', async () => {
      vi.mocked(collectionApi.fetchCollection).mockResolvedValueOnce({
        success: true,
        data: mockCollectionResponse,
      });

      const { joinCollection } = useCollectionStore.getState();
      await joinCollection('abc123def456');

      expect(storage.saveCollectionMemberships).toHaveBeenCalled();
    });

    it('should save memberships after creating collection', async () => {
      vi.mocked(collectionApi.createCollection).mockResolvedValueOnce({
        success: true,
        data: {
          id: 'new123',
          name: 'New',
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000000,
          url: 'http://localhost/c/new123',
          viewOnlyUrl: 'http://localhost/c/new123/view',
          layouts: [],
        },
      });

      const { createNewCollection } = useCollectionStore.getState();
      await createNewCollection('New');

      expect(storage.saveCollectionMemberships).toHaveBeenCalled();
    });
  });
});
