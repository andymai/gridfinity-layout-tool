// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveDesign,
  loadDesign,
  listDesigns,
  deleteDesign,
  duplicateDesign,
  updateDesignName,
  updateDesignParams,
  updateDesignThumbnail,
  createNewDesign,
  getActiveDesignId,
  setActiveDesignId,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { baseplateDesignId } from '@/core/types';
import type { Mm } from '@/core/types';
import { expectOk, expectErr } from '@/test/testUtils';

describe('BaseplateStorage', () => {
  beforeEach(async () => {
    closeBaseplateDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-baseplate-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to delete database'));
    });
  });

  describe('saveDesign', () => {
    it('saves a new design with a generated baseplate ID', async () => {
      const result = await saveDesign({
        name: 'My Plate',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(result);
      expect(value.id).toMatch(/^baseplate_/);
      expect(value.name).toBe('My Plate');
      expect(value.params).toEqual(DEFAULT_BASEPLATE_PARAMS);
      expect(value.createdAt).toBeTruthy();
      expect(value.updatedAt).toBeTruthy();
    });

    it('saves with a provided ID', async () => {
      const result = await saveDesign({
        id: baseplateDesignId('custom-plate-1'),
        name: 'Custom',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(result);
      expect(value.id).toBe('custom-plate-1');
    });

    it('updates an existing design preserving createdAt', async () => {
      const first = expectOk(
        await saveDesign({
          id: baseplateDesignId('update-test'),
          name: 'First',
          params: DEFAULT_BASEPLATE_PARAMS,
          thumbnail: null,
        })
      );

      await new Promise((r) => setTimeout(r, 10));

      const second = expectOk(
        await saveDesign({
          id: baseplateDesignId('update-test'),
          name: 'Updated',
          params: DEFAULT_BASEPLATE_PARAMS,
          thumbnail: null,
        })
      );

      expect(second.name).toBe('Updated');
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).not.toBe(first.createdAt);
    });
  });

  describe('loadDesign', () => {
    it('loads a saved design', async () => {
      await saveDesign({
        id: baseplateDesignId('load-test'),
        name: 'Load Test',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(await loadDesign(baseplateDesignId('load-test')));
      expect(value.name).toBe('Load Test');
      expect(value.params).toEqual(DEFAULT_BASEPLATE_PARAMS);
    });

    it('returns an error for a non-existent design', async () => {
      expectErr(await loadDesign(baseplateDesignId('nonexistent')));
    });
  });

  describe('listDesigns', () => {
    it('lists all designs sorted by updatedAt descending', async () => {
      await saveDesign({
        id: baseplateDesignId('first'),
        name: 'First',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });
      await new Promise((r) => setTimeout(r, 10));
      await saveDesign({
        id: baseplateDesignId('second'),
        name: 'Second',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(await listDesigns());
      expect(value.length).toBe(2);
      expect(value[0].name).toBe('Second');
      expect(value[1].name).toBe('First');
    });

    it('returns an empty list when no designs exist', async () => {
      const value = expectOk(await listDesigns());
      expect(value).toEqual([]);
    });
  });

  describe('duplicateDesign', () => {
    it('duplicates a design with a new ID and "Copy of" name', async () => {
      await saveDesign({
        id: baseplateDesignId('original'),
        name: 'Original',
        params: { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true },
        thumbnail: 'data:image/test',
      });

      const value = expectOk(await duplicateDesign(baseplateDesignId('original')));
      expect(value.id).not.toBe('original');
      expect(value.id).toMatch(/^baseplate_/);
      expect(value.name).toBe('Copy of Original');
      expect(value.params.magnetHoles).toBe(true);
      expect(value.thumbnail).toBe('data:image/test');
    });

    it('returns an error for a non-existent design', async () => {
      expectErr(await duplicateDesign(baseplateDesignId('nonexistent')));
    });
  });

  describe('deleteDesign', () => {
    it('deletes an existing design', async () => {
      await saveDesign({
        id: baseplateDesignId('delete-test'),
        name: 'Delete Me',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      expectOk(await deleteDesign(baseplateDesignId('delete-test')));
      expectErr(await loadDesign(baseplateDesignId('delete-test')));
    });

    it('returns an error for a non-existent design', async () => {
      expectErr(await deleteDesign(baseplateDesignId('nonexistent')));
    });
  });

  describe('updateDesignName', () => {
    it('updates only the name, preserving params', async () => {
      await saveDesign({
        id: baseplateDesignId('rename-test'),
        name: 'Before',
        params: { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true },
        thumbnail: null,
      });

      const value = expectOk(await updateDesignName(baseplateDesignId('rename-test'), 'After'));
      expect(value.name).toBe('After');
      expect(value.params.magnetHoles).toBe(true);
    });
  });

  describe('updateDesignParams', () => {
    it('updates params of an existing design', async () => {
      await saveDesign({
        id: baseplateDesignId('params-test'),
        name: 'Params Test',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(
        await updateDesignParams(baseplateDesignId('params-test'), {
          ...DEFAULT_BASEPLATE_PARAMS,
          magnetDepth: 3 as Mm,
        })
      );
      expect(value.params.magnetDepth).toBe(3);
      expect(value.name).toBe('Params Test');
    });

    it('returns an error for a non-existent design', async () => {
      expectErr(
        await updateDesignParams(baseplateDesignId('nonexistent'), DEFAULT_BASEPLATE_PARAMS)
      );
    });
  });

  describe('updateDesignThumbnail', () => {
    it('updates only the thumbnail', async () => {
      await saveDesign({
        id: baseplateDesignId('thumb-test'),
        name: 'Thumb',
        params: DEFAULT_BASEPLATE_PARAMS,
        thumbnail: null,
      });

      const value = expectOk(
        await updateDesignThumbnail(baseplateDesignId('thumb-test'), 'data:image/png;base64,AAAA')
      );
      expect(value.thumbnail).toBe('data:image/png;base64,AAAA');
    });
  });

  describe('createNewDesign', () => {
    it('creates a new design with default params and name', async () => {
      const value = expectOk(await createNewDesign());
      expect(value.id).toMatch(/^baseplate_/);
      expect(value.name).toBe('Baseplate 1');
      expect(value.params).toEqual(DEFAULT_BASEPLATE_PARAMS);
    });

    it('creates a new design with a custom name', async () => {
      const value = expectOk(await createNewDesign('Workbench Plate'));
      expect(value.name).toBe('Workbench Plate');
    });
  });

  describe('activeDesignId', () => {
    afterEach(() => {
      localStorage.removeItem('gridfinity-baseplate-active-v1');
    });

    it('returns null when no active design is set', () => {
      expect(getActiveDesignId()).toBeNull();
    });

    it('sets and gets the active design ID', () => {
      setActiveDesignId(baseplateDesignId('active-plate-1'));
      expect(getActiveDesignId()).toBe('active-plate-1');
    });

    it('clears the active design ID when set to null', () => {
      setActiveDesignId(baseplateDesignId('active-plate-1'));
      setActiveDesignId(null);
      expect(getActiveDesignId()).toBeNull();
    });
  });
});
