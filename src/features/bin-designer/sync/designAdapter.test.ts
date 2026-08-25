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
    listDesignsMock.mockResolvedValueOnce(err(storageUnavailable('indexedDB')));
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

describe('designAdapter non-bin kinds (local-only)', () => {
  function nonBinDesign(id: string): SavedDesign {
    const base = savedDesign(id, '2026-04-01T00:00:00.000Z', 'Imported');
    // Non-bin kinds persist kind + envelope + structure and OMIT params.
    const { params: _params, ...rest } = base;
    return {
      ...rest,
      kind: 'importedMesh',
      envelope: { width: 2, depth: 1 } as SavedDesign['envelope'],
      structure: { kind: 'importedMesh' } as SavedDesign['structure'],
    };
  }

  it('list() excludes paramsless designs so they never upload', async () => {
    listDesignsMock.mockResolvedValueOnce(
      ok([savedDesign('a', '2026-01-01T00:00:00.000Z', 'Alpha'), nonBinDesign('m')])
    );
    const items = await designAdapter.list();
    expect(items.map((i) => i.id)).toEqual(['a']);
  });

  it('get() returns null for a paramsless design (engine drops the push)', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(nonBinDesign('m')));
    expect(await designAdapter.get('m')).toBe(null);
  });
});

describe('designAdapter assembly kind', () => {
  const assemblyStructure = () => ({
    kind: 'assembly' as const,
    schemaVersion: 1 as const,
    base: { floorThickness: 2 },
    mirrorAxis: 'x' as const,
    parts: [
      {
        id: 'p1',
        type: 'post' as const,
        params: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
        transform: { x: 20, y: 20, seatZ: 0, rotZDeg: 0 },
        children: [],
      },
    ],
  });
  const assemblyEnvelope = () =>
    ({
      width: 4,
      depth: 2,
      gridUnitMm: 42,
      heightUnitMm: 7,
      attachment: {
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2.4,
        screwHoles: false,
        screwDiameter: 3,
      },
      featureColors: { enabled: false },
    }) as SavedDesign['envelope'];

  function assemblyDesign(id: string): SavedDesign {
    const base = savedDesign(id, '2026-04-01T00:00:00.000Z', 'Workshop build');
    const { params: _params, ...rest } = base;
    return {
      ...rest,
      kind: 'assembly',
      envelope: assemblyEnvelope(),
      structure: assemblyStructure(),
    };
  }

  it('list() includes assemblies with kind/envelope/structure in the payload', async () => {
    listDesignsMock.mockResolvedValueOnce(ok([assemblyDesign('w')]));
    const items = await designAdapter.list();
    expect(items).toHaveLength(1);
    const payload = items[0]?.payload;
    expect(payload?.kind).toBe('assembly');
    expect(payload?.params).toBeUndefined();
    expect(payload?.structure).toBeDefined();
  });

  it('get() returns an assembly payload', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(assemblyDesign('w')));
    const item = await designAdapter.get('w');
    expect(item?.payload.kind).toBe('assembly');
  });

  it('applyRemote round-trips an assembly through migration into saveDesign', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('missing')));
    saveDesignMock.mockResolvedValueOnce(ok(assemblyDesign('w')));
    await designAdapter.applyRemote({
      id: 'w',
      payload: {
        name: 'Remote build',
        kind: 'assembly',
        envelope: assemblyEnvelope(),
        structure: assemblyStructure(),
      },
      modifiedAt: 1,
    });
    expect(saveDesignMock).toHaveBeenCalledTimes(1);
    const saved = saveDesignMock.mock.calls[0]?.[0] as SavedDesign;
    expect(saved.kind).toBe('assembly');
    expect(saved.params).toBeUndefined();
    expect(saved.structure?.kind).toBe('assembly');
    expect(saved.structure?.kind === 'assembly' ? saved.structure.parts : []).toHaveLength(1);
  });

  it('applyRemote drops invalid remote nodes through migration instead of failing', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('missing')));
    saveDesignMock.mockResolvedValueOnce(ok(assemblyDesign('w')));
    const remote = assemblyStructure();
    const poisoned = {
      ...remote,
      parts: [
        ...remote.parts,
        { id: 'bad', type: 'sphere', params: {}, transform: {}, children: [] },
      ],
    };
    await designAdapter.applyRemote({
      id: 'w',
      payload: {
        name: 'Remote build',
        kind: 'assembly',
        envelope: assemblyEnvelope(),
        structure: poisoned,
      },
      modifiedAt: 1,
    });
    const saved = saveDesignMock.mock.calls[0]?.[0] as SavedDesign;
    expect(
      saved.structure?.kind === 'assembly' ? saved.structure.parts.map((n) => n.id) : []
    ).toEqual(['p1']);
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

describe('designAdapter publishedId + lineage', () => {
  const LINEAGE = {
    parentId: 'AbCdEf123456',
    rootId: 'ZyXwVu654321',
    parentName: 'Parent Bin',
    parentAuthorName: 'Ann Author',
    rootAuthorName: 'Root Author',
  };

  function publishedDesign(id: string, updatedAt: string): SavedDesign {
    return {
      ...savedDesign(id, updatedAt),
      publishedId: 'PubLish12345',
      lineage: LINEAGE,
    };
  }

  it('list carries publishedId and lineage in the payload', async () => {
    listDesignsMock.mockResolvedValueOnce(ok([publishedDesign('a', '2026-01-01T00:00:00.000Z')]));
    const items = await designAdapter.list();
    expect(items[0].payload.publishedId).toBe('PubLish12345');
    expect(items[0].payload.lineage).toEqual(LINEAGE);
  });

  it('get carries publishedId and lineage in the payload', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(publishedDesign('d1', '2026-03-01T00:00:00.000Z')));
    const item = await designAdapter.get('d1');
    expect(item?.payload.publishedId).toBe('PubLish12345');
    expect(item?.payload.lineage).toEqual(LINEAGE);
  });

  it('applyRemote writes the remote publishedId and lineage (LWW: remote wins)', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(publishedDesign('d1', '2026-01-01T00:00:00.000Z')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    const remoteLineage = { ...LINEAGE, parentName: 'Renamed Parent' };
    await designAdapter.applyRemote({
      id: 'd1',
      payload: {
        name: 'D',
        params: sampleParams(),
        publishedId: 'RemotePub999',
        lineage: remoteLineage,
      },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].publishedId).toBe('RemotePub999');
    expect(saveDesignMock.mock.calls[0][0].lineage).toEqual(remoteLineage);
  });

  it('applyRemote: an explicit remote null clears local publishedId and lineage', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(publishedDesign('d1', '2026-01-01T00:00:00.000Z')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: { name: 'D', params: sampleParams(), publishedId: null, lineage: null },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].publishedId).toBe(null);
    expect(saveDesignMock.mock.calls[0][0].lineage).toBe(null);
  });

  it('applyRemote: a legacy payload with neither field falls back to local values', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(publishedDesign('d1', '2026-01-01T00:00:00.000Z')));
    saveDesignMock.mockResolvedValueOnce(ok(savedDesign('d1', '2026-04-01T00:00:00.000Z')));

    await designAdapter.applyRemote({
      id: 'd1',
      payload: { name: 'D', params: sampleParams() },
      modifiedAt: Date.parse('2026-04-01T00:00:00.000Z'),
    });

    expect(saveDesignMock.mock.calls[0][0].publishedId).toBe('PubLish12345');
    expect(saveDesignMock.mock.calls[0][0].lineage).toEqual(LINEAGE);
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
    saveDesignMock.mockResolvedValueOnce(err(storageUnavailable('indexedDB')));

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
    deleteDesignMock.mockResolvedValueOnce(err(storageUnavailable('indexedDB')));
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

// `buildPayload` names each field explicitly, so a field it forgets is simply
// absent on the wire, and `saveDesign` rebuilds the record the same way on the
// way back in. Nothing else fails when that happens: the design syncs, and only
// its place in the family is gone.
describe('branch lineage round-trip', () => {
  beforeEach(() => {
    __resetForTests();
    vi.clearAllMocks();
  });

  const branched = (): SavedDesign => ({
    ...savedDesign('design-branch', '2026-08-01T00:00:00.000Z'),
    parentDesignId: designId('design-parent'),
    parentVersionId: 'version-1',
    parentVersionName: 'printed successfully',
  });

  it('puts the branch fields on the wire', async () => {
    listDesignsMock.mockResolvedValue(ok([branched()]));

    const [item] = await designAdapter.list();

    expect(item.payload.parentDesignId).toBe('design-parent');
    expect(item.payload.parentVersionId).toBe('version-1');
    expect(item.payload.parentVersionName).toBe('printed successfully');
  });

  it('omits them entirely for a design that was never branched', async () => {
    listDesignsMock.mockResolvedValue(
      ok([savedDesign('design-plain', '2026-08-01T00:00:00.000Z')])
    );

    const [item] = await designAdapter.list();

    // Absent, not `undefined`: an explicit undefined key hashes like null in
    // the server's equal-ms tiebreaker.
    expect('parentDesignId' in item.payload).toBe(false);
  });

  it('writes them back when a branch is pulled', async () => {
    loadDesignMock.mockResolvedValue(err(storageNotFound('design-branch')));
    saveDesignMock.mockResolvedValue(ok(branched()));

    await designAdapter.applyRemote({
      id: 'design-branch',
      modifiedAt: Date.parse('2026-08-02T00:00:00.000Z'),
      payload: {
        ...samplePayload('0.3 mm trial'),
        parentDesignId: 'design-parent',
        parentVersionId: 'version-1',
        parentVersionName: 'printed successfully',
      },
    });

    expect(saveDesignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDesignId: designId('design-parent'),
        parentVersionId: 'version-1',
        parentVersionName: 'printed successfully',
      })
    );
  });

  // Branch lineage is written once and never edited, so an absent remote value
  // means the payload predates the field, not that the branch was detached.
  it('keeps the local parent when the remote payload omits it', async () => {
    loadDesignMock.mockResolvedValue(ok(branched()));
    saveDesignMock.mockResolvedValue(ok(branched()));

    await designAdapter.applyRemote({
      id: 'design-branch',
      modifiedAt: Date.parse('2026-08-02T00:00:00.000Z'),
      payload: samplePayload('renamed elsewhere'),
    });

    expect(saveDesignMock).toHaveBeenCalledWith(
      expect.objectContaining({ parentDesignId: designId('design-parent') })
    );
  });
});
