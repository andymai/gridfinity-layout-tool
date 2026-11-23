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
  updateDesignParamsIfChanged,
  updateDesignThumbnail,
  createNewDesign,
  getActiveDesignId,
  setActiveDesignId,
  closeBaseplateDb,
} from '@/features/baseplate/storage/BaseplateStorage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
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
    // A device whose clock runs fast can stamp a copy ahead of this clock. Sync
    // keeps the later stamp, so an edit here must still sort after it.
    it('stamps a save 1 ms after a stored copy that is ahead of this clock', async () => {
      const ahead = Date.now() + 5 * 60 * 60 * 1000;
      const pulled = expectOk(
        await saveDesign({
          name: 'Pulled',
          params: DEFAULT_BASEPLATE_PARAMS,
          thumbnail: null,
          remoteModifiedAt: ahead,
        })
      );

      const edited = expectOk(await updateDesignName(pulled.id, 'Edited'));

      expect(edited.updatedAt).toBe(new Date(ahead + 1).toISOString());
    });

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

  describe('update order', () => {
    const id = baseplateDesignId('order-test');
    const edited = { ...DEFAULT_BASEPLATE_PARAMS, paddingBack: 21 as Mm };

    beforeEach(async () => {
      expectOk(
        await saveDesign({ id, name: 'Order', params: DEFAULT_BASEPLATE_PARAMS, thumbnail: null })
      );
    });

    it('keeps an edit that a thumbnail capture started at the same time', async () => {
      await Promise.all([
        updateDesignParams(id, edited),
        updateDesignThumbnail(id, 'data:image/png;base64,AAAA'),
      ]);

      const stored = expectOk(await loadDesign(id));
      expect(stored.params).toEqual(edited);
      expect(stored.thumbnail).toBe('data:image/png;base64,AAAA');
    });

    it('lands a write made later over an earlier one, whichever reads first', async () => {
      await Promise.all([
        updateDesignParams(id, edited),
        updateDesignName(id, 'Renamed'),
        updateDesignParams(id, { ...edited, paddingBack: 35 as Mm }),
      ]);

      const stored = expectOk(await loadDesign(id));
      expect(stored.params.paddingBack).toBe(35);
      expect(stored.name).toBe('Renamed');
    });

    it('writes nothing when the design already holds the params', async () => {
      const before = expectOk(await loadDesign(id)).updatedAt;

      expectOk(await updateDesignParamsIfChanged(id, { ...DEFAULT_BASEPLATE_PARAMS }));

      expect(expectOk(await loadDesign(id)).updatedAt).toBe(before);
    });

    it('turns a throw inside a queued update into an error and keeps the queue moving', async () => {
      const poisoned = { ...DEFAULT_BASEPLATE_PARAMS };
      Object.defineProperty(poisoned, 'paddingBack', {
        enumerable: true,
        get() {
          throw new Error('unreadable params');
        },
      });

      expectErr(await updateDesignParamsIfChanged(id, poisoned));
      expectOk(await updateDesignName(id, 'Still saves'));

      expect(expectOk(await loadDesign(id)).name).toBe('Still saves');
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
