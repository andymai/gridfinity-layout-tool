import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isIndexedDBAvailable,
  openLayoutDatabase,
  saveLayout,
  loadLayout,
  deleteLayout,
  getAllLayoutIds,
  clearAllData,
  closeDatabase,
} from '@/core/storage/backends/indexedDB';
import type { Layout } from '@/core/types';

// Test fixtures
function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: 1,
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
    bins: [],
    categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    ...overrides,
  };
}

describe('indexedDB backend', () => {
  // Clean up before and after each test to ensure isolation
  beforeEach(async () => {
    closeDatabase();
  });

  afterEach(async () => {
    try {
      closeDatabase();
      await clearAllData();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('isIndexedDBAvailable', () => {
    it('returns true when IndexedDB is available', async () => {
      const available = await isIndexedDBAvailable();
      expect(available).toBe(true);
    });
  });

  describe('openLayoutDatabase', () => {
    it('opens and returns database instance', async () => {
      const db = await openLayoutDatabase();

      expect(db).toBeDefined();
      expect(db.name).toBe('gridfinity-db');
      expect(db.version).toBe(1);
    });

    it('creates layouts object store', async () => {
      const db = await openLayoutDatabase();

      expect(db.objectStoreNames.contains('layouts')).toBe(true);
    });

    it('returns cached instance on subsequent calls', async () => {
      const db1 = await openLayoutDatabase();
      const db2 = await openLayoutDatabase();

      expect(db1).toBe(db2);
    });
  });

  describe('saveLayout', () => {
    it('saves a layout to IndexedDB', async () => {
      const layout = createTestLayout({ name: 'Saved Layout' });

      await saveLayout('test-id-1', layout);

      // Verify by loading
      const loaded = await loadLayout('test-id-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('Saved Layout');
    });

    it('saves layout with compression', async () => {
      const layout = createTestLayout({ name: 'Compressed Layout' });

      await saveLayout('compressed-id', layout);

      // Verify the layout round-trips correctly
      const loaded = await loadLayout('compressed-id');
      expect(loaded).toEqual(layout);
    });

    it('overwrites existing layout with same ID', async () => {
      const layout1 = createTestLayout({ name: 'Original' });
      const layout2 = createTestLayout({ name: 'Updated' });

      await saveLayout('overwrite-id', layout1);
      await saveLayout('overwrite-id', layout2);

      const loaded = await loadLayout('overwrite-id');
      expect(loaded?.name).toBe('Updated');
    });

    it('saves layout with bins', async () => {
      const layout = createTestLayout({
        name: 'Layout with Bins',
        bins: [
          {
            id: 'bin-1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: 'layer-1',
            category: 'default',
          },
          {
            id: 'bin-2',
            x: 2,
            y: 0,
            width: 3,
            depth: 2,
            height: 3,
            layerId: 'layer-1',
            category: 'default',
          },
        ],
      });

      await saveLayout('bins-id', layout);

      const loaded = await loadLayout('bins-id');
      expect(loaded?.bins).toHaveLength(2);
      expect(loaded?.bins[0].id).toBe('bin-1');
      expect(loaded?.bins[1].id).toBe('bin-2');
    });

    it('saves layout with multiple layers', async () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer-1', name: 'Bottom', height: 3 },
          { id: 'layer-2', name: 'Middle', height: 3 },
          { id: 'layer-3', name: 'Top', height: 3 },
        ],
      });

      await saveLayout('layers-id', layout);

      const loaded = await loadLayout('layers-id');
      expect(loaded?.layers).toHaveLength(3);
      expect(loaded?.layers.map((l) => l.name)).toEqual(['Bottom', 'Middle', 'Top']);
    });

    it('saves layout with categories', async () => {
      const layout = createTestLayout({
        categories: [
          { id: 'tools', name: 'Tools', color: '#ff0000' },
          { id: 'screws', name: 'Screws', color: '#00ff00' },
          { id: 'misc', name: 'Miscellaneous', color: '#0000ff' },
        ],
      });

      await saveLayout('categories-id', layout);

      const loaded = await loadLayout('categories-id');
      expect(loaded?.categories).toHaveLength(3);
    });

    it('saves layout with fractional edges', async () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12, fractionalEdgeX: 0.5, fractionalEdgeY: 0.5 },
      });

      await saveLayout('fractional-id', layout);

      const loaded = await loadLayout('fractional-id');
      expect(loaded?.drawer.fractionalEdgeX).toBe(0.5);
      expect(loaded?.drawer.fractionalEdgeY).toBe(0.5);
    });
  });

  describe('loadLayout', () => {
    it('returns null for non-existent layout', async () => {
      const layout = await loadLayout('non-existent-id');

      expect(layout).toBeNull();
    });

    it('loads previously saved layout', async () => {
      const original = createTestLayout({ name: 'To Be Loaded' });
      await saveLayout('load-test-id', original);

      const loaded = await loadLayout('load-test-id');

      expect(loaded).toEqual(original);
    });

    it('preserves all layout properties on round-trip', async () => {
      const original: Layout = {
        version: 1,
        name: 'Full Layout',
        drawer: { width: 15, depth: 10, height: 20 },
        layers: [
          { id: 'layer-1', name: 'Layer 1', height: 5 },
          { id: 'layer-2', name: 'Layer 2', height: 5 },
        ],
        bins: [
          {
            id: 'bin-1',
            x: 0,
            y: 0,
            width: 3,
            depth: 3,
            height: 5,
            layerId: 'layer-1',
            category: 'tools',
            label: 'Screwdrivers',
            notes: 'Various sizes',
          },
        ],
        categories: [
          { id: 'tools', name: 'Tools', color: '#e74c3c' },
          { id: 'parts', name: 'Parts', color: '#3498db' },
        ],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      };

      await saveLayout('full-props-id', original);
      const loaded = await loadLayout('full-props-id');

      expect(loaded).toEqual(original);
    });
  });

  describe('deleteLayout', () => {
    it('removes layout from IndexedDB', async () => {
      const layout = createTestLayout();
      await saveLayout('delete-test-id', layout);

      // Verify it exists
      expect(await loadLayout('delete-test-id')).not.toBeNull();

      await deleteLayout('delete-test-id');

      // Verify it's gone
      expect(await loadLayout('delete-test-id')).toBeNull();
    });

    it('does not throw when deleting non-existent layout', async () => {
      // Should not throw
      await expect(deleteLayout('non-existent')).resolves.not.toThrow();
    });

    it('only removes specified layout', async () => {
      const layout1 = createTestLayout({ name: 'Layout 1' });
      const layout2 = createTestLayout({ name: 'Layout 2' });

      await saveLayout('keep-id', layout1);
      await saveLayout('delete-id', layout2);

      await deleteLayout('delete-id');

      expect(await loadLayout('keep-id')).not.toBeNull();
      expect(await loadLayout('delete-id')).toBeNull();
    });
  });

  describe('getAllLayoutIds', () => {
    it('returns empty array when no layouts exist', async () => {
      const ids = await getAllLayoutIds();

      expect(ids).toEqual([]);
    });

    it('returns all stored layout IDs', async () => {
      await saveLayout('id-1', createTestLayout({ name: 'Layout 1' }));
      await saveLayout('id-2', createTestLayout({ name: 'Layout 2' }));
      await saveLayout('id-3', createTestLayout({ name: 'Layout 3' }));

      const ids = await getAllLayoutIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('id-1');
      expect(ids).toContain('id-2');
      expect(ids).toContain('id-3');
    });

    it('reflects deletions', async () => {
      await saveLayout('a', createTestLayout());
      await saveLayout('b', createTestLayout());
      await saveLayout('c', createTestLayout());

      await deleteLayout('b');

      const ids = await getAllLayoutIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('a');
      expect(ids).toContain('c');
      expect(ids).not.toContain('b');
    });
  });

  describe('clearAllData', () => {
    it('removes all layouts from database', async () => {
      await saveLayout('clear-1', createTestLayout());
      await saveLayout('clear-2', createTestLayout());
      await saveLayout('clear-3', createTestLayout());

      await clearAllData();

      const ids = await getAllLayoutIds();
      expect(ids).toEqual([]);
    });

    it('allows saving after clearing', async () => {
      await saveLayout('before-clear', createTestLayout({ name: 'Before' }));
      await clearAllData();

      await saveLayout('after-clear', createTestLayout({ name: 'After' }));

      const loaded = await loadLayout('after-clear');
      expect(loaded?.name).toBe('After');
    });
  });

  describe('closeDatabase', () => {
    it('closes database connection', async () => {
      // Open database first
      await openLayoutDatabase();

      // Close should not throw
      closeDatabase();

      // Should be able to reopen
      const db = await openLayoutDatabase();
      expect(db).toBeDefined();
    });

    it('handles multiple close calls gracefully', () => {
      closeDatabase();
      closeDatabase();
      closeDatabase();
      // Should not throw
    });
  });

  describe('concurrent operations', () => {
    it('handles multiple saves sequentially', async () => {
      // Save multiple layouts (sequential to avoid fake-indexeddb race conditions)
      for (let i = 0; i < 5; i++) {
        const layout = createTestLayout({ name: `Layout ${i}` });
        await saveLayout(`seq-${i}`, layout);
      }

      // Verify all were saved
      const ids = await getAllLayoutIds();
      expect(ids).toHaveLength(5);

      // Verify data integrity
      for (let i = 0; i < 5; i++) {
        const loaded = await loadLayout(`seq-${i}`);
        expect(loaded?.name).toBe(`Layout ${i}`);
      }
    });

    it('handles multiple reads of same layout', async () => {
      const layout = createTestLayout({ name: 'Read Test' });
      await saveLayout('read-test', layout);

      // Multiple reads (sequential)
      const read1 = await loadLayout('read-test');
      const read2 = await loadLayout('read-test');
      const read3 = await loadLayout('read-test');

      expect(read1?.name).toBe('Read Test');
      expect(read2?.name).toBe('Read Test');
      expect(read3?.name).toBe('Read Test');
    });
  });

  describe('edge cases', () => {
    it('handles empty layout name', async () => {
      const layout = createTestLayout({ name: '' });

      await saveLayout('empty-name', layout);

      const loaded = await loadLayout('empty-name');
      expect(loaded?.name).toBe('');
    });

    it('handles layout with empty bins array', async () => {
      const layout = createTestLayout({ bins: [] });

      await saveLayout('empty-bins', layout);

      const loaded = await loadLayout('empty-bins');
      expect(loaded?.bins).toEqual([]);
    });

    it('handles layout with large number of bins', async () => {
      const bins = Array.from({ length: 100 }, (_, i) => ({
        id: `bin-${i}`,
        x: i % 10,
        y: Math.floor(i / 10),
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'layer-1',
        category: 'default',
      }));

      const layout = createTestLayout({ bins });

      await saveLayout('many-bins', layout);

      const loaded = await loadLayout('many-bins');
      expect(loaded?.bins).toHaveLength(100);
    });

    it('handles special characters in layout ID', async () => {
      const layout = createTestLayout({ name: 'Special ID' });
      const specialId = 'layout-with-special_chars.123';

      await saveLayout(specialId, layout);

      const loaded = await loadLayout(specialId);
      expect(loaded?.name).toBe('Special ID');
    });

    it('handles unicode in layout name', async () => {
      const layout = createTestLayout({ name: '抽屉布局 Küchenschublade' });

      await saveLayout('unicode-name', layout);

      const loaded = await loadLayout('unicode-name');
      expect(loaded?.name).toBe('抽屉布局 Küchenschublade');
    });

    it('handles bin with optional properties', async () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'full-bin',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: 'layer-1',
            category: 'default',
            label: 'Test Label',
            notes: 'Some notes here',
            clearanceHeight: 5,
            customProperties: {
              'custom-key': 'custom-value',
            },
          },
        ],
      });

      await saveLayout('full-bin-layout', layout);

      const loaded = await loadLayout('full-bin-layout');
      const bin = loaded?.bins[0];
      expect(bin?.label).toBe('Test Label');
      expect(bin?.notes).toBe('Some notes here');
      expect(bin?.clearanceHeight).toBe(5);
      expect(bin?.customProperties?.['custom-key']).toBe('custom-value');
    });
  });
});
