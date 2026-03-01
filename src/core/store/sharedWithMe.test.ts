import { describe, it, expect, beforeEach } from 'vitest';
import { useSharedWithMeStore, INITIAL_SHARED_WITH_ME_STATE } from './sharedWithMe';
import { CONSTRAINTS } from '@/core/constants';

describe('sharedWithMe store', () => {
  beforeEach(() => {
    useSharedWithMeStore.setState(INITIAL_SHARED_WITH_ME_STATE);
  });

  describe('init', () => {
    it('initializes entries', () => {
      const entries = [
        {
          id: 'swm-1',
          sourceShareId: 'share-abc',
          name: 'Shared Layout 1',
          permission: 'edit' as const,
          addedAt: Date.now(),
          lastAccessedAt: Date.now(),
          status: 'available' as const,
        },
      ];

      useSharedWithMeStore.getState().init(entries);

      expect(useSharedWithMeStore.getState().entries).toEqual(entries);
      expect(useSharedWithMeStore.getState().isLoaded).toBe(true);
    });

    it('overwrites existing entries', () => {
      useSharedWithMeStore.setState({
        entries: [
          {
            id: 'old-entry',
            sourceShareId: 'old-share',
            name: 'Old',
            permission: 'view' as const,
            addedAt: 1000,
            lastAccessedAt: 1000,
            status: 'available' as const,
          },
        ],
      });

      const newEntries = [
        {
          id: 'new-entry',
          sourceShareId: 'new-share',
          name: 'New',
          permission: 'edit' as const,
          addedAt: 2000,
          lastAccessedAt: 2000,
          status: 'available' as const,
        },
      ];

      useSharedWithMeStore.getState().init(newEntries);

      expect(useSharedWithMeStore.getState().entries).toHaveLength(1);
      expect(useSharedWithMeStore.getState().entries[0].id).toBe('new-entry');
    });
  });

  describe('add', () => {
    it('adds a new shared entry', () => {
      const entry = useSharedWithMeStore.getState().add({
        sourceShareId: 'share-xyz',
        name: 'Test Shared Layout',
        authorName: 'Test Author',
        permission: 'edit',
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 5,
          layerCount: 1,
        },
      });

      expect(entry.id).toBeDefined();
      expect(entry.sourceShareId).toBe('share-xyz');
      expect(entry.name).toBe('Test Shared Layout');
      expect(entry.authorName).toBe('Test Author');
      expect(entry.permission).toBe('edit');
      expect(entry.status).toBe('available');
      expect(entry.addedAt).toBeGreaterThan(0);
      expect(entry.lastAccessedAt).toBeGreaterThan(0);

      expect(useSharedWithMeStore.getState().entries).toHaveLength(1);
    });

    it('truncates name to max length', () => {
      const longName = 'A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);

      const entry = useSharedWithMeStore.getState().add({
        sourceShareId: 'share-1',
        name: longName,
        permission: 'view',
      });

      expect(entry.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('generates unique IDs for multiple entries', () => {
      const entry1 = useSharedWithMeStore.getState().add({
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
      });

      const entry2 = useSharedWithMeStore.getState().add({
        sourceShareId: 'share-2',
        name: 'Layout 2',
        permission: 'edit',
      });

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      useSharedWithMeStore.getState().add({
        sourceShareId: 'share-123',
        name: 'Original Name',
        authorName: 'Original Author',
        permission: 'view',
      });
    });

    it('updates name', () => {
      const entry = useSharedWithMeStore.getState().entries[0];

      useSharedWithMeStore.getState().update(entry.id, { name: 'Updated Name' });

      expect(useSharedWithMeStore.getState().entries[0].name).toBe('Updated Name');
    });

    it('truncates name to max length', () => {
      const entry = useSharedWithMeStore.getState().entries[0];
      const longName = 'B'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 10);

      useSharedWithMeStore.getState().update(entry.id, { name: longName });

      expect(useSharedWithMeStore.getState().entries[0].name).toHaveLength(
        CONSTRAINTS.NAME_MAX_LENGTH
      );
    });

    it('updates authorName', () => {
      const entry = useSharedWithMeStore.getState().entries[0];

      useSharedWithMeStore.getState().update(entry.id, { authorName: 'New Author' });

      expect(useSharedWithMeStore.getState().entries[0].authorName).toBe('New Author');
    });

    it('updates permission', () => {
      const entry = useSharedWithMeStore.getState().entries[0];

      useSharedWithMeStore.getState().update(entry.id, { permission: 'edit' });

      expect(useSharedWithMeStore.getState().entries[0].permission).toBe('edit');
    });

    it('updates lastAccessedAt', () => {
      const entry = useSharedWithMeStore.getState().entries[0];
      const newTime = Date.now() + 10000;

      useSharedWithMeStore.getState().update(entry.id, { lastAccessedAt: newTime });

      expect(useSharedWithMeStore.getState().entries[0].lastAccessedAt).toBe(newTime);
    });

    it('updates preview', () => {
      const entry = useSharedWithMeStore.getState().entries[0];
      const newPreview = {
        drawerWidth: 20,
        drawerDepth: 15,
        drawerHeight: 10,
        binCount: 50,
        layerCount: 3,
      };

      useSharedWithMeStore.getState().update(entry.id, { preview: newPreview });

      expect(useSharedWithMeStore.getState().entries[0].preview).toEqual(newPreview);
    });

    it('updates status', () => {
      const entry = useSharedWithMeStore.getState().entries[0];

      useSharedWithMeStore.getState().update(entry.id, { status: 'deleted' });

      expect(useSharedWithMeStore.getState().entries[0].status).toBe('deleted');
    });

    it('does nothing for non-existent entry', () => {
      const entriesBefore = [...useSharedWithMeStore.getState().entries];

      useSharedWithMeStore.getState().update('non-existent', { name: 'Whatever' });

      expect(useSharedWithMeStore.getState().entries).toEqual(entriesBefore);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      useSharedWithMeStore.getState().add({
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
      });
      useSharedWithMeStore.getState().add({
        sourceShareId: 'share-2',
        name: 'Layout 2',
        permission: 'edit',
      });
    });

    it('removes entry by id', () => {
      const entry = useSharedWithMeStore.getState().entries[0];

      useSharedWithMeStore.getState().remove(entry.id);

      expect(useSharedWithMeStore.getState().entries).toHaveLength(1);
      expect(useSharedWithMeStore.getState().entries[0].sourceShareId).toBe('share-2');
    });

    it('does nothing for non-existent id', () => {
      useSharedWithMeStore.getState().remove('non-existent');

      expect(useSharedWithMeStore.getState().entries).toHaveLength(2);
    });
  });

  describe('getByShareId', () => {
    beforeEach(() => {
      useSharedWithMeStore.getState().add({
        sourceShareId: 'share-abc-123',
        name: 'Test Layout',
        permission: 'edit',
      });
    });

    it('finds entry by sourceShareId', () => {
      const entry = useSharedWithMeStore.getState().getByShareId('share-abc-123');

      expect(entry).toBeDefined();
      expect(entry?.name).toBe('Test Layout');
    });

    it('returns undefined for non-existent shareId', () => {
      const entry = useSharedWithMeStore.getState().getByShareId('non-existent');

      expect(entry).toBeUndefined();
    });
  });

  describe('markAccessed', () => {
    beforeEach(() => {
      useSharedWithMeStore.getState().add({
        sourceShareId: 'share-xyz',
        name: 'Test Layout',
        permission: 'view',
      });
    });

    it('updates lastAccessedAt for entry with matching shareId', () => {
      const before = useSharedWithMeStore.getState().entries[0].lastAccessedAt;

      useSharedWithMeStore.getState().markAccessed('share-xyz');

      const after = useSharedWithMeStore.getState().entries[0].lastAccessedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('does nothing for non-existent shareId', () => {
      const before = [...useSharedWithMeStore.getState().entries];

      useSharedWithMeStore.getState().markAccessed('non-existent');

      expect(useSharedWithMeStore.getState().entries[0].lastAccessedAt).toBe(
        before[0].lastAccessedAt
      );
    });
  });
});
