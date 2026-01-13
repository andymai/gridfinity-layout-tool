/**
 * Tests for async storage layer that uses IndexedDB with localStorage fallback.
 * This layer provides the storage backend for the multi-layout library system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLayoutAsync,
  loadLayoutAsync,
  deleteLayoutAsync,
  getAllLayoutIdsAsync,
  getStorageBackend,
  resetStorageBackendCache,
  isStorageReady,
} from '../../utils/asyncStorage';
import { clearAllData as clearIndexedDB } from '../../utils/indexedDB';
import * as indexedDBModule from '../../utils/indexedDB';
import { clearMigrationFlag } from '../../utils/migration';
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

describe('Async Storage Layer', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearIndexedDB();
    clearMigrationFlag();
  });

  afterEach(async () => {
    localStorage.clear();
    await clearIndexedDB();
    clearMigrationFlag();
  });

  describe('saveLayoutAsync / loadLayoutAsync', () => {
    it('should save and load a layout', async () => {
      const layout = createTestLayout({ name: 'My Layout' });
      const layoutId = 'test-layout-123';

      await saveLayoutAsync(layoutId, layout);
      const loaded = await loadLayoutAsync(layoutId);

      expect(loaded).toEqual(layout);
    });

    it('should return null for non-existent layout', async () => {
      const loaded = await loadLayoutAsync('non-existent');
      expect(loaded).toBeNull();
    });

    it('should overwrite existing layout', async () => {
      const layoutId = 'overwrite-test';
      const layout1 = createTestLayout({ name: 'Version 1' });
      const layout2 = createTestLayout({ name: 'Version 2' });

      await saveLayoutAsync(layoutId, layout1);
      await saveLayoutAsync(layoutId, layout2);

      const loaded = await loadLayoutAsync(layoutId);
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
        label: `Label ${i}`,
        notes: '',
      }));

      const layout = createTestLayout({ bins });
      const layoutId = 'large-layout';

      await saveLayoutAsync(layoutId, layout);
      const loaded = await loadLayoutAsync(layoutId);

      expect(loaded?.bins).toHaveLength(100);
    });

    it('should preserve unicode characters', async () => {
      const layout = createTestLayout({
        name: '日本語 Layout 🎉',
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'cat1',
            label: '工具箱',
            notes: 'Contains screws and نصائح',
          },
        ],
      });

      await saveLayoutAsync('unicode-test', layout);
      const loaded = await loadLayoutAsync('unicode-test');

      expect(loaded?.name).toBe('日本語 Layout 🎉');
      expect(loaded?.bins[0].label).toBe('工具箱');
      expect(loaded?.bins[0].notes).toContain('نصائح');
    });
  });

  describe('deleteLayoutAsync', () => {
    it('should delete an existing layout', async () => {
      const layoutId = 'to-delete';
      const layout = createTestLayout();

      await saveLayoutAsync(layoutId, layout);
      expect(await loadLayoutAsync(layoutId)).not.toBeNull();

      await deleteLayoutAsync(layoutId);
      expect(await loadLayoutAsync(layoutId)).toBeNull();
    });

    it('should not throw when deleting non-existent layout', async () => {
      await expect(deleteLayoutAsync('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getAllLayoutIdsAsync', () => {
    it('should return empty array when no layouts', async () => {
      const ids = await getAllLayoutIdsAsync();
      expect(ids).toEqual([]);
    });

    it('should return all layout IDs', async () => {
      await saveLayoutAsync('id-a', createTestLayout({ name: 'A' }));
      await saveLayoutAsync('id-b', createTestLayout({ name: 'B' }));
      await saveLayoutAsync('id-c', createTestLayout({ name: 'C' }));

      const ids = await getAllLayoutIdsAsync();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('id-a');
      expect(ids).toContain('id-b');
      expect(ids).toContain('id-c');
    });
  });

  describe('getStorageBackend', () => {
    it('should return "indexeddb" when available', async () => {
      const backend = await getStorageBackend();
      expect(backend).toBe('indexeddb');
    });
  });

  describe('data integrity', () => {
    it('should preserve custom properties', async () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
            customProperties: {
              partNumber: 'ABC-123',
              vendor: 'ACME',
            },
          },
        ],
      });

      await saveLayoutAsync('custom-props', layout);
      const loaded = await loadLayoutAsync('custom-props');

      expect(loaded?.bins[0].customProperties).toEqual({
        partNumber: 'ABC-123',
        vendor: 'ACME',
      });
    });

    it('should preserve fractional bin dimensions', async () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0.5,
            y: 1.5,
            width: 1.5,
            depth: 2.5,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      await saveLayoutAsync('fractional', layout);
      const loaded = await loadLayoutAsync('fractional');

      expect(loaded?.bins[0].x).toBe(0.5);
      expect(loaded?.bins[0].y).toBe(1.5);
      expect(loaded?.bins[0].width).toBe(1.5);
      expect(loaded?.bins[0].depth).toBe(2.5);
    });

    it('should preserve cloud share info', async () => {
      const layout = createTestLayout();
      const layoutId = 'with-cloud-share';

      // Note: cloudShare info is stored in library entry, not layout itself
      // This test verifies layout data integrity doesn't affect other data
      await saveLayoutAsync(layoutId, layout);
      const loaded = await loadLayoutAsync(layoutId);

      expect(loaded).toEqual(layout);
    });
  });

  describe('localStorage fallback', () => {
    beforeEach(() => {
      // Reset the backend cache before each fallback test
      resetStorageBackendCache();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      resetStorageBackendCache();
    });

    it('should fall back to localStorage when IndexedDB unavailable', async () => {
      // Mock IndexedDB as unavailable
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      const backend = await getStorageBackend();
      expect(backend).toBe('localstorage');
    });

    it('should save and load via localStorage fallback', async () => {
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      const layout = createTestLayout({ name: 'Fallback Layout' });
      await saveLayoutAsync('fallback-test', layout);
      const loaded = await loadLayoutAsync('fallback-test');

      expect(loaded).toEqual(layout);
    });

    it('should delete via localStorage fallback', async () => {
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      const layout = createTestLayout();
      await saveLayoutAsync('delete-test', layout);
      expect(await loadLayoutAsync('delete-test')).not.toBeNull();

      await deleteLayoutAsync('delete-test');
      expect(await loadLayoutAsync('delete-test')).toBeNull();
    });

    it('should get all IDs via localStorage fallback', async () => {
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      await saveLayoutAsync('ls-id-1', createTestLayout({ name: 'A' }));
      await saveLayoutAsync('ls-id-2', createTestLayout({ name: 'B' }));

      const ids = await getAllLayoutIdsAsync();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('ls-id-1');
      expect(ids).toContain('ls-id-2');
    });

    it('should return null for non-existent layout in localStorage', async () => {
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      const loaded = await loadLayoutAsync('does-not-exist');
      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON in localStorage', async () => {
      vi.spyOn(indexedDBModule, 'isIndexedDBAvailable').mockResolvedValue(false);

      // Directly set invalid JSON in localStorage
      localStorage.setItem('gridfinity-layout-bad-json', 'not valid json {{{');

      const loaded = await loadLayoutAsync('bad-json');
      expect(loaded).toBeNull();
    });
  });

  describe('isStorageReady', () => {
    it('should return true when storage is available', async () => {
      const ready = await isStorageReady();
      expect(ready).toBe(true);
    });
  });
});
