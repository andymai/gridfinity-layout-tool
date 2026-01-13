/**
 * Tests for localStorage → IndexedDB migration.
 * These tests verify that existing layout data is properly migrated
 * from localStorage to IndexedDB for improved storage capacity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  migrateLayoutToIndexedDB,
  migrateAllLayoutsToIndexedDB,
  isMigrationNeeded,
  getMigrationStatus,
  clearMigrationFlag,
} from '../../utils/migration';
import {
  loadLayout as loadFromIndexedDB,
  clearAllData as clearIndexedDB,
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

// Helper to set up localStorage with test data
function setLocalStorageLayout(layoutId: string, layout: Layout): void {
  const key = `gridfinity-layout-${layoutId}`;
  localStorage.setItem(key, JSON.stringify(layout));
}

describe('Migration utilities', () => {
  beforeEach(async () => {
    // Clear both storage systems
    localStorage.clear();
    await clearIndexedDB();
  });

  afterEach(async () => {
    localStorage.clear();
    await clearIndexedDB();
  });

  describe('isMigrationNeeded', () => {
    it('should return false when no layouts in localStorage', async () => {
      const needed = await isMigrationNeeded();
      expect(needed).toBe(false);
    });

    it('should return true when layouts exist in localStorage but not in IndexedDB', async () => {
      const layout = createTestLayout();
      setLocalStorageLayout('test-id-123', layout);

      const needed = await isMigrationNeeded();
      expect(needed).toBe(true);
    });

    it('should return false when migration has already been completed', async () => {
      const layout = createTestLayout();
      setLocalStorageLayout('test-id-123', layout);

      // Run migration
      await migrateAllLayoutsToIndexedDB();

      const needed = await isMigrationNeeded();
      expect(needed).toBe(false);
    });

    it('should return false if migration flag is set', async () => {
      const layout = createTestLayout();
      setLocalStorageLayout('test-id-123', layout);

      // Manually set migration flag (simulating previous migration)
      localStorage.setItem('gridfinity-indexeddb-migrated', 'true');

      const needed = await isMigrationNeeded();
      expect(needed).toBe(false);
    });
  });

  describe('migrateLayoutToIndexedDB', () => {
    it('should migrate a single layout from localStorage to IndexedDB', async () => {
      const layout = createTestLayout({ name: 'My Workshop' });
      const layoutId = 'layout-abc-123';
      setLocalStorageLayout(layoutId, layout);

      const result = await migrateLayoutToIndexedDB(layoutId);

      expect(result.success).toBe(true);

      // Verify data in IndexedDB
      const loaded = await loadFromIndexedDB(layoutId);
      expect(loaded).toEqual(layout);
    });

    it('should return error for non-existent layout', async () => {
      const result = await migrateLayoutToIndexedDB('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for invalid JSON in localStorage', async () => {
      const key = 'gridfinity-layout-invalid-json';
      localStorage.setItem(key, 'not valid json {{{');

      const result = await migrateLayoutToIndexedDB('invalid-json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('parse');
    });

    it('should preserve all layout data during migration', async () => {
      const layout = createTestLayout({
        name: 'Complex Layout',
        bins: Array.from({ length: 50 }, (_, i) => ({
          id: `bin${i}`,
          layerId: 'layer1',
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          depth: 1,
          height: 3,
          category: 'cat1',
          label: `Label ${i}`,
          notes: `Notes for bin ${i}`,
        })),
      });
      const layoutId = 'complex-layout';
      setLocalStorageLayout(layoutId, layout);

      await migrateLayoutToIndexedDB(layoutId);

      const loaded = await loadFromIndexedDB(layoutId);
      expect(loaded).toEqual(layout);
      expect(loaded?.bins).toHaveLength(50);
    });
  });

  describe('migrateAllLayoutsToIndexedDB', () => {
    it('should migrate all layouts from localStorage', async () => {
      const layout1 = createTestLayout({ name: 'Layout 1' });
      const layout2 = createTestLayout({ name: 'Layout 2' });
      const layout3 = createTestLayout({ name: 'Layout 3' });

      setLocalStorageLayout('id-1', layout1);
      setLocalStorageLayout('id-2', layout2);
      setLocalStorageLayout('id-3', layout3);

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(3);

      // Verify all layouts are in IndexedDB
      expect(await loadFromIndexedDB('id-1')).toEqual(layout1);
      expect(await loadFromIndexedDB('id-2')).toEqual(layout2);
      expect(await loadFromIndexedDB('id-3')).toEqual(layout3);
    });

    it('should return success with 0 count when no layouts exist', async () => {
      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
    });

    it('should set migration flag after successful migration', async () => {
      const layout = createTestLayout();
      setLocalStorageLayout('test-id', layout);

      await migrateAllLayoutsToIndexedDB();

      expect(localStorage.getItem('gridfinity-indexeddb-migrated')).toBe('true');
    });

    it('should skip non-layout keys in localStorage', async () => {
      const layout = createTestLayout();
      setLocalStorageLayout('real-layout', layout);

      // Add non-layout items
      localStorage.setItem('gridfinity-library-v1', JSON.stringify({ version: '1.0' }));
      localStorage.setItem('gridfinity-settings-v1', JSON.stringify({ theme: 'dark' }));
      localStorage.setItem('some-other-key', 'value');

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1); // Only the layout
    });

    it('should report partial failures', async () => {
      const validLayout = createTestLayout({ name: 'Valid' });
      setLocalStorageLayout('valid-id', validLayout);

      // Add invalid layout
      localStorage.setItem('gridfinity-layout-invalid', '{broken json');

      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.success).toBe(true); // Partial success
      expect(result.migratedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('invalid');
    });

    it('should not re-migrate layouts already in IndexedDB', async () => {
      const layout = createTestLayout({ name: 'Already Migrated' });
      setLocalStorageLayout('existing-id', layout);

      // First migration
      await migrateAllLayoutsToIndexedDB();

      // Modify localStorage version (simulating edit)
      const modifiedLayout = createTestLayout({ name: 'Modified Version' });
      setLocalStorageLayout('existing-id', modifiedLayout);

      // Clear migration flag to allow re-check
      clearMigrationFlag();

      // Second migration should skip (already migrated)
      const result = await migrateAllLayoutsToIndexedDB();

      expect(result.skippedCount).toBe(1);

      // IndexedDB should still have original (not overwritten)
      const loaded = await loadFromIndexedDB('existing-id');
      expect(loaded?.name).toBe('Already Migrated');
    });
  });

  describe('getMigrationStatus', () => {
    it('should return status with layout counts', async () => {
      setLocalStorageLayout('id-1', createTestLayout());
      setLocalStorageLayout('id-2', createTestLayout());

      const status = await getMigrationStatus();

      expect(status.localStorageCount).toBe(2);
      expect(status.indexedDBCount).toBe(0);
      expect(status.migrationComplete).toBe(false);
    });

    it('should report migration complete after migration', async () => {
      setLocalStorageLayout('id-1', createTestLayout());

      await migrateAllLayoutsToIndexedDB();

      const status = await getMigrationStatus();

      expect(status.migrationComplete).toBe(true);
      expect(status.indexedDBCount).toBe(1);
    });
  });

  describe('clearMigrationFlag', () => {
    it('should clear the migration flag', async () => {
      localStorage.setItem('gridfinity-indexeddb-migrated', 'true');

      clearMigrationFlag();

      expect(localStorage.getItem('gridfinity-indexeddb-migrated')).toBeNull();
    });
  });
});
