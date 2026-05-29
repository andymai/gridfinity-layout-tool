// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveDesign,
  loadDesign,
  listDesigns,
  deleteDesign,
  duplicateDesign,
  updateDesignParams,
  closeDesignerDb,
  getActiveDesignId,
  setActiveDesignId,
  createNewDesign,
  initializeDesigner,
  updateDesignTags,
} from '@/features/bin-designer/storage/DesignerStorage';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';
import { expectOk, expectErr } from '@/test/testUtils';

describe('DesignerStorage', () => {
  beforeEach(async () => {
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to delete database'));
    });
  });

  describe('saveDesign', () => {
    it('should save a new design with generated ID', async () => {
      const result = await saveDesign({
        name: 'Test Bin',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(result);
      expect(value.id).toMatch(/^design_/);
      expect(value.name).toBe('Test Bin');
      expect(value.params).toEqual(DEFAULT_BIN_PARAMS);
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
    });

    it('should save with a provided ID', async () => {
      const result = await saveDesign({
        id: 'custom-id-123',
        name: 'Custom ID Bin',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(result);
      expect(value.id).toBe('custom-id-123');
    });

    it('should update existing design preserving createdAt', async () => {
      const firstResult = await saveDesign({
        id: 'update-test',
        name: 'First',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const firstValue = expectOk(firstResult);
      const firstCreatedAt = firstValue.createdAt;

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const secondResult = await saveDesign({
        id: 'update-test',
        name: 'Updated',
        params: { ...DEFAULT_BIN_PARAMS, width: 4 },
        thumbnail: null,
      });

      const secondValue = expectOk(secondResult);
      expect(secondValue.name).toBe('Updated');
      expect(secondValue.createdAt).toBe(firstCreatedAt);
      expect(secondValue.updatedAt).not.toBe(firstCreatedAt);
    });
  });

  describe('loadDesign', () => {
    it('should load a saved design', async () => {
      await saveDesign({
        id: 'load-test',
        name: 'Load Test',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const result = await loadDesign('load-test');
      const value = expectOk(result);
      expect(value.name).toBe('Load Test');
      expect(value.params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('should migrate old designs without compartments field', async () => {
      // Simulate an old design saved before compartments feature
      const oldParams = { ...DEFAULT_BIN_PARAMS };
      // @ts-expect-error - Simulating old data without compartments
      delete oldParams.compartments;

      await saveDesign({
        id: 'old-design',
        name: 'Old Design',
        // @ts-expect-error - Intentionally passing incomplete params
        params: oldParams,
        thumbnail: null,
      });

      const result = await loadDesign('old-design');
      const value = expectOk(result);
      expect(value.name).toBe('Old Design');
      // Should have migrated compartments
      expect(value.params.compartments).toBeDefined();
      expect(value.params.compartments.cells).toBeDefined();
      expect(Array.isArray(value.params.compartments.cells)).toBe(true);
    });

    it('should return error for non-existent design', async () => {
      const result = await loadDesign('nonexistent');
      expectErr(result);
    });

    it('should return corruption error when params is null', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: 'temp-design',
        name: 'Temp',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      // Now directly inject corrupted data using raw IndexedDB
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-null',
        name: 'Corrupted Design',
        params: null,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await loadDesign('corrupted-null');
      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-null');
    });

    it('should return corruption error when params is a primitive', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: 'temp-design-2',
        name: 'Temp 2',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      // Now directly inject corrupted data
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-primitive',
        name: 'Corrupted Design',
        params: 'invalid-string' as unknown,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await loadDesign('corrupted-primitive');
      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-primitive');
    });

    it('should return corruption error when params is an array', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: 'temp-design-3',
        name: 'Temp 3',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      // Now directly inject corrupted data
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-array',
        name: 'Corrupted Design',
        params: [] as unknown,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await loadDesign('corrupted-array');
      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-array');
    });
  });

  describe('listDesigns', () => {
    it('should list all designs sorted by updatedAt', async () => {
      await saveDesign({
        id: 'first',
        name: 'First',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });
      await new Promise((r) => setTimeout(r, 10));
      await saveDesign({
        id: 'second',
        name: 'Second',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const result = await listDesigns();
      const value = expectOk(result);
      expect(value.length).toBe(2);
      expect(value[0].name).toBe('Second'); // most recent first
      expect(value[1].name).toBe('First');
    });

    it('should migrate old designs without compartments field', async () => {
      const oldParams = { ...DEFAULT_BIN_PARAMS };
      // @ts-expect-error - Simulating old data without compartments
      delete oldParams.compartments;

      await saveDesign({
        id: 'old-list-test',
        name: 'Old Design in List',
        // @ts-expect-error - Intentionally passing incomplete params
        params: oldParams,
        thumbnail: null,
      });

      const result = await listDesigns();
      const value = expectOk(result);
      expect(value.length).toBe(1);
      expect(value[0].params.compartments).toBeDefined();
      expect(value[0].params.compartments.cells).toBeDefined();
    });

    it('should return empty list when no designs exist', async () => {
      const result = await listDesigns();
      const value = expectOk(result);
      expect(value).toEqual([]);
    });

    it('should filter out corrupted designs with null params', async () => {
      // Save one valid design
      await saveDesign({
        id: 'valid-design',
        name: 'Valid Design',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      // Directly inject corrupted data to IndexedDB
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-list',
        name: 'Corrupted Design',
        params: null,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await listDesigns();
      const value = expectOk(result);
      // Should only return the valid design, filtering out the corrupted one
      expect(value.length).toBe(1);
      expect(value[0].id).toBe('valid-design');
    });

    it('should filter out corrupted designs with primitive params', async () => {
      // Save one valid design
      await saveDesign({
        id: 'valid-design-2',
        name: 'Valid Design 2',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      // Directly inject corrupted data with string params
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-string',
        name: 'Corrupted String',
        params: 'invalid' as unknown,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await listDesigns();
      const value = expectOk(result);
      expect(value.length).toBe(1);
      expect(value[0].id).toBe('valid-design-2');
    });

    it('should handle mix of valid and corrupted designs', async () => {
      // Save valid designs
      await saveDesign({
        id: 'valid-1',
        name: 'Valid 1',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });
      await saveDesign({
        id: 'valid-2',
        name: 'Valid 2',
        params: { ...DEFAULT_BIN_PARAMS, width: 3 },
        thumbnail: null,
      });

      // Add multiple corrupted entries
      const { openDB } = await import('idb');
      const db = await openDB('gridfinity-designer-v1', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('designs')) {
            const store = db.createObjectStore('designs', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        },
      });
      await db.put('designs', {
        id: 'corrupted-1',
        name: 'Corrupted 1',
        params: null,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await db.put('designs', {
        id: 'corrupted-2',
        name: 'Corrupted 2',
        params: 123 as unknown,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.close();

      const result = await listDesigns();
      const value = expectOk(result);
      // Should return only the 2 valid designs
      expect(value.length).toBe(2);
      expect(value.map((d) => d.id).sort()).toEqual(['valid-1', 'valid-2']);
    });
  });

  describe('deleteDesign', () => {
    it('should delete an existing design', async () => {
      await saveDesign({
        id: 'delete-test',
        name: 'Delete Me',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const deleteResult = await deleteDesign('delete-test');
      expectOk(deleteResult);

      const loadResult = await loadDesign('delete-test');
      expectErr(loadResult);
    });

    it('should return error for non-existent design', async () => {
      const result = await deleteDesign('nonexistent');
      expectErr(result);
    });
  });

  describe('duplicateDesign', () => {
    it('should duplicate a design with new ID and name', async () => {
      await saveDesign({
        id: 'original-design',
        name: 'My Bin',
        params: { ...DEFAULT_BIN_PARAMS, width: 3 },
        thumbnail: 'data:image/test',
      });

      const result = await duplicateDesign('original-design');

      const value = expectOk(result);
      expect(value.id).not.toBe('original-design');
      expect(value.id).toMatch(/^design_/);
      expect(value.name).toBe('Copy of My Bin');
      expect(value.params.width).toBe(3);
      expect(value.thumbnail).toBe('data:image/test');
    });

    it('should return error for non-existent design', async () => {
      const result = await duplicateDesign('nonexistent');
      expectErr(result);
    });
  });

  describe('updateDesignParams', () => {
    it('should update params of existing design', async () => {
      await saveDesign({
        id: 'params-test',
        name: 'Params Test',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      const newParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 4, height: 6 };
      const result = await updateDesignParams('params-test', newParams);

      const value = expectOk(result);
      expect(value.params.width).toBe(4);
      expect(value.params.height).toBe(6);
      expect(value.name).toBe('Params Test'); // name preserved
    });

    it('should return error for non-existent design', async () => {
      const result = await updateDesignParams('nonexistent', DEFAULT_BIN_PARAMS);
      expectErr(result);
    });
  });

  describe('activeDesignId', () => {
    const ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

    afterEach(() => {
      localStorage.removeItem(ACTIVE_DESIGN_KEY);
    });

    it('should return null when no active design is set', () => {
      expect(getActiveDesignId()).toBeNull();
    });

    it('should set and get active design ID', () => {
      setActiveDesignId('test-design-123');
      expect(getActiveDesignId()).toBe('test-design-123');
    });

    it('should clear active design ID when set to null', () => {
      setActiveDesignId('test-design-123');
      setActiveDesignId(null);
      expect(getActiveDesignId()).toBeNull();
    });
  });

  describe('createNewDesign', () => {
    it('should create a new design with default params', async () => {
      const result = await createNewDesign();

      const value = expectOk(result);
      expect(value.id).toMatch(/^design_/);
      expect(value.name).toBe('Untitled Bin');
      expect(value.params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('should create a new design with custom name', async () => {
      const result = await createNewDesign('My Custom Bin');

      const value = expectOk(result);
      expect(value.name).toBe('My Custom Bin');
    });
  });

  describe('initializeDesigner', () => {
    const ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

    afterEach(() => {
      localStorage.removeItem(ACTIVE_DESIGN_KEY);
    });

    it('should create a new design when no active design exists', async () => {
      const result = await initializeDesigner();

      const value = expectOk(result);
      expect(value.name).toBe('Untitled Bin');
      expect(value.params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('should load existing active design', async () => {
      // Create a design first
      const createResult = await saveDesign({
        id: 'existing-design',
        name: 'Existing Design',
        params: { ...DEFAULT_BIN_PARAMS, width: 5 },
        thumbnail: null,
      });
      expectOk(createResult);

      // Set it as active
      setActiveDesignId('existing-design');

      // Initialize should load it
      const result = await initializeDesigner();

      const value = expectOk(result);
      expect(value.id).toBe('existing-design');
      expect(value.name).toBe('Existing Design');
      expect(value.params.width).toBe(5);
    });

    it('should create new design if active design was deleted', async () => {
      // Set a non-existent design as active
      setActiveDesignId('deleted-design');

      const result = await initializeDesigner();

      const value = expectOk(result);
      // Should create a new design, not the deleted one
      expect(value.id).not.toBe('deleted-design');
      expect(value.name).toBe('Untitled Bin');

      // Should have cleared the stale reference
      expect(getActiveDesignId()).not.toBe('deleted-design');
    });
  });

  describe('tags', () => {
    it('persists and reloads tags', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Tagged',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          tags: ['kitchen', 'screws'],
        })
      );
      const loaded = expectOk(await loadDesign(saved.id));
      expect(loaded.tags).toEqual(['kitchen', 'screws']);
    });

    it('normalizes tags on save (trim, dedupe, drop empty)', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Messy',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          tags: [' Kitchen ', 'kitchen', '', '  '],
        })
      );
      expect(saved.tags).toEqual(['Kitchen']);
    });

    it('omits the tags field entirely when there are no tags', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Untagged',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      expect(saved.tags).toBeUndefined();
    });

    it('preserves existing tags when an update omits them', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Keep',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          tags: ['keep-me'],
        })
      );
      const renamed = expectOk(
        await saveDesign({
          id: saved.id,
          name: 'Renamed',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      expect(renamed.tags).toEqual(['keep-me']);
    });

    it('updateDesignTags replaces the tag set and can clear it', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Edit',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          tags: ['old'],
        })
      );
      const tagged = expectOk(await updateDesignTags(saved.id, ['new', 'fresh']));
      expect(tagged.tags).toEqual(['new', 'fresh']);
      const cleared = expectOk(await updateDesignTags(saved.id, []));
      expect(cleared.tags).toBeUndefined();
    });

    it('carries tags through duplicate', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Original',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          tags: ['kitchen'],
        })
      );
      const dup = expectOk(await duplicateDesign(saved.id));
      expect(dup.tags).toEqual(['kitchen']);
    });
  });
});
