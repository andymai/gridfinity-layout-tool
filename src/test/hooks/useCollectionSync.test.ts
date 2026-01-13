/**
 * Integration tests for useCollectionSync hook.
 *
 * These tests verify the actual sync behavior, particularly:
 * - Edit source tracking (local vs remote vs init)
 * - That remote imports don't trigger push back to server
 * - That local edits do trigger sync
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useLayoutStore, type EditSource } from '../../store/layout';
import { useCollectionStore } from '../../store/collection';
import { createDefaultLayout } from '../../constants';

describe('useLayoutStore edit source tracking', () => {
  beforeEach(() => {
    // Reset store state before each test
    useLayoutStore.setState({
      layout: createDefaultLayout(),
      activeLayoutId: null,
      lastEditSource: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('importLayout with source parameter', () => {
    it('sets lastEditSource to "local" by default', () => {
      const { importLayout } = useLayoutStore.getState();
      const newLayout = createDefaultLayout();
      newLayout.name = 'Test Layout';

      importLayout(newLayout, 'test-id');

      expect(useLayoutStore.getState().lastEditSource).toBe('local');
    });

    it('sets lastEditSource to "remote" when specified', () => {
      const { importLayout } = useLayoutStore.getState();
      const newLayout = createDefaultLayout();
      newLayout.name = 'Remote Layout';

      importLayout(newLayout, 'test-id', 'remote');

      expect(useLayoutStore.getState().lastEditSource).toBe('remote');
    });

    it('sets lastEditSource to "init" when specified', () => {
      const { importLayout } = useLayoutStore.getState();
      const newLayout = createDefaultLayout();
      newLayout.name = 'Initial Layout';

      importLayout(newLayout, 'test-id', 'init');

      expect(useLayoutStore.getState().lastEditSource).toBe('init');
    });
  });

  describe('layout modifications set lastEditSource to local', () => {
    it('addBin does not change lastEditSource (relies on Immer update)', () => {
      // Import a layout first with 'init'
      const { importLayout, addBin } = useLayoutStore.getState();
      const layout = createDefaultLayout();
      importLayout(layout, 'test-id', 'init');

      expect(useLayoutStore.getState().lastEditSource).toBe('init');

      // Adding a bin creates a new layout reference but doesn't set lastEditSource
      // The sync hook should detect the reference change
      const result = addBin({
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: layout.layers[0].id,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      // The bin was added
      expect(result).not.toBeNull();
      // lastEditSource is still 'init' because addBin doesn't modify it
      // The sync subscription detects changes via reference equality
      expect(useLayoutStore.getState().lastEditSource).toBe('init');
    });
  });

  describe('subscription behavior with edit source', () => {
    it('can track state changes', () => {
      const changes: { layout: string; source: EditSource }[] = [];

      const unsubscribe = useLayoutStore.subscribe((state) => {
        changes.push({
          layout: state.layout.name,
          source: state.lastEditSource,
        });
      });

      const { importLayout } = useLayoutStore.getState();

      // First import with 'init'
      const layout1 = createDefaultLayout();
      layout1.name = 'Layout 1';
      importLayout(layout1, 'id-1', 'init');

      // Second import with 'remote'
      const layout2 = createDefaultLayout();
      layout2.name = 'Layout 2';
      importLayout(layout2, 'id-2', 'remote');

      // Third import with default 'local'
      const layout3 = createDefaultLayout();
      layout3.name = 'Layout 3';
      importLayout(layout3, 'id-3');

      unsubscribe();

      expect(changes).toHaveLength(3);
      expect(changes[0]).toEqual({ layout: 'Layout 1', source: 'init' });
      expect(changes[1]).toEqual({ layout: 'Layout 2', source: 'remote' });
      expect(changes[2]).toEqual({ layout: 'Layout 3', source: 'local' });
    });

    it('allows filtering by edit source in subscription', () => {
      const localEdits: string[] = [];

      const unsubscribe = useLayoutStore.subscribe((state) => {
        // Skip remote and init changes (simulating what useCollectionSync does)
        if (state.lastEditSource === 'remote' || state.lastEditSource === 'init') {
          return;
        }
        localEdits.push(state.layout.name);
      });

      const { importLayout } = useLayoutStore.getState();

      // These should be filtered out
      importLayout(createDefaultLayout(), 'id-1', 'init');
      importLayout(createDefaultLayout(), 'id-2', 'remote');

      // This should be captured
      const localLayout = createDefaultLayout();
      localLayout.name = 'Local Edit';
      importLayout(localLayout, 'id-3', 'local');

      unsubscribe();

      // Only the local edit should be captured
      expect(localEdits).toHaveLength(1);
      expect(localEdits[0]).toBe('Local Edit');
    });
  });
});

describe('useCollectionStore sync state management', () => {
  beforeEach(() => {
    useCollectionStore.setState({
      memberships: [],
      activeCollectionId: null,
      syncStates: {},
    });
  });

  it('tracks sync state per layout', () => {
    const { setSyncState } = useCollectionStore.getState();

    setSyncState('layout-1', {
      modifiedAt: 1000,
      lastSyncAt: 1000,
    });

    expect(useCollectionStore.getState().syncStates['layout-1']).toEqual({
      modifiedAt: 1000,
      lastSyncAt: 1000,
    });
  });

  it('marks layout as modified locally (requires existing sync state)', () => {
    const { setSyncState, markLayoutModified } = useCollectionStore.getState();

    // First, set up a sync state (required before markLayoutModified works)
    setSyncState('layout-1', {
      modifiedAt: 1000,
      lastSyncAt: 1000,
    });

    // Now mark as modified
    markLayoutModified('layout-1');

    const state = useCollectionStore.getState().syncStates['layout-1'];
    expect(state).toBeDefined();
    expect(state?.localModifiedAt).toBeGreaterThan(0);
  });

  it('hasLocalChanges returns true when localModifiedAt is set', () => {
    const { setSyncState, markLayoutModified, hasLocalChanges } = useCollectionStore.getState();

    // Initially no local changes (no sync state)
    expect(hasLocalChanges('layout-1')).toBe(false);

    // Set up sync state first
    setSyncState('layout-1', {
      modifiedAt: 1000,
      lastSyncAt: 1000,
    });

    // Still no local changes until marked
    expect(hasLocalChanges('layout-1')).toBe(false);

    // Mark as modified
    markLayoutModified('layout-1');

    // Now has local changes
    expect(hasLocalChanges('layout-1')).toBe(true);
  });

  it('clearLocalModification removes localModifiedAt', () => {
    const { setSyncState, markLayoutModified, clearLocalModification, hasLocalChanges } = useCollectionStore.getState();

    // Set up sync state first
    setSyncState('layout-1', {
      modifiedAt: 1000,
      lastSyncAt: 1000,
    });

    markLayoutModified('layout-1');
    expect(hasLocalChanges('layout-1')).toBe(true);

    clearLocalModification('layout-1');
    expect(hasLocalChanges('layout-1')).toBe(false);
  });

  it('updateActiveCollectionLayout updates layout metadata', () => {
    const { setActiveCollectionLayouts, updateActiveCollectionLayout } = useCollectionStore.getState();

    // Set up initial layouts
    setActiveCollectionLayouts([
      { id: 'layout-1', name: 'Original Name', modifiedAt: 1000 },
      { id: 'layout-2', name: 'Other Layout', modifiedAt: 1000 },
    ]);

    // Update layout name
    updateActiveCollectionLayout('layout-1', { name: 'New Name', modifiedAt: 2000 });

    const layouts = useCollectionStore.getState().activeCollectionLayouts;
    expect(layouts[0].name).toBe('New Name');
    expect(layouts[0].modifiedAt).toBe(2000);
    expect(layouts[1].name).toBe('Other Layout'); // Unchanged
  });
});

describe('sync flow scenarios', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      layout: createDefaultLayout(),
      activeLayoutId: null,
      lastEditSource: null,
    });
    useCollectionStore.setState({
      memberships: [],
      activeCollectionId: null,
      syncStates: {},
      activeCollectionLayouts: [],
    });
  });

  describe('remote import should not trigger push', () => {
    it('simulates the full flow of receiving a remote update', () => {
      // This test simulates what happens when another user makes a change
      // and it arrives via PartyKit

      const pushTriggers: string[] = [];

      // Set up a subscription that simulates useCollectionSync's behavior
      const unsubscribe = useLayoutStore.subscribe((state) => {
        // Skip if this was a remote import
        if (state.lastEditSource === 'remote') {
          // This is what we want - remote imports should be skipped
          return;
        }
        // Skip if this was init
        if (state.lastEditSource === 'init') {
          return;
        }
        // This would trigger a push in the real code
        pushTriggers.push(state.layout.name);
      });

      const { importLayout } = useLayoutStore.getState();

      // Simulate receiving a remote update
      const remoteLayout = createDefaultLayout();
      remoteLayout.name = 'Remote Update';
      importLayout(remoteLayout, 'layout-id', 'remote');

      unsubscribe();

      // Push should NOT have been triggered
      expect(pushTriggers).toHaveLength(0);
    });

    it('local edit DOES trigger push', () => {
      const pushTriggers: string[] = [];

      const unsubscribe = useLayoutStore.subscribe((state) => {
        if (state.lastEditSource === 'remote' || state.lastEditSource === 'init') {
          return;
        }
        pushTriggers.push(state.layout.name);
      });

      const { importLayout } = useLayoutStore.getState();

      // Simulate a local edit (default source is 'local')
      const localLayout = createDefaultLayout();
      localLayout.name = 'Local Edit';
      importLayout(localLayout, 'layout-id');

      unsubscribe();

      // Push SHOULD have been triggered for local edit
      expect(pushTriggers).toHaveLength(1);
      expect(pushTriggers[0]).toBe('Local Edit');
    });
  });

  describe('conflict detection', () => {
    it('can detect when server has newer version during local changes', () => {
      const { setSyncState, markLayoutModified, hasLocalChanges } = useCollectionStore.getState();

      // Set up initial sync state
      setSyncState('layout-1', {
        modifiedAt: 1000,
        lastSyncAt: 1000,
      });

      // User makes local changes
      markLayoutModified('layout-1');
      expect(hasLocalChanges('layout-1')).toBe(true);

      // Simulate poll response showing server has newer version (modifiedAt: 2000)
      // In real code, this would trigger conflict detection
      const serverModifiedAt = 2000;
      const localSyncState = useCollectionStore.getState().syncStates['layout-1'];

      const hasLocalMods = hasLocalChanges('layout-1');
      const serverIsNewer = serverModifiedAt > (localSyncState?.modifiedAt ?? 0);

      // Conflict condition
      expect(hasLocalMods && serverIsNewer).toBe(true);
    });

    it('no conflict when no local changes exist', () => {
      const { setSyncState, hasLocalChanges } = useCollectionStore.getState();

      // Set up initial sync state
      setSyncState('layout-1', {
        modifiedAt: 1000,
        lastSyncAt: 1000,
      });

      // No local changes
      expect(hasLocalChanges('layout-1')).toBe(false);

      // Server has newer version
      const serverModifiedAt = 2000;
      const localSyncState = useCollectionStore.getState().syncStates['layout-1'];

      const hasLocalMods = hasLocalChanges('layout-1');
      const serverIsNewer = serverModifiedAt > (localSyncState?.modifiedAt ?? 0);

      // No conflict because no local changes
      expect(hasLocalMods && serverIsNewer).toBe(false);
      expect(serverIsNewer).toBe(true); // Server IS newer, just no conflict
    });
  });
});
