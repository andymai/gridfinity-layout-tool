import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, storageNotFound, storageUnavailable } from '@/core/result';
import { designId } from '@/core/types';
import type { SavedDesign, BinParams } from '@/features/bin-designer/types';
import type { AdapterChange } from '@/core/sync/adapters/types';

const listDesignsMock = vi.fn();
const loadDesignMock = vi.fn();
const saveDesignMock = vi.fn();
const deleteDesignMock = vi.fn();

vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  listDesigns: () => listDesignsMock(),
  loadDesign: (id: string) => loadDesignMock(id),
  saveDesign: (input: unknown) => saveDesignMock(input),
  deleteDesign: (id: string) => deleteDesignMock(id),
}));

import { designAdapter } from './designAdapter';
import { __resetForTests, emit } from './designerEvents';

const sampleParams = (): BinParams => ({}) as BinParams;
const samplePayload = (name = 'D'): { name: string; params: BinParams } => ({
  name,
  params: sampleParams(),
});

function savedDesign(
  id: string,
  updatedAt: string,
  name = 'D',
  tags?: readonly string[]
): SavedDesign {
  return {
    id: designId(id),
    name,
    params: sampleParams(),
    thumbnail: null,
    createdAt: updatedAt,
    updatedAt,
    exportFileNameConfig: null,
    ...(tags ? { tags } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetForTests();
});

describe('designAdapter.list', () => {
  it('returns SyncableItems with ms-normalized timestamps and the design name', async () => {
    listDesignsMock.mockResolvedValueOnce(
      ok([
        savedDesign('a', '2026-01-01T00:00:00.000Z', 'Alpha'),
        savedDesign('b', '2026-01-02T00:00:00.000Z', 'Beta'),
      ])
    );
    const items = await designAdapter.list();
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items[0].modifiedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(items[1].modifiedAt).toBe(Date.parse('2026-01-02T00:00:00.000Z'));
    expect(items[0].payload).toEqual({ name: 'Alpha', params: {} });
    expect(items[1].payload).toEqual({ name: 'Beta', params: {} });
  });

  it('returns [] when listDesigns errors', async () => {
    listDesignsMock.mockResolvedValueOnce(err(storageUnavailable('idb')));
    expect(await designAdapter.list()).toEqual([]);
  });
});

describe('designAdapter.get', () => {
  it('returns null when the design is missing', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('d-missing')));
    expect(await designAdapter.get('d-missing')).toBe(null);
  });

  it('returns id + payload (incl. name) + ms-normalized modifiedAt on success', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-03-01T00:00:00.000Z', 'My Bin'))
    );
    const item = await designAdapter.get('d1');
    expect(item?.id).toBe('d1');
    expect(item?.modifiedAt).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
    expect(item?.payload).toEqual({ name: 'My Bin', params: {} });
  });
});

describe('designAdapter tags', () => {
  it('list carries tags in the payload', async () => {
    listDesignsMock.mockResolvedValueOnce(
      ok([savedDesign('a', '2026-01-01T00:00:00.000Z', 'Alpha', ['kitchen', 'screws'])])
    );
    const items = await designAdapter.list();
    expect(items[0].payload.tags).toEqual(['kitchen', 'screws']);
  });

  it('get carries tags in the payload', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-03-01T00:00:00.000Z', 'My Bin', ['tools']))
    );
    const item = await designAdapter.get('d1');
    expect(item?.payload.tags).toEqual(['tools']);
  });

  it('applyRemote writes the remote tags (LWW: remote wins)', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'D', ['local-only']))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: { name: 'D', params: sampleParams(), tags: ['remote-a', 'remote-b'] },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].tags).toEqual(['remote-a', 'remote-b']);
  });

  it('applyRemote: an explicit empty remote tag array clears local tags', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'D', ['gone']))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: { name: 'D', params: sampleParams(), tags: [] },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].tags).toEqual([]);
  });

  it('applyRemote: a legacy payload with no tags field falls back to local tags', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'D', ['keep-local']))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: { name: 'D', params: sampleParams() }, // no tags key
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].tags).toEqual(['keep-local']);
  });
});

describe('designAdapter.applyRemote', () => {
  it('preserves local-only fields (thumbnail, exportFileNameConfig) when an existing entry is found', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok({
        ...savedDesign('d1', '2026-01-01T00:00:00.000Z'),
        thumbnail: 'data:image/png;base64,...',
        exportFileNameConfig: { template: '{name}-v{version}' } as never,
      })
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: samplePayload(),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    const args = saveDesignMock.mock.calls[0][0];
    expect(args.id).toBe('d1');
    expect(args.thumbnail).toBe('data:image/png;base64,...');
    expect(args.exportFileNameConfig).toEqual({ template: '{name}-v{version}' });
  });

  it('uses the remote name when present (LWW means the engine already determined remote wins)', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: samplePayload('Remote Name'),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Remote Name');
  });

  it('falls back to the local name when the remote wrapper has an empty name (legacy bare PUT on server)', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      // Server stores `{ name: '', params }` whenever a legacy bare-params
      // PUT lands. A fresh client pulling that must not wipe the local name.
      payload: { name: '', params: sampleParams() },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Local Name');
  });

  it('falls back to the local name when the remote payload is the legacy bare-BinParams shape', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('d1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      // Legacy bare-BinParams shape — no `{ name, params }` wrapper.
      payload: sampleParams() as never,
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Local Name');
  });

  it('falls back to "Synced design" when both remote payload (legacy) and local entry are missing', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('new')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('new', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'new',
      payload: sampleParams() as never, // legacy bare shape
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    const args = saveDesignMock.mock.calls[0][0];
    expect(args.name).toBe('Synced design');
    expect(args.thumbnail).toBe(null);
  });

  it('uses the remote name on a fresh-device pull when the payload carries it', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('new')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('new', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'new',
      payload: samplePayload('My Bin'),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('My Bin');
  });

  it('throws when saveDesign fails', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('x')));
    saveDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));

    await expect(
      designAdapter.applyRemote({ id: 'x', payload: samplePayload(), modifiedAt: 1 })
    ).rejects.toThrow(/saveDesign failed/);
  });
});

describe('designAdapter.applyRemoteDelete', () => {
  it('treats STORAGE_NOT_FOUND as success (idempotent)', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageNotFound('gone')));
    await expect(designAdapter.applyRemoteDelete('gone')).resolves.toBeUndefined();
  });

  it('throws on other delete failures', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));
    await expect(designAdapter.applyRemoteDelete('x')).rejects.toThrow(/deleteDesign failed/);
  });

  it('succeeds on normal delete', async () => {
    deleteDesignMock.mockResolvedValueOnce(ok(undefined));
    await expect(designAdapter.applyRemoteDelete('d1')).resolves.toBeUndefined();
  });
});

describe('designAdapter.subscribe', () => {
  it('emits a put change with ms-normalized timestamp', () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));

    emit({ type: 'put', id: designId('d1'), updatedAt: '2026-05-01T00:00:00.000Z' });

    expect(events).toEqual([
      { kind: 'put', id: 'd1', modifiedAt: Date.parse('2026-05-01T00:00:00.000Z') },
    ]);
    off();
  });

  it('emits a delete change with ms-normalized timestamp', () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));

    emit({ type: 'delete', id: designId('d1'), deletedAt: '2026-05-02T00:00:00.000Z' });

    expect(events).toEqual([
      { kind: 'delete', id: 'd1', modifiedAt: Date.parse('2026-05-02T00:00:00.000Z') },
    ]);
    off();
  });

  it('suppresses the emit triggered by saveDesign during applyRemote', async () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));

    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('echo-id')));
    saveDesignMock.mockImplementationOnce(async (input: SavedDesign) => {
      // Reproduce real `saveDesign` timing: emit past an internal await.
      emit({
        type: 'put',
        id: designId('echo-id'),
        updatedAt: '2026-05-04T00:00:00.000Z',
      });
      return ok({ ...input, createdAt: input.updatedAt });
    });

    await designAdapter.applyRemote({
      id: 'echo-id',
      payload: samplePayload(),
      modifiedAt: Date.parse('2026-05-04T00:00:00.000Z'),
    });

    expect(events.filter((e) => e.id === 'echo-id')).toEqual([]);
    off();
  });

  it('suppresses the emit triggered by deleteDesign during applyRemoteDelete', async () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));

    deleteDesignMock.mockImplementationOnce(async () => {
      emit({
        type: 'delete',
        id: designId('echo-del'),
        deletedAt: '2026-05-04T00:00:00.000Z',
      });
      return ok(undefined);
    });

    await designAdapter.applyRemoteDelete('echo-del');

    expect(events.filter((e) => e.id === 'echo-del')).toEqual([]);
    off();
  });

  it('passes unsuppressed events through to listeners', async () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));

    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('x')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('x', '2026-05-03T00:00:00.000Z')));
    await designAdapter.applyRemote({ id: 'x', payload: samplePayload(), modifiedAt: 1 });

    // Unrelated id is never in the suppression set, so it reaches the listener.
    emit({ type: 'put', id: designId('y'), updatedAt: '2026-05-03T00:00:00.000Z' });

    expect(events.some((e) => e.id === 'y')).toBe(true);
    off();
  });

  it('unsubscribe stops further events', () => {
    const events: AdapterChange[] = [];
    const off = designAdapter.subscribe((c) => events.push(c));
    off();

    emit({ type: 'put', id: designId('d1'), updatedAt: '2026-05-04T00:00:00.000Z' });

    expect(events).toEqual([]);
  });
});
