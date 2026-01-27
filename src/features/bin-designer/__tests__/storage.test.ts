import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import {
  saveDesign,
  loadDesign,
  listDesigns,
  deleteDesign,
  updateDesignParams,
  closeDesignerDb,
  getActiveDesignId,
  setActiveDesignId,
  createNewDesign,
  initializeDesigner,
} from '@/features/bin-designer/storage/DesignerStorage';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

describe('DesignerStorage', () => {
  beforeEach(async () => {
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  describe('saveDesign', () => {
    it('should save a new design with generated ID', async () => {
      const result = await saveDesign({
        name: 'Test Bin',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toMatch(/^design_/);
        expect(result.value.name).toBe('Test Bin');
        expect(result.value.params).toEqual(DEFAULT_BIN_PARAMS);
        expect(result.value.createdAt).toBeTruthy();
        expect(result.value.updatedAt).toBeTruthy();
      }
    });

    it('should save with a provided ID', async () => {
      const result = await saveDesign({
        id: 'custom-id-123',
        name: 'Custom ID Bin',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe('custom-id-123');
      }
    });

    it('should update existing design preserving createdAt', async () => {
      const firstResult = await saveDesign({
        id: 'update-test',
        name: 'First',
        params: DEFAULT_BIN_PARAMS,
        thumbnail: null,
      });

      expect(isOk(firstResult)).toBe(true);
      if (!isOk(firstResult)) return;
      const firstCreatedAt = firstResult.value.createdAt;

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const secondResult = await saveDesign({
        id: 'update-test',
        name: 'Updated',
        params: { ...DEFAULT_BIN_PARAMS, width: 4 },
        thumbnail: null,
      });

      expect(isOk(secondResult)).toBe(true);
      if (isOk(secondResult)) {
        expect(secondResult.value.name).toBe('Updated');
        expect(secondResult.value.createdAt).toBe(firstCreatedAt);
        expect(secondResult.value.updatedAt).not.toBe(firstCreatedAt);
      }
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
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('Load Test');
        expect(result.value.params).toEqual(DEFAULT_BIN_PARAMS);
      }
    });

    it('should return error for non-existent design', async () => {
      const result = await loadDesign('nonexistent');
      expect(isErr(result)).toBe(true);
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
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(2);
        expect(result.value[0].name).toBe('Second'); // most recent first
        expect(result.value[1].name).toBe('First');
      }
    });

    it('should return empty list when no designs exist', async () => {
      const result = await listDesigns();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
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
      expect(isOk(deleteResult)).toBe(true);

      const loadResult = await loadDesign('delete-test');
      expect(isErr(loadResult)).toBe(true);
    });

    it('should return error for non-existent design', async () => {
      const result = await deleteDesign('nonexistent');
      expect(isErr(result)).toBe(true);
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

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.params.width).toBe(4);
        expect(result.value.params.height).toBe(6);
        expect(result.value.name).toBe('Params Test'); // name preserved
      }
    });

    it('should return error for non-existent design', async () => {
      const result = await updateDesignParams('nonexistent', DEFAULT_BIN_PARAMS);
      expect(isErr(result)).toBe(true);
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

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toMatch(/^design_/);
        expect(result.value.name).toBe('Untitled Bin');
        expect(result.value.params).toEqual(DEFAULT_BIN_PARAMS);
      }
    });

    it('should create a new design with custom name', async () => {
      const result = await createNewDesign('My Custom Bin');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('My Custom Bin');
      }
    });
  });

  describe('initializeDesigner', () => {
    const ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

    afterEach(() => {
      localStorage.removeItem(ACTIVE_DESIGN_KEY);
    });

    it('should create a new design when no active design exists', async () => {
      const result = await initializeDesigner();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('Untitled Bin');
        expect(result.value.params).toEqual(DEFAULT_BIN_PARAMS);
      }
    });

    it('should load existing active design', async () => {
      // Create a design first
      const createResult = await saveDesign({
        id: 'existing-design',
        name: 'Existing Design',
        params: { ...DEFAULT_BIN_PARAMS, width: 5 },
        thumbnail: null,
      });
      expect(isOk(createResult)).toBe(true);

      // Set it as active
      setActiveDesignId('existing-design');

      // Initialize should load it
      const result = await initializeDesigner();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe('existing-design');
        expect(result.value.name).toBe('Existing Design');
        expect(result.value.params.width).toBe(5);
      }
    });

    it('should create new design if active design was deleted', async () => {
      // Set a non-existent design as active
      setActiveDesignId('deleted-design');

      const result = await initializeDesigner();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should create a new design, not the deleted one
        expect(result.value.id).not.toBe('deleted-design');
        expect(result.value.name).toBe('Untitled Bin');
      }

      // Should have cleared the stale reference
      expect(getActiveDesignId()).not.toBe('deleted-design');
    });
  });
});
