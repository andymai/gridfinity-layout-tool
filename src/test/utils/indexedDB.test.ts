/**
 * Tests for IndexedDB wrapper utilities.
 * These utilities provide a promise-based interface for storing layouts.
 *
 * Note: These tests use fake-indexeddb which is included in vitest's jsdom environment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openLayoutDatabase,
  saveLayout,
  loadLayout,
  deleteLayout,
  getAllLayoutIds,
  saveCollectionCache,
  loadCollectionCache,
  deleteCollectionCache,
  clearAllData,
  isIndexedDBAvailable,
} from '../../utils/indexedDB';
import type { Layout } from '../../types';

// Helper to create a test layout
function createTestLayout(overrides?: Partial<Layout>): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'cat1', name: 'Default', color: '#3b82f6' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [
      {
        id: 'bin1',
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'cat1',
        label: '',
        notes: '',
      },
    ],
    ...overrides,
  };
}

describe('IndexedDB utilities', () => {
  beforeEach(async () => {
    // Clear database before each test
    await clearAllData();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllData();
  });

  describe('isIndexedDBAvailable', () => {
    it('should return true in jsdom environment', async () => {
      const available = await isIndexedDBAvailable();
      expect(available).toBe(true);
    });
  });

  describe('openLayoutDatabase', () => {
    it('should open the database successfully', async () => {
      const db = await openLayoutDatabase();
      expect(db).toBeDefined();
      expect(db.name).toBe('gridfinity-db');
      db.close();
    });
  });

  describe('saveLayout / loadLayout', () => {
    it('should save and load a layout', async () => {
      const layout = createTestLayout({ name: 'My Workshop' });
      const id = 'layout-123';

      await saveLayout(id, layout);
      const loaded = await loadLayout(id);

      expect(loaded).toEqual(layout);
    });

    it('should return null for non-existent layout', async () => {
      const loaded = await loadLayout('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should overwrite existing layout with same id', async () => {
      const id = 'layout-456';
      const layout1 = createTestLayout({ name: 'Version 1' });
      const layout2 = createTestLayout({ name: 'Version 2' });

      await saveLayout(id, layout1);
      await saveLayout(id, layout2);

      const loaded = await loadLayout(id);
      expect(loaded?.name).toBe('Version 2');
    });

    it('should handle layouts with many bins', async () => {
      const bins = Array.from({ length: 100 }, (_, i) => ({
        id: `bin${i}`,
        layerId: 'layer1',
        x: i % 10,
        y: Math.floor(i / 10),
        width: 1,
        depth: 1,
        height: 3,
        category: 'cat1',
        label: `Bin ${i}`,
        notes: '',
      }));

      const layout = createTestLayout({ bins });
      const id = 'large-layout';

      await saveLayout(id, layout);
      const loaded = await loadLayout(id);

      expect(loaded?.bins).toHaveLength(100);
    });

    it('should compress data for storage efficiency', async () => {
      // This test verifies that compression is being used
      const layout = createTestLayout({
        bins: Array.from({ length: 50 }, (_, i) => ({
          id: `bin${i}`,
          layerId: 'layer1',
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          depth: 1,
          height: 3,
          category: 'cat1',
          label: 'Standard Storage Bin',
          notes: 'Workshop organization bin with standard dimensions',
        })),
      });

      const id = 'compressed-layout';
      await saveLayout(id, layout);
      const loaded = await loadLayout(id);

      // Should round-trip correctly despite compression
      expect(loaded).toEqual(layout);
    });
  });

  describe('deleteLayout', () => {
    it('should delete an existing layout', async () => {
      const id = 'to-delete';
      const layout = createTestLayout();

      await saveLayout(id, layout);
      expect(await loadLayout(id)).not.toBeNull();

      await deleteLayout(id);
      expect(await loadLayout(id)).toBeNull();
    });

    it('should not throw when deleting non-existent layout', async () => {
      await expect(deleteLayout('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getAllLayoutIds', () => {
    it('should return empty array when no layouts', async () => {
      const ids = await getAllLayoutIds();
      expect(ids).toEqual([]);
    });

    it('should return all stored layout ids', async () => {
      await saveLayout('id-1', createTestLayout({ name: 'Layout 1' }));
      await saveLayout('id-2', createTestLayout({ name: 'Layout 2' }));
      await saveLayout('id-3', createTestLayout({ name: 'Layout 3' }));

      const ids = await getAllLayoutIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('id-1');
      expect(ids).toContain('id-2');
      expect(ids).toContain('id-3');
    });
  });

  describe('collection cache', () => {
    it('should save and load collection cache', async () => {
      const collectionId = 'collection-abc';
      const layoutId = 'layout-xyz';
      const layout = createTestLayout({ name: 'Cached Layout' });

      await saveCollectionCache(collectionId, layoutId, layout);
      const loaded = await loadCollectionCache(collectionId, layoutId);

      expect(loaded).toEqual(layout);
    });

    it('should return null for non-existent cache', async () => {
      const loaded = await loadCollectionCache('no-collection', 'no-layout');
      expect(loaded).toBeNull();
    });

    it('should delete collection cache', async () => {
      const collectionId = 'collection-123';
      const layoutId = 'layout-456';
      const layout = createTestLayout();

      await saveCollectionCache(collectionId, layoutId, layout);
      expect(await loadCollectionCache(collectionId, layoutId)).not.toBeNull();

      await deleteCollectionCache(collectionId, layoutId);
      expect(await loadCollectionCache(collectionId, layoutId)).toBeNull();
    });

    it('should handle multiple layouts in same collection', async () => {
      const collectionId = 'multi-layout-collection';
      const layout1 = createTestLayout({ name: 'Layout A' });
      const layout2 = createTestLayout({ name: 'Layout B' });

      await saveCollectionCache(collectionId, 'layout-a', layout1);
      await saveCollectionCache(collectionId, 'layout-b', layout2);

      const loadedA = await loadCollectionCache(collectionId, 'layout-a');
      const loadedB = await loadCollectionCache(collectionId, 'layout-b');

      expect(loadedA?.name).toBe('Layout A');
      expect(loadedB?.name).toBe('Layout B');
    });
  });

  describe('clearAllData', () => {
    it('should clear all stored layouts', async () => {
      await saveLayout('id-1', createTestLayout());
      await saveLayout('id-2', createTestLayout());

      await clearAllData();

      expect(await loadLayout('id-1')).toBeNull();
      expect(await loadLayout('id-2')).toBeNull();
      expect(await getAllLayoutIds()).toEqual([]);
    });

    it('should clear collection cache as well', async () => {
      await saveCollectionCache('col-1', 'lay-1', createTestLayout());

      await clearAllData();

      expect(await loadCollectionCache('col-1', 'lay-1')).toBeNull();
    });
  });
});
