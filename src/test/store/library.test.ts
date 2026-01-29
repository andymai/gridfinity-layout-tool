import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLibraryStore, computePreview, createDefaultLibrary } from '@/core/store/library';
import { createDefaultLayout, CONSTRAINTS } from '@/core/constants';
import { resetAllStores, expectOk, expectErr } from '@/test/testUtils';
import type { LayoutLibrary, LayoutEntry, LayoutPreview } from '@/core/types';

// Helper to create test library with multiple entries (uses testUtils createTestLibrary as base)
function createTestLibraryWithEntries(entryCount: number): LayoutLibrary {
  const entries: LayoutEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      id: `layout-${i}`,
      name: `Test Layout ${i}`,
      createdAt: Date.now() - (entryCount - i) * 1000, // Older layouts have older timestamps
      modifiedAt: Date.now() - (entryCount - i) * 1000,
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: i,
        layerCount: 1,
        binMap: [],
      },
    });
  }

  return {
    version: '1.0',
    activeLayoutId: entries[0]?.id || '',
    settings: {},
    entries,
  };
}

describe('library store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initLibrary', () => {
    it('sets the library and marks as loaded', () => {
      const testLibrary = createTestLibraryWithEntries(3);

      useLibraryStore.getState().initLibrary(testLibrary);

      const state = useLibraryStore.getState();
      expect(state.library).toEqual(testLibrary);
      expect(state.isLoaded).toBe(true);
    });

    it('overwrites existing library', () => {
      const library1 = createTestLibraryWithEntries(2);
      const library2 = createTestLibraryWithEntries(5);

      useLibraryStore.getState().initLibrary(library1);
      useLibraryStore.getState().initLibrary(library2);

      expect(useLibraryStore.getState().library.entries).toHaveLength(5);
    });
  });

  describe('createEntry', () => {
    it('creates a new entry with correct fields', () => {
      const preview: LayoutPreview = {
        drawerWidth: 15,
        drawerDepth: 12,
        drawerHeight: 10,
        binCount: 5,
        layerCount: 2,
      };

      const entry = useLibraryStore
        .getState()
        .createEntry('New Layout', 'new-layout-id', preview, 'Test Author');

      expect(entry.id).toBe('new-layout-id');
      expect(entry.name).toBe('New Layout');
      expect(entry.author).toBe('Test Author');
      expect(entry.preview).toEqual(preview);
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.modifiedAt).toBeGreaterThan(0);
    });

    it('handles empty name', () => {
      const entry = useLibraryStore.getState().createEntry('', 'empty-name-id', {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      });

      expect(entry.name).toBe('');
      expect(entry.id).toBe('empty-name-id');
    });

    it('handles name with only whitespace', () => {
      const entry = useLibraryStore.getState().createEntry('   ', 'whitespace-id', {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      });

      // Should preserve whitespace (truncated to max length)
      expect(entry.name).toBe('   ');
    });

    it('handles undefined author (uses settings author)', () => {
      useLibraryStore.getState().setAuthorName('Settings Author');

      const entry = useLibraryStore
        .getState()
        .createEntry(
          'Layout',
          'id',
          { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
          undefined
        );

      expect(entry.author).toBe('Settings Author');
    });

    it('adds entry to the library', () => {
      const initialCount = useLibraryStore.getState().library.entries.length;

      useLibraryStore.getState().createEntry('New Layout', 'new-id', {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      });

      expect(useLibraryStore.getState().library.entries).toHaveLength(initialCount + 1);
    });

    it('truncates name to max length', () => {
      const longName = 'A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);

      const entry = useLibraryStore.getState().createEntry(longName, 'id', {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      });

      expect(entry.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('uses library author name if not provided', () => {
      useLibraryStore.getState().setAuthorName('Default Author');

      const entry = useLibraryStore.getState().createEntry('Layout', 'id', {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 0,
        layerCount: 1,
      });

      expect(entry.author).toBe('Default Author');
    });
  });

  describe('deleteEntry', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(3),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('returns Ok when deleting an entry', () => {
      const result = useLibraryStore.getState().deleteEntry('layout-1');

      expectOk(result);
      expect(useLibraryStore.getState().library.entries).toHaveLength(2);
      expect(useLibraryStore.getState().getEntry('layout-1')).toBeUndefined();
    });

    it('returns Err with LAYOUT_LAST_ENTITY when deleting the only entry', () => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(1),
        isLoaded: true,
        showLayoutManager: false,
      });

      const result = useLibraryStore.getState().deleteEntry('layout-0');

      const error = expectErr(result);
      expect(error.code).toBe('LAYOUT_LAST_ENTITY');
      expect(error.kind).toBe('LayoutError');
      expect(error.entityType).toBe('layout');
      expect(useLibraryStore.getState().library.entries).toHaveLength(1);
    });

    it('switches activeLayoutId if deleting active layout', () => {
      useLibraryStore.setState((state) => {
        state.library.activeLayoutId = 'layout-1';
      });

      const result = useLibraryStore.getState().deleteEntry('layout-1');

      expectOk(result);
      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-0');
    });

    it('does not change activeLayoutId if deleting inactive layout', () => {
      useLibraryStore.setState((state) => {
        state.library.activeLayoutId = 'layout-0';
      });

      const result = useLibraryStore.getState().deleteEntry('layout-2');

      expectOk(result);
      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-0');
    });
  });

  describe('updateEntry', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(3),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('updates entry name', () => {
      useLibraryStore.getState().updateEntry('layout-0', { name: 'Updated Name' });

      expect(useLibraryStore.getState().getEntry('layout-0')?.name).toBe('Updated Name');
    });

    it('truncates updated name to max length', () => {
      const longName = 'B'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 10);

      useLibraryStore.getState().updateEntry('layout-0', { name: longName });

      expect(useLibraryStore.getState().getEntry('layout-0')?.name).toHaveLength(
        CONSTRAINTS.NAME_MAX_LENGTH
      );
    });

    it('updates modifiedAt', () => {
      const newTime = Date.now() + 10000;

      useLibraryStore.getState().updateEntry('layout-0', { modifiedAt: newTime });

      expect(useLibraryStore.getState().getEntry('layout-0')?.modifiedAt).toBe(newTime);
    });

    it('updates preview', () => {
      const newPreview: LayoutPreview = {
        drawerWidth: 20,
        drawerDepth: 15,
        drawerHeight: 10,
        binCount: 50,
        layerCount: 5,
      };

      useLibraryStore.getState().updateEntry('layout-0', { preview: newPreview });

      expect(useLibraryStore.getState().getEntry('layout-0')?.preview).toEqual(newPreview);
    });

    it('updates author', () => {
      useLibraryStore.getState().updateEntry('layout-0', { author: 'New Author' });

      expect(useLibraryStore.getState().getEntry('layout-0')?.author).toBe('New Author');
    });

    it('updates forkedFrom', () => {
      useLibraryStore.getState().updateEntry('layout-0', {
        forkedFrom: { name: 'Original Layout', author: 'Original Author' },
      });

      const entry = useLibraryStore.getState().getEntry('layout-0');
      expect(entry?.forkedFrom).toEqual({ name: 'Original Layout', author: 'Original Author' });
    });

    it('does nothing for non-existent entry', () => {
      const entriesBefore = [...useLibraryStore.getState().library.entries];

      useLibraryStore.getState().updateEntry('non-existent', { name: 'Whatever' });

      expect(useLibraryStore.getState().library.entries).toEqual(entriesBefore);
    });
  });

  describe('duplicateEntry', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(3),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('creates a copy with (copy) suffix', () => {
      const source = useLibraryStore.getState().getEntry('layout-0')!;

      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'new-copy-id');

      expect(duplicate.id).toBe('new-copy-id');
      expect(duplicate.name).toBe('Test Layout 0 (copy)');
    });

    it('copies preview data', () => {
      const source = useLibraryStore.getState().getEntry('layout-0')!;

      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'new-copy-id');

      expect(duplicate.preview).toEqual(source.preview);
    });

    it('sets new timestamps', () => {
      const source = useLibraryStore.getState().getEntry('layout-0')!;
      const before = Date.now();

      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'new-copy-id');

      expect(duplicate.createdAt).toBeGreaterThanOrEqual(before);
      expect(duplicate.modifiedAt).toBeGreaterThanOrEqual(before);
    });

    it('adds duplicate to library', () => {
      const source = useLibraryStore.getState().getEntry('layout-0')!;
      const countBefore = useLibraryStore.getState().library.entries.length;

      useLibraryStore.getState().duplicateEntry(source, 'new-copy-id');

      expect(useLibraryStore.getState().library.entries).toHaveLength(countBefore + 1);
    });

    it('truncates name if source name + (copy) exceeds max length', () => {
      // Set up a source with a very long name
      useLibraryStore.getState().updateEntry('layout-0', {
        name: 'A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH - 2),
      });

      const source = useLibraryStore.getState().getEntry('layout-0')!;
      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'new-copy-id');

      expect(duplicate.name.length).toBeLessThanOrEqual(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('creates independent preview copy (not shared reference)', () => {
      const source = useLibraryStore.getState().getEntry('layout-0')!;

      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'copy-id');

      // The duplicate preview should be a copy, not the same reference
      expect(duplicate.preview).not.toBe(source.preview);
      expect(duplicate.preview).toEqual(source.preview);

      // Verify preview data is correctly copied
      expect(duplicate.preview.binCount).toBe(source.preview.binCount);
      expect(duplicate.preview.drawerWidth).toBe(source.preview.drawerWidth);
    });

    it('does not copy forkedFrom from source', () => {
      useLibraryStore.getState().updateEntry('layout-0', {
        forkedFrom: { name: 'Original', author: 'Someone' },
      });

      const source = useLibraryStore.getState().getEntry('layout-0')!;
      const duplicate = useLibraryStore.getState().duplicateEntry(source, 'copy-id');

      expect(duplicate.forkedFrom).toBeUndefined();
    });
  });

  describe('getEntry', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(3),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('returns entry by id', () => {
      const entry = useLibraryStore.getState().getEntry('layout-0');

      expect(entry).toBeDefined();
      expect(entry?.id).toBe('layout-0');
    });

    it('returns undefined for non-existent id', () => {
      const entry = useLibraryStore.getState().getEntry('non-existent');

      expect(entry).toBeUndefined();
    });
  });

  describe('getRecentEntries', () => {
    beforeEach(() => {
      // Create library with known modification times
      const library = createTestLibraryWithEntries(5);
      library.entries[0].modifiedAt = 1000;
      library.entries[1].modifiedAt = 5000;
      library.entries[2].modifiedAt = 3000;
      library.entries[3].modifiedAt = 4000;
      library.entries[4].modifiedAt = 2000;

      useLibraryStore.setState({ library, isLoaded: true, showLayoutManager: false });
    });

    it('returns entries sorted by modifiedAt descending', () => {
      const recent = useLibraryStore.getState().getRecentEntries(5);

      expect(recent[0].modifiedAt).toBe(5000);
      expect(recent[1].modifiedAt).toBe(4000);
      expect(recent[2].modifiedAt).toBe(3000);
      expect(recent[3].modifiedAt).toBe(2000);
      expect(recent[4].modifiedAt).toBe(1000);
    });

    it('limits to requested count', () => {
      const recent = useLibraryStore.getState().getRecentEntries(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].modifiedAt).toBe(5000);
    });

    it('returns all if count exceeds entries', () => {
      const recent = useLibraryStore.getState().getRecentEntries(10);

      expect(recent).toHaveLength(5);
    });

    it('returns empty array when count is 0', () => {
      const recent = useLibraryStore.getState().getRecentEntries(0);

      expect(recent).toHaveLength(0);
    });

    it('returns empty array when no entries exist', () => {
      useLibraryStore.setState({
        library: { ...createTestLibraryWithEntries(0), entries: [] },
        isLoaded: true,
        showLayoutManager: false,
      });

      const recent = useLibraryStore.getState().getRecentEntries(5);

      expect(recent).toHaveLength(0);
    });
  });

  describe('setActiveLayoutId', () => {
    it('updates the active layout id', () => {
      useLibraryStore.setState({
        library: createTestLibraryWithEntries(3),
        isLoaded: true,
        showLayoutManager: false,
      });

      useLibraryStore.getState().setActiveLayoutId('layout-2');

      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-2');
    });
  });

  describe('setAuthorName', () => {
    it('sets the author name in settings', () => {
      useLibraryStore.getState().setAuthorName('Test Author');

      expect(useLibraryStore.getState().library.settings.authorName).toBe('Test Author');
    });

    it('truncates author name to max length', () => {
      const longName = 'C'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);

      useLibraryStore.getState().setAuthorName(longName);

      expect(useLibraryStore.getState().library.settings.authorName).toHaveLength(
        CONSTRAINTS.NAME_MAX_LENGTH
      );
    });
  });

  describe('setShowLayoutManager', () => {
    it('sets showLayoutManager to true', () => {
      useLibraryStore.getState().setShowLayoutManager(true);

      expect(useLibraryStore.getState().showLayoutManager).toBe(true);
    });

    it('sets showLayoutManager to false', () => {
      useLibraryStore.setState({ showLayoutManager: true });

      useLibraryStore.getState().setShowLayoutManager(false);

      expect(useLibraryStore.getState().showLayoutManager).toBe(false);
    });
  });
});

describe('computePreview', () => {
  it('computes preview from layout including binMap', () => {
    const layout = createDefaultLayout();
    layout.drawer = { width: 15, depth: 12, height: 10 };
    layout.categories = [{ id: 'cat1', name: 'Category 1', color: '#3B82F6' }];
    layout.bins = [
      {
        id: '1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'layer1',
        category: 'cat1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        x: 1,
        y: 0,
        width: 2,
        depth: 3,
        height: 3,
        layerId: 'layer1',
        category: 'cat1',
        label: '',
        notes: '',
      },
    ];
    layout.layers = [
      { id: 'layer1', name: 'Layer 1', height: 3 },
      { id: 'layer2', name: 'Layer 2', height: 5 },
    ];

    const preview = computePreview(layout);

    expect(preview).toEqual({
      drawerWidth: 15,
      drawerDepth: 12,
      drawerHeight: 10,
      binCount: 2,
      layerCount: 2,
      binMap: [
        { x: 0, y: 0, w: 1, d: 1, c: '#3B82F6' },
        { x: 1, y: 0, w: 2, d: 3, c: '#3B82F6' },
      ],
    });
  });

  it('excludes staged bins from binMap', () => {
    const layout = createDefaultLayout();
    layout.categories = [{ id: 'cat1', name: 'Category', color: '#FF0000' }];
    layout.bins = [
      {
        id: '1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'layer1',
        category: 'cat1',
        label: '',
        notes: '',
      },
      {
        id: '2',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: '__staging__',
        category: 'cat1',
        label: '',
        notes: '',
      },
    ];

    const preview = computePreview(layout);

    // binCount includes all bins, but binMap excludes staged
    expect(preview.binCount).toBe(2);
    expect(preview.binMap).toHaveLength(1);
    expect(preview.binMap![0].c).toBe('#FF0000');
  });

  it('uses fallback color for unknown category', () => {
    const layout = createDefaultLayout();
    layout.categories = [];
    layout.bins = [
      {
        id: '1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'layer1',
        category: 'unknown',
        label: '',
        notes: '',
      },
    ];

    const preview = computePreview(layout);

    expect(preview.binMap![0].c).toBe('#6B7280'); // fallback gray
  });
});

describe('clearCloudShare', () => {
  beforeEach(() => {
    const library = createTestLibraryWithEntries(2);
    library.entries[0].cloudShare = {
      id: 'share-123',
      deleteToken: 'token-456',
      permission: 'edit',
      sharedAt: new Date().toISOString(),
    };
    useLibraryStore.setState({ library, isLoaded: true });
  });

  it('clears cloud share from entry', () => {
    expect(useLibraryStore.getState().getEntry('layout-0')?.cloudShare).toBeDefined();

    useLibraryStore.getState().clearCloudShare('layout-0');

    expect(useLibraryStore.getState().getEntry('layout-0')?.cloudShare).toBeUndefined();
  });

  it('does nothing for non-existent entry', () => {
    const entriesBefore = useLibraryStore.getState().library.entries.length;

    useLibraryStore.getState().clearCloudShare('non-existent');

    expect(useLibraryStore.getState().library.entries.length).toBe(entriesBefore);
  });

  it('does nothing for entry without cloud share', () => {
    // layout-1 has no cloud share
    useLibraryStore.getState().clearCloudShare('layout-1');

    // Should not throw or change anything
    expect(useLibraryStore.getState().getEntry('layout-1')?.cloudShare).toBeUndefined();
  });
});

describe('sharedWithMe actions', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      library: createTestLibraryWithEntries(1),
      isLoaded: true,
      sharedWithMe: [],
      sharedWithMeLoaded: false,
    });
  });

  describe('initSharedWithMe', () => {
    it('initializes sharedWithMe entries', () => {
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

      useLibraryStore.getState().initSharedWithMe(entries);

      expect(useLibraryStore.getState().sharedWithMe).toEqual(entries);
      expect(useLibraryStore.getState().sharedWithMeLoaded).toBe(true);
    });

    it('overwrites existing entries', () => {
      useLibraryStore.setState({
        sharedWithMe: [
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

      useLibraryStore.getState().initSharedWithMe(newEntries);

      expect(useLibraryStore.getState().sharedWithMe).toHaveLength(1);
      expect(useLibraryStore.getState().sharedWithMe[0].id).toBe('new-entry');
    });
  });

  describe('addSharedWithMe', () => {
    it('adds a new shared entry', () => {
      const entry = useLibraryStore.getState().addSharedWithMe({
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

      expect(useLibraryStore.getState().sharedWithMe).toHaveLength(1);
    });

    it('truncates name to max length', () => {
      const longName = 'A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);

      const entry = useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-1',
        name: longName,
        permission: 'view',
      });

      expect(entry.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('generates unique IDs for multiple entries', () => {
      const entry1 = useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
      });

      const entry2 = useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-2',
        name: 'Layout 2',
        permission: 'edit',
      });

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('updateSharedWithMe', () => {
    beforeEach(() => {
      useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-123',
        name: 'Original Name',
        authorName: 'Original Author',
        permission: 'view',
      });
    });

    it('updates name', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];

      useLibraryStore.getState().updateSharedWithMe(entry.id, { name: 'Updated Name' });

      expect(useLibraryStore.getState().sharedWithMe[0].name).toBe('Updated Name');
    });

    it('truncates name to max length', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];
      const longName = 'B'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 10);

      useLibraryStore.getState().updateSharedWithMe(entry.id, { name: longName });

      expect(useLibraryStore.getState().sharedWithMe[0].name).toHaveLength(
        CONSTRAINTS.NAME_MAX_LENGTH
      );
    });

    it('updates authorName', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];

      useLibraryStore.getState().updateSharedWithMe(entry.id, { authorName: 'New Author' });

      expect(useLibraryStore.getState().sharedWithMe[0].authorName).toBe('New Author');
    });

    it('updates permission', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];

      useLibraryStore.getState().updateSharedWithMe(entry.id, { permission: 'edit' });

      expect(useLibraryStore.getState().sharedWithMe[0].permission).toBe('edit');
    });

    it('updates lastAccessedAt', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];
      const newTime = Date.now() + 10000;

      useLibraryStore.getState().updateSharedWithMe(entry.id, { lastAccessedAt: newTime });

      expect(useLibraryStore.getState().sharedWithMe[0].lastAccessedAt).toBe(newTime);
    });

    it('updates preview', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];
      const newPreview = {
        drawerWidth: 20,
        drawerDepth: 15,
        drawerHeight: 10,
        binCount: 50,
        layerCount: 3,
      };

      useLibraryStore.getState().updateSharedWithMe(entry.id, { preview: newPreview });

      expect(useLibraryStore.getState().sharedWithMe[0].preview).toEqual(newPreview);
    });

    it('updates status', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];

      useLibraryStore.getState().updateSharedWithMe(entry.id, { status: 'deleted' });

      expect(useLibraryStore.getState().sharedWithMe[0].status).toBe('deleted');
    });

    it('does nothing for non-existent entry', () => {
      const entriesBefore = [...useLibraryStore.getState().sharedWithMe];

      useLibraryStore.getState().updateSharedWithMe('non-existent', { name: 'Whatever' });

      expect(useLibraryStore.getState().sharedWithMe).toEqual(entriesBefore);
    });
  });

  describe('removeSharedWithMe', () => {
    beforeEach(() => {
      useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-1',
        name: 'Layout 1',
        permission: 'view',
      });
      useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-2',
        name: 'Layout 2',
        permission: 'edit',
      });
    });

    it('removes entry by id', () => {
      const entry = useLibraryStore.getState().sharedWithMe[0];

      useLibraryStore.getState().removeSharedWithMe(entry.id);

      expect(useLibraryStore.getState().sharedWithMe).toHaveLength(1);
      expect(useLibraryStore.getState().sharedWithMe[0].sourceShareId).toBe('share-2');
    });

    it('does nothing for non-existent id', () => {
      useLibraryStore.getState().removeSharedWithMe('non-existent');

      expect(useLibraryStore.getState().sharedWithMe).toHaveLength(2);
    });
  });

  describe('getSharedWithMeByShareId', () => {
    beforeEach(() => {
      useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-abc-123',
        name: 'Test Layout',
        permission: 'edit',
      });
    });

    it('finds entry by sourceShareId', () => {
      const entry = useLibraryStore.getState().getSharedWithMeByShareId('share-abc-123');

      expect(entry).toBeDefined();
      expect(entry?.name).toBe('Test Layout');
    });

    it('returns undefined for non-existent shareId', () => {
      const entry = useLibraryStore.getState().getSharedWithMeByShareId('non-existent');

      expect(entry).toBeUndefined();
    });
  });

  describe('markShareAccessed', () => {
    beforeEach(() => {
      useLibraryStore.getState().addSharedWithMe({
        sourceShareId: 'share-xyz',
        name: 'Test Layout',
        permission: 'view',
      });
    });

    it('updates lastAccessedAt for entry with matching shareId', () => {
      const before = useLibraryStore.getState().sharedWithMe[0].lastAccessedAt;

      useLibraryStore.getState().markShareAccessed('share-xyz');

      const after = useLibraryStore.getState().sharedWithMe[0].lastAccessedAt;
      // Should be updated (>= before since time might not have advanced)
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('does nothing for non-existent shareId', () => {
      const before = [...useLibraryStore.getState().sharedWithMe];

      useLibraryStore.getState().markShareAccessed('non-existent');

      // Check that entries are unchanged
      expect(useLibraryStore.getState().sharedWithMe[0].lastAccessedAt).toBe(
        before[0].lastAccessedAt
      );
    });
  });
});

describe('createDefaultLibrary', () => {
  it('creates a library with single entry', () => {
    const library = createDefaultLibrary('test-id', 'Test Layout');

    expect(library.version).toBe('1.0');
    expect(library.activeLayoutId).toBe('test-id');
    expect(library.entries).toHaveLength(1);
    expect(library.entries[0].id).toBe('test-id');
    expect(library.entries[0].name).toBe('Test Layout');
  });

  it('includes default preview', () => {
    const library = createDefaultLibrary('test-id', 'Test Layout');

    expect(library.entries[0].preview).toEqual({
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
    });
  });

  it('sets timestamps', () => {
    const before = Date.now();
    const library = createDefaultLibrary('test-id', 'Test Layout');
    const after = Date.now();

    expect(library.entries[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(library.entries[0].createdAt).toBeLessThanOrEqual(after);
  });
});
