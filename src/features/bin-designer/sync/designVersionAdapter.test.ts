// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: () => {} }));

import { designVersionAdapter } from './designVersionAdapter';
import { __resetForTests as resetVersionEvents } from './designVersionEvents';
import { closeDesignerDb } from '@/features/bin-designer/storage/designerDb';
import {
  createDesignVersion,
  listDesignVersions,
  deleteDesignVersion,
  renameDesignVersion,
  readDesignVersion,
} from '@/features/bin-designer/storage/DesignVersionService';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { expectOk } from '@/test/testUtils';
import { designId } from '@/core/types';
import type { AdapterChange } from '@/core/sync/adapters/types';

const DESIGN = designId('design_adapter_test');

async function seedVersion(name = 'v1') {
  return expectOk(
    await createDesignVersion(
      DESIGN,
      name,
      { name: 'Router Bit Holder', params: DEFAULT_BIN_PARAMS },
      // A stored thumbnail must never reach the wire.
      'data:image/png;base64,AAAA'
    )
  ).version;
}

describe('designVersionAdapter', () => {
  beforeEach(async () => {
    resetVersionEvents();
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
    });
  });

  describe('list and get', () => {
    it('exposes a stored version with its content decompressed', async () => {
      const saved = await seedVersion('0.2 mm');

      const items = await designVersionAdapter.list();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(saved.id);
      expect(items[0].payload.designId).toBe(DESIGN);
      expect(items[0].payload.name).toBe('0.2 mm');
      // Plain object on the wire so the server can run the designer validator.
      expect((items[0].payload.content as { params: unknown }).params).toEqual(DEFAULT_BIN_PARAMS);
    });

    // A base64 PNG would consume most of MAX_PAYLOAD_BYTES on its own.
    it('never puts a thumbnail on the wire', async () => {
      await seedVersion();

      const items = await designVersionAdapter.list();

      expect(JSON.stringify(items[0].payload)).not.toContain('base64');
      expect('thumbnail' in items[0].payload).toBe(false);
    });

    it('returns null for an id it does not hold', async () => {
      expect(await designVersionAdapter.get('missing')).toBeNull();
    });

    it('gets one version by id', async () => {
      const saved = await seedVersion('named');
      const item = await designVersionAdapter.get(saved.id);
      expect(item?.payload.name).toBe('named');
    });
  });

  describe('applyRemote', () => {
    it('stores a pulled version so the history list can read it', async () => {
      await designVersionAdapter.applyRemote({
        id: '11111111-2222-3333-4444-555555555555',
        modifiedAt: Date.parse('2026-08-01T00:00:00.000Z'),
        payload: {
          designId: DESIGN,
          name: 'from another device',
          content: { name: 'Router Bit Holder', params: DEFAULT_BIN_PARAMS },
          createdAt: '2026-08-01T00:00:00.000Z',
          origin: 'manual',
          pinned: true,
        },
      });

      const versions = expectOk(await listDesignVersions(DESIGN));
      expect(versions).toHaveLength(1);
      expect(versions[0].name).toBe('from another device');
      expect(versions[0].pinned).toBe(true);
      // Not synced; the local regenerator fills one in from the params.
      expect(versions[0].thumbnail).toBeNull();
    });

    it('re-compresses the pulled content so a local read round-trips', async () => {
      const id = '11111111-2222-3333-4444-666666666666';
      await designVersionAdapter.applyRemote({
        id,
        modifiedAt: Date.now(),
        payload: {
          designId: DESIGN,
          name: 'pulled',
          content: { name: 'Router Bit Holder', params: DEFAULT_BIN_PARAMS },
          createdAt: new Date().toISOString(),
          origin: 'manual',
        },
      });

      expect(expectOk(await readDesignVersion(id)).params).toEqual(DEFAULT_BIN_PARAMS);
    });

    // An unrecognised origin from a newer client must not corrupt the record.
    it('falls back to manual for an unknown origin', async () => {
      const id = '11111111-2222-3333-4444-777777777777';
      await designVersionAdapter.applyRemote({
        id,
        modifiedAt: Date.now(),
        payload: {
          designId: DESIGN,
          name: 'odd',
          content: { name: 'x' },
          createdAt: new Date().toISOString(),
          origin: 'something-new',
        },
      });

      expect(expectOk(await listDesignVersions(DESIGN))[0].origin).toBe('manual');
    });

    it('removes a version the cloud says is gone', async () => {
      const saved = await seedVersion();

      await designVersionAdapter.applyRemoteDelete(saved.id);

      expect(expectOk(await listDesignVersions(DESIGN))).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('reports a local save as a put', async () => {
      const changes: AdapterChange[] = [];
      const unsubscribe = designVersionAdapter.subscribe((c) => changes.push(c));

      const saved = await seedVersion();
      unsubscribe();

      expect(changes).toContainEqual(expect.objectContaining({ kind: 'put', id: saved.id }));
    });

    it('reports a local delete', async () => {
      const saved = await seedVersion();
      const changes: AdapterChange[] = [];
      const unsubscribe = designVersionAdapter.subscribe((c) => changes.push(c));

      expectOk(await deleteDesignVersion(saved.id));
      unsubscribe();

      expect(changes).toContainEqual(expect.objectContaining({ kind: 'delete', id: saved.id }));
    });

    // A rename is a real edit the other device has to receive, and it needs a
    // fresh mtime to win LWW against the copy already stored.
    it('reports a rename as a put with a newer mtime than the capture', async () => {
      const saved = await seedVersion();
      const changes: AdapterChange[] = [];
      const unsubscribe = designVersionAdapter.subscribe((c) => changes.push(c));

      expectOk(await renameDesignVersion(saved.id, 'renamed'));
      unsubscribe();

      const put = changes.find((c) => c.kind === 'put');
      expect(put).toBeDefined();
      expect(put?.modifiedAt).toBeGreaterThanOrEqual(Date.parse(saved.createdAt));
    });

    // Otherwise the engine's own listener turns every pull straight back into a push.
    it('stays silent when a remote change is applied', async () => {
      const changes: AdapterChange[] = [];
      const unsubscribe = designVersionAdapter.subscribe((c) => changes.push(c));

      await designVersionAdapter.applyRemote({
        id: '11111111-2222-3333-4444-888888888888',
        modifiedAt: Date.now(),
        payload: {
          designId: DESIGN,
          name: 'pulled',
          content: { name: 'x' },
          createdAt: new Date().toISOString(),
          origin: 'manual',
        },
      });
      await designVersionAdapter.applyRemoteDelete('11111111-2222-3333-4444-888888888888');
      unsubscribe();

      expect(changes).toEqual([]);
    });
  });
});
