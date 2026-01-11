import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore, computePreview, createDefaultLibrary } from '../../store/library';
import { createDefaultLayout, CONSTRAINTS } from '../../constants';
import type { LayoutLibrary, LayoutEntry, LayoutPreview } from '../../types';

function createTestLibrary(entryCount = 1): LayoutLibrary {
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
    // Reset store to a known state
    useLibraryStore.setState({
      library: createTestLibrary(1),
      isLoaded: false,
      showLayoutManager: false,
    });
  });

  describe('initLibrary', () => {
    it('sets the library and marks as loaded', () => {
      const testLibrary = createTestLibrary(3);

      useLibraryStore.getState().initLibrary(testLibrary);

      const state = useLibraryStore.getState();
      expect(state.library).toEqual(testLibrary);
      expect(state.isLoaded).toBe(true);
    });

    it('overwrites existing library', () => {
      const library1 = createTestLibrary(2);
      const library2 = createTestLibrary(5);

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

      const entry = useLibraryStore.getState().createEntry(
        'New Layout',
        'new-layout-id',
        preview,
        'Test Author'
      );

      expect(entry.id).toBe('new-layout-id');
      expect(entry.name).toBe('New Layout');
      expect(entry.author).toBe('Test Author');
      expect(entry.preview).toEqual(preview);
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.modifiedAt).toBeGreaterThan(0);
    });

    it('handles empty name', () => {
      const entry = useLibraryStore.getState().createEntry(
        '',
        'empty-name-id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 }
      );

      expect(entry.name).toBe('');
      expect(entry.id).toBe('empty-name-id');
    });

    it('handles name with only whitespace', () => {
      const entry = useLibraryStore.getState().createEntry(
        '   ',
        'whitespace-id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 }
      );

      // Should preserve whitespace (truncated to max length)
      expect(entry.name).toBe('   ');
    });

    it('handles undefined author (uses settings author)', () => {
      useLibraryStore.getState().setAuthorName('Settings Author');

      const entry = useLibraryStore.getState().createEntry(
        'Layout',
        'id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 },
        undefined
      );

      expect(entry.author).toBe('Settings Author');
    });

    it('adds entry to the library', () => {
      const initialCount = useLibraryStore.getState().library.entries.length;

      useLibraryStore.getState().createEntry(
        'New Layout',
        'new-id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 }
      );

      expect(useLibraryStore.getState().library.entries).toHaveLength(initialCount + 1);
    });

    it('truncates name to max length', () => {
      const longName = 'A'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);

      const entry = useLibraryStore.getState().createEntry(
        longName,
        'id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 }
      );

      expect(entry.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('uses library author name if not provided', () => {
      useLibraryStore.getState().setAuthorName('Default Author');

      const entry = useLibraryStore.getState().createEntry(
        'Layout',
        'id',
        { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 0, layerCount: 1 }
      );

      expect(entry.author).toBe('Default Author');
    });
  });

  describe('deleteEntry', () => {
    beforeEach(() => {
      useLibraryStore.setState({
        library: createTestLibrary(3),
        isLoaded: true,
        showLayoutManager: false,
      });
    });

    it('deletes an entry by id', () => {
      const result = useLibraryStore.getState().deleteEntry('layout-1');

      expect(result.success).toBe(true);
      expect(useLibraryStore.getState().library.entries).toHaveLength(2);
      expect(useLibraryStore.getState().getEntry('layout-1')).toBeUndefined();
    });

    it('cannot delete the last entry', () => {
      useLibraryStore.setState({
        library: createTestLibrary(1),
        isLoaded: true,
        showLayoutManager: false,
      });

      const result = useLibraryStore.getState().deleteEntry('layout-0');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Cannot delete the only layout');
      }
      expect(useLibraryStore.getState().library.entries).toHaveLength(1);
    });

    it('switches activeLayoutId if deleting active layout', () => {
      useLibraryStore.setState(state => {
        state.library.activeLayoutId = 'layout-1';
      });

      useLibraryStore.getState().deleteEntry('layout-1');

      // Should switch to first remaining entry
      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-0');
    });

    it('does not change activeLayoutId if deleting inactive layout', () => {
      useLibraryStore.setState(state => {
        state.library.activeLayoutId = 'layout-0';
      });

      useLibraryStore.getState().deleteEntry('layout-2');

      expect(useLibraryStore.getState().library.activeLayoutId).toBe('layout-0');
    });
  });

  describe('updateEntry', () => {
    it('updates entry name', () => {
      useLibraryStore.getState().updateEntry('layout-0', { name: 'Updated Name' });

      expect(useLibraryStore.getState().getEntry('layout-0')?.name).toBe('Updated Name');
    });

    it('truncates updated name to max length', () => {
      const longName = 'B'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 10);

      useLibraryStore.getState().updateEntry('layout-0', { name: longName });

      expect(useLibraryStore.getState().getEntry('layout-0')?.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
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
      const library = createTestLibrary(5);
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
        library: { ...createTestLibrary(0), entries: [] },
        isLoaded: true,
        showLayoutManager: false,
      });

      const recent = useLibraryStore.getState().getRecentEntries(5);

      expect(recent).toHaveLength(0);
    });
  });

  describe('setActiveLayoutId', () => {
    it('updates the active layout id', () => {
      useLibraryStore.setState({ library: createTestLibrary(3), isLoaded: true, showLayoutManager: false });

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

      expect(useLibraryStore.getState().library.settings.authorName).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
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
  it('computes preview from layout', () => {
    const layout = createDefaultLayout();
    layout.drawer = { width: 15, depth: 12, height: 10 };
    layout.bins = [
      { id: '1', x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: 'layer1', category: 'cat1', label: '', notes: '' },
      { id: '2', x: 1, y: 0, width: 1, depth: 1, height: 3, layerId: 'layer1', category: 'cat1', label: '', notes: '' },
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
