import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, storageNotFound, storageUnavailable } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import type { SavedBaseplateDesign } from '@/features/baseplate/types/library';
import type { AdapterChange } from '@/core/sync/adapters/types';

const listDesignsMock = vi.fn();
const loadDesignMock = vi.fn();
const saveDesignMock = vi.fn();
const deleteDesignMock = vi.fn();
const upsertRegistryEntryMock = vi.fn();
const removeRegistryEntryMock = vi.fn();

vi.mock('@/features/baseplate/storage/BaseplateStorage', () => ({
  listDesigns: () => listDesignsMock(),
  loadDesign: (id: string) => loadDesignMock(id),
  saveDesign: (input: unknown) => saveDesignMock(input),
  deleteDesign: (id: string) => deleteDesignMock(id),
}));

vi.mock('@/features/baseplate/store/baseplateRegistry', () => ({
  upsertRegistryEntry: (ref: unknown) => upsertRegistryEntryMock(ref),
  removeRegistryEntry: (id: string) => removeRegistryEntryMock(id),
}));

import { baseplateAdapter } from './baseplateAdapter';
import { __resetForTests, emit } from './baseplateEvents';

const sampleParams = (): StoredBaseplateParams => ({}) as StoredBaseplateParams;
const samplePayload = (name = 'B'): { name: string; params: StoredBaseplateParams } => ({
  name,
  params: sampleParams(),
});

function savedDesign(id: string, updatedAt: string, name = 'B'): SavedBaseplateDesign {
  return {
    id: baseplateDesignId(id),
    name,
    params: sampleParams(),
    thumbnail: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetForTests();
});

describe('baseplateAdapter.list', () => {
  it('returns SyncableItems with ms-normalized timestamps and the design name', async () => {
    listDesignsMock.mockResolvedValueOnce(
      ok([
        savedDesign('baseplate_1_a', '2026-01-01T00:00:00.000Z', 'Alpha'),
        savedDesign('baseplate_2_b', '2026-01-02T00:00:00.000Z', 'Beta'),
      ])
    );
    const items = await baseplateAdapter.list();
    expect(items.map((i) => i.id)).toEqual(['baseplate_1_a', 'baseplate_2_b']);
    expect(items[0].modifiedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(items[1].modifiedAt).toBe(Date.parse('2026-01-02T00:00:00.000Z'));
    expect(items[0].payload).toEqual({ name: 'Alpha', params: {} });
    expect(items[1].payload).toEqual({ name: 'Beta', params: {} });
  });

  it('returns [] when listDesigns errors', async () => {
    listDesignsMock.mockResolvedValueOnce(err(storageUnavailable('idb')));
    expect(await baseplateAdapter.list()).toEqual([]);
  });
});

describe('baseplateAdapter.get', () => {
  it('returns null when the design is missing', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('bp-missing')));
    expect(await baseplateAdapter.get('bp-missing')).toBe(null);
  });

  it('returns id + payload (incl. name) + ms-normalized modifiedAt on success', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('bp1', '2026-03-01T00:00:00.000Z', 'My Plate'))
    );
    const item = await baseplateAdapter.get('bp1');
    expect(item?.id).toBe('bp1');
    expect(item?.modifiedAt).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
    expect(item?.payload).toEqual({ name: 'My Plate', params: {} });
  });
});

describe('baseplateAdapter.applyRemote', () => {
  it('preserves the local-only thumbnail when an existing entry is found', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok({
        ...savedDesign('bp1', '2026-01-01T00:00:00.000Z'),
        thumbnail: 'data:image/png;base64,...',
      })
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'bp1',
      payload: samplePayload(),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    const args = saveDesignMock.mock.calls[0][0];
    expect(args.id).toBe('bp1');
    expect(args.thumbnail).toBe('data:image/png;base64,...');
  });

  it('uses the remote name when present (LWW means the engine already determined remote wins)', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('bp1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'bp1',
      payload: samplePayload('Remote Name'),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Remote Name');
  });

  it('falls back to the local name when the remote wrapper has an empty name', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('bp1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'bp1',
      payload: { name: '', params: sampleParams() },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Local Name');
  });

  it('falls back to the local name when the remote payload is a bare-params shape', async () => {
    loadDesignMock.mockResolvedValueOnce(
      ok(savedDesign('bp1', '2026-01-01T00:00:00.000Z', 'Local Name'))
    );
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'bp1',
      payload: sampleParams() as never,
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('Local Name');
  });

  it('falls back to "Synced baseplate" when both remote payload (bare) and local entry are missing', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('new')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('new', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'new',
      payload: sampleParams() as never,
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    const args = saveDesignMock.mock.calls[0][0];
    expect(args.name).toBe('Synced baseplate');
    expect(args.thumbnail).toBe(null);
  });

  it('uses the remote name on a fresh-device pull when the payload carries it', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('new')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('new', '2026-04-01T00:00:00.000Z')));

    await baseplateAdapter.applyRemote({
      id: 'new',
      payload: samplePayload('My Plate'),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].name).toBe('My Plate');
  });

  it('drops a payload whose params is an array (would read back corrupt)', async () => {
    await baseplateAdapter.applyRemote({
      id: 'bp-arr',
      payload: { name: 'Arr', params: [1, 2, 3] },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(loadDesignMock).not.toHaveBeenCalled();
    expect(saveDesignMock).not.toHaveBeenCalled();
  });

  it('throws when saveDesign fails', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('x')));
    saveDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));

    await expect(
      baseplateAdapter.applyRemote({ id: 'x', payload: samplePayload(), modifiedAt: 1 })
    ).rejects.toThrow(/saveDesign failed/);
  });

  it('upserts the selector registry from the saved design', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('bp1')));
    saveDesignMock.mockResolvedValueOnce(
      ok(savedDesign('bp1', '2026-04-01T00:00:00.000Z', 'Saved Name'))
    );

    await baseplateAdapter.applyRemote({
      id: 'bp1',
      payload: samplePayload('Saved Name'),
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(upsertRegistryEntryMock).toHaveBeenCalledWith({
      id: 'bp1',
      name: 'Saved Name',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('does not touch the registry when saveDesign fails', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('x')));
    saveDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));

    await expect(
      baseplateAdapter.applyRemote({ id: 'x', payload: samplePayload(), modifiedAt: 1 })
    ).rejects.toThrow();
    expect(upsertRegistryEntryMock).not.toHaveBeenCalled();
  });
});

describe('baseplateAdapter.applyRemoteDelete', () => {
  it('treats STORAGE_NOT_FOUND as success (idempotent)', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageNotFound('gone')));
    await expect(baseplateAdapter.applyRemoteDelete('gone')).resolves.toBeUndefined();
  });

  it('throws on other delete failures', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));
    await expect(baseplateAdapter.applyRemoteDelete('x')).rejects.toThrow(/deleteDesign failed/);
  });

  it('succeeds on normal delete', async () => {
    deleteDesignMock.mockResolvedValueOnce(ok(undefined));
    await expect(baseplateAdapter.applyRemoteDelete('bp1')).resolves.toBeUndefined();
  });

  it('removes the selector registry entry after a successful delete', async () => {
    deleteDesignMock.mockResolvedValueOnce(ok(undefined));
    await baseplateAdapter.applyRemoteDelete('bp1');
    expect(removeRegistryEntryMock).toHaveBeenCalledWith('bp1');
  });

  it('removes the registry entry even when the design was already gone', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageNotFound('gone')));
    await baseplateAdapter.applyRemoteDelete('gone');
    expect(removeRegistryEntryMock).toHaveBeenCalledWith('gone');
  });

  it('does not touch the registry when the delete fails', async () => {
    deleteDesignMock.mockResolvedValueOnce(err(storageUnavailable('idb')));
    await expect(baseplateAdapter.applyRemoteDelete('x')).rejects.toThrow();
    expect(removeRegistryEntryMock).not.toHaveBeenCalled();
  });
});

describe('baseplateAdapter.subscribe', () => {
  it('emits a put change with ms-normalized timestamp', () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-01T00:00:00.000Z' });

    expect(events).toEqual([
      { kind: 'put', id: 'bp1', modifiedAt: Date.parse('2026-05-01T00:00:00.000Z') },
    ]);
    off();
  });

  it('emits a delete change with ms-normalized timestamp', () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));

    emit({ type: 'delete', id: baseplateDesignId('bp1'), deletedAt: '2026-05-02T00:00:00.000Z' });

    expect(events).toEqual([
      { kind: 'delete', id: 'bp1', modifiedAt: Date.parse('2026-05-02T00:00:00.000Z') },
    ]);
    off();
  });

  it('suppresses the emit triggered by saveDesign during applyRemote', async () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));

    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('echo-id')));
    saveDesignMock.mockImplementationOnce(async (input: SavedBaseplateDesign) => {
      // Reproduce real `saveDesign` timing: emit past an internal await.
      emit({
        type: 'put',
        id: baseplateDesignId('echo-id'),
        updatedAt: '2026-05-04T00:00:00.000Z',
      });
      return ok({ ...input, createdAt: input.updatedAt });
    });

    await baseplateAdapter.applyRemote({
      id: 'echo-id',
      payload: samplePayload(),
      modifiedAt: Date.parse('2026-05-04T00:00:00.000Z'),
    });

    expect(events.filter((e) => e.id === 'echo-id')).toEqual([]);
    off();
  });

  it('suppresses the emit triggered by deleteDesign during applyRemoteDelete', async () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));

    deleteDesignMock.mockImplementationOnce(async () => {
      emit({
        type: 'delete',
        id: baseplateDesignId('echo-del'),
        deletedAt: '2026-05-04T00:00:00.000Z',
      });
      return ok(undefined);
    });

    await baseplateAdapter.applyRemoteDelete('echo-del');

    expect(events.filter((e) => e.id === 'echo-del')).toEqual([]);
    off();
  });

  it('passes unsuppressed events through to listeners', async () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));

    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('x')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('x', '2026-05-03T00:00:00.000Z')));
    await baseplateAdapter.applyRemote({ id: 'x', payload: samplePayload(), modifiedAt: 1 });

    emit({ type: 'put', id: baseplateDesignId('y'), updatedAt: '2026-05-03T00:00:00.000Z' });

    expect(events.some((e) => e.id === 'y')).toBe(true);
    off();
  });

  it('unsubscribe stops further events', () => {
    const events: AdapterChange[] = [];
    const off = baseplateAdapter.subscribe((c) => events.push(c));
    off();

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-04T00:00:00.000Z' });

    expect(events).toEqual([]);
  });
});
