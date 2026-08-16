// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const trackDesignCreatedMock = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackDesignCreated: () => {
    trackDesignCreatedMock();
  },
}));
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
  clearDesignPublishedId,
  setDesignPublishedId,
} from '@/features/bin-designer/storage/DesignerStorage';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams, SavedDesign } from '../types';
import { expectOk, expectErr } from '@/test/testUtils';
import { designId } from '@/core/types';
import type { StorageError, StorageCorruptedError } from '@/core/result';

function expectStorageCorrupted(error: StorageError): StorageCorruptedError {
  if (error.code !== 'STORAGE_CORRUPTED') {
    throw new Error(`expected STORAGE_CORRUPTED, got ${error.code}`);
  }
  return error;
}

function expectBinParams(design: SavedDesign): BinParams {
  expect(design.params).toBeDefined();
  if (!design.params) throw new Error('expected design.params to be defined');
  return design.params;
}

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
        exportFileNameConfig: null,
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
        id: designId('custom-id-123'),
        name: 'Custom ID Bin',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const value = expectOk(result);
      expect(value.id).toBe('custom-id-123');
    });

    it('should update existing design preserving createdAt', async () => {
      const firstResult = await saveDesign({
        id: designId('update-test'),
        name: 'First',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const firstValue = expectOk(firstResult);
      const firstCreatedAt = firstValue.createdAt;

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const secondResult = await saveDesign({
        id: designId('update-test'),
        name: 'Updated',
        params: { ...DEFAULT_BIN_PARAMS, width: 4 },
        thumbnail: null,
        exportFileNameConfig: null,
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
        id: designId('load-test'),
        name: 'Load Test',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const result = await loadDesign(designId('load-test'));
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
        id: designId('old-design'),
        name: 'Old Design',
        params: oldParams,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const result = await loadDesign(designId('old-design'));
      const value = expectOk(result);
      expect(value.name).toBe('Old Design');
      // Should have migrated compartments
      const params = expectBinParams(value);
      expect(params.compartments).toBeDefined();
      expect(params.compartments.cells).toBeDefined();
      expect(Array.isArray(params.compartments.cells)).toBe(true);
    });

    it('should return error for non-existent design', async () => {
      const result = await loadDesign(designId('nonexistent'));
      expectErr(result);
    });

    it('should return corruption error when params is null', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: designId('temp-design'),
        name: 'Temp',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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

      const result = await loadDesign(designId('corrupted-null'));
      const error = expectStorageCorrupted(expectErr(result));
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-null');
    });

    it('should return corruption error when params is a primitive', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: designId('temp-design-2'),
        name: 'Temp 2',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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

      const result = await loadDesign(designId('corrupted-primitive'));
      const error = expectStorageCorrupted(expectErr(result));
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-primitive');
    });

    it('should return corruption error when params is an array', async () => {
      // First save a valid design to ensure DB is initialized
      await saveDesign({
        id: designId('temp-design-3'),
        name: 'Temp 3',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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

      const result = await loadDesign(designId('corrupted-array'));
      const error = expectStorageCorrupted(expectErr(result));
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.key).toBe('corrupted-array');
    });
  });

  describe('listDesigns', () => {
    it('should list all designs sorted by updatedAt', async () => {
      await saveDesign({
        id: designId('first'),
        name: 'First',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      await new Promise((r) => setTimeout(r, 10));
      await saveDesign({
        id: designId('second'),
        name: 'Second',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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
        id: designId('old-list-test'),
        name: 'Old Design in List',
        params: oldParams,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const result = await listDesigns();
      const value = expectOk(result);
      expect(value.length).toBe(1);
      const params = expectBinParams(value[0]);
      expect(params.compartments).toBeDefined();
      expect(params.compartments.cells).toBeDefined();
    });

    it('should return empty list when no designs exist', async () => {
      const result = await listDesigns();
      const value = expectOk(result);
      expect(value).toEqual([]);
    });

    it('should filter out corrupted designs with null params', async () => {
      // Save one valid design
      await saveDesign({
        id: designId('valid-design'),
        name: 'Valid Design',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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
        id: designId('valid-design-2'),
        name: 'Valid Design 2',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
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
        id: designId('valid-1'),
        name: 'Valid 1',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      await saveDesign({
        id: designId('valid-2'),
        name: 'Valid 2',
        params: { ...DEFAULT_BIN_PARAMS, width: 3 },
        thumbnail: null,
        exportFileNameConfig: null,
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
        id: designId('delete-test'),
        name: 'Delete Me',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const deleteResult = await deleteDesign(designId('delete-test'));
      expectOk(deleteResult);

      const loadResult = await loadDesign(designId('delete-test'));
      expectErr(loadResult);
    });

    it('should return error for non-existent design', async () => {
      const result = await deleteDesign(designId('nonexistent'));
      expectErr(result);
    });
  });

  describe('duplicateDesign', () => {
    it('should duplicate a design with new ID and name', async () => {
      await saveDesign({
        id: designId('original-design'),
        name: 'My Bin',
        params: { ...DEFAULT_BIN_PARAMS, width: 3 },
        thumbnail: 'data:image/test',
        exportFileNameConfig: null,
      });

      const result = await duplicateDesign(designId('original-design'));

      const value = expectOk(result);
      expect(value.id).not.toBe('original-design');
      expect(value.id).toMatch(/^design_/);
      expect(value.name).toBe('Copy of My Bin');
      expect(expectBinParams(value).width).toBe(3);
      expect(value.thumbnail).toBe('data:image/test');
    });

    it('should return error for non-existent design', async () => {
      const result = await duplicateDesign(designId('nonexistent'));
      expectErr(result);
    });
  });

  describe('updateDesignParams', () => {
    it('should update params of existing design', async () => {
      await saveDesign({
        id: designId('params-test'),
        name: 'Params Test',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      const newParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 4, height: 6 };
      const result = await updateDesignParams(designId('params-test'), newParams);

      const value = expectOk(result);
      expect(expectBinParams(value).width).toBe(4);
      expect(expectBinParams(value).height).toBe(6);
      expect(value.name).toBe('Params Test'); // name preserved
    });

    it('should return error for non-existent design', async () => {
      const result = await updateDesignParams(designId('nonexistent'), DEFAULT_BIN_PARAMS);
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
      setActiveDesignId(designId('test-design-123'));
      expect(getActiveDesignId()).toBe('test-design-123');
    });

    it('should clear active design ID when set to null', () => {
      setActiveDesignId(designId('test-design-123'));
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
        id: designId('existing-design'),
        name: 'Existing Design',
        params: { ...DEFAULT_BIN_PARAMS, width: 5 },
        thumbnail: null,
        exportFileNameConfig: null,
      });
      expectOk(createResult);

      setActiveDesignId(designId('existing-design'));

      // Initialize should load it
      const result = await initializeDesigner();

      const value = expectOk(result);
      expect(value.id).toBe('existing-design');
      expect(value.name).toBe('Existing Design');
      expect(expectBinParams(value).width).toBe(5);
    });

    it('should create new design if active design was deleted', async () => {
      // Set a non-existent design as active
      setActiveDesignId(designId('deleted-design'));

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

  describe('publishedId + lineage', () => {
    const LINEAGE = {
      parentId: 'AbCdEf123456',
      rootId: 'ZyXwVu654321',
      parentName: 'Parent Bin',
      parentAuthorName: 'Ann Author',
      rootAuthorName: 'Root Author',
    };

    async function savePublished(): Promise<SavedDesign> {
      return expectOk(
        await saveDesign({
          name: 'Published',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          publishedId: 'PubLish12345',
          lineage: LINEAGE,
        })
      );
    }

    it('saveDesign persists both fields and they round-trip through loadDesign', async () => {
      const saved = await savePublished();
      expect(saved.publishedId).toBe('PubLish12345');
      expect(saved.lineage).toEqual(LINEAGE);
      const loaded = expectOk(await loadDesign(saved.id));
      expect(loaded.publishedId).toBe('PubLish12345');
      expect(loaded.lineage).toEqual(LINEAGE);
    });

    it('an update that omits both fields keeps the stored values', async () => {
      const saved = await savePublished();
      const updated = expectOk(
        await saveDesign({
          id: saved.id,
          name: 'Renamed',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      expect(updated.publishedId).toBe('PubLish12345');
      expect(updated.lineage).toEqual(LINEAGE);
    });

    it('an explicit null clears the stored value', async () => {
      const saved = await savePublished();
      const updated = expectOk(
        await saveDesign({
          id: saved.id,
          name: saved.name,
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
          publishedId: null,
        })
      );
      expect(updated.publishedId).toBe(null);
      expect(updated.lineage).toEqual(LINEAGE);
    });

    it('duplicateDesign drops publishedId and carries lineage', async () => {
      const saved = await savePublished();
      const dup = expectOk(await duplicateDesign(saved.id));
      expect(dup.publishedId).toBeUndefined();
      expect(dup.lineage).toEqual(LINEAGE);
      const original = expectOk(await loadDesign(saved.id));
      expect(original.publishedId).toBe('PubLish12345');
    });

    it('setDesignPublishedId records the id and keeps lineage', async () => {
      const saved = await savePublished();
      const updated = expectOk(await setDesignPublishedId(saved.id, 'NewPublish99'));
      expect(updated.publishedId).toBe('NewPublish99');
      expect(updated.lineage).toEqual(LINEAGE);
      const loaded = expectOk(await loadDesign(saved.id));
      expect(loaded.publishedId).toBe('NewPublish99');
    });

    it('setDesignPublishedId works for a never-published design', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Local Only',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      const updated = expectOk(await setDesignPublishedId(saved.id, 'FirstPub1234'));
      expect(updated.publishedId).toBe('FirstPub1234');
    });

    it('clearDesignPublishedId persists null and keeps lineage', async () => {
      const saved = await savePublished();
      const cleared = expectOk(await clearDesignPublishedId(saved.id));
      expect(cleared.publishedId).toBe(null);
      expect(cleared.lineage).toEqual(LINEAGE);
      const loaded = expectOk(await loadDesign(saved.id));
      expect(loaded.publishedId).toBe(null);
    });

    it('clearDesignPublishedId is a no-op for a never-published design', async () => {
      const saved = expectOk(
        await saveDesign({
          name: 'Local Only',
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
      const before = saved.updatedAt;
      const result = expectOk(await clearDesignPublishedId(saved.id));
      expect(result.publishedId).toBeUndefined();
      expect(result.updatedAt).toBe(before);
    });
  });
});

describe('design-created counting', () => {
  beforeEach(() => {
    trackDesignCreatedMock.mockReset();
  });

  it('counts a design with no id', async () => {
    expectOk(
      await saveDesign({
        name: 'a',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );

    expect(trackDesignCreatedMock).toHaveBeenCalledTimes(1);
  });

  // Autosave re-enters saveDesign on every parameter change. Counting those
  // would turn "designs made" into "edits made", which is the measure the
  // milestone ladder was moved off in the first place.
  it('does not count re-saves of the same design', async () => {
    const created = expectOk(
      await saveDesign({
        name: 'a',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    trackDesignCreatedMock.mockReset();

    for (let i = 0; i < 5; i++) {
      expectOk(
        await saveDesign({
          id: created.id,
          name: `a${i}`,
          params: DEFAULT_BIN_PARAMS,
          thumbnail: null,
          exportFileNameConfig: null,
        })
      );
    }

    expect(trackDesignCreatedMock).not.toHaveBeenCalled();
  });

  // An id can be supplied for a design that was never stored (import, restore),
  // so "has an id" is a different question from "already exists".
  it('counts a supplied id that has no stored record', async () => {
    expectOk(
      await saveDesign({
        id: designId('design_imported_1'),
        name: 'imported',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );

    expect(trackDesignCreatedMock).toHaveBeenCalledTimes(1);
  });

  it('does not count a rejected write', async () => {
    expectErr(await saveDesign({ name: 'bad', thumbnail: null } as never));

    expect(trackDesignCreatedMock).not.toHaveBeenCalled();
  });
});
