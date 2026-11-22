import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ALL_KINDS, KIND_SPECS, isKind } from '../lib/kinds';
import { designShape, expectedEnvelopeDelta } from '../lib/delta';
import { analyze } from '../lib/findings';
import { itemKey, parseIndexKey } from '../lib/inventory';
import type { BlobRow, IndexRow, Inventory, Kind } from '../lib/types';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
beforeEach(() => fetchMock.mockReset());

const T = 1_780_000_000_000;
const ISO = '2026-11-21T10:00:00.000Z';
const binParams = {
  width: 2,
  depth: 2,
  height: 6,
  style: 'standard',
  base: {
    style: 'magnet',
    magnetDiameter: 6.2,
    magnetDepth: 2.4,
    screwDiameter: 3,
    stackingLip: true,
  },
  label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
  inserts: [],
};
const rect = {
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

/** One payload per kind that its handler accepts, with an id it accepts. */
const FIXTURES: Record<Kind, { id: string; payload: unknown; body?: Record<string, unknown> }> = {
  layouts: {
    id: 'layout-1',
    payload: {
      version: '1.0',
      name: 'Test Layout',
      drawer: { width: 5, depth: 5, height: 3 },
      bins: [],
      layers: [{ id: 'layer-1', name: 'Layer 1', height: 2 }],
      categories: [{ id: 'cat-1', name: 'Default', color: '#ff0000' }],
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
    },
    body: { schemaVersion: 5 },
  },
  designs: { id: 'design-1', payload: { name: 'Bin', params: binParams, tags: ['tools'] } },
  baseplates: {
    id: 'bp_1',
    payload: {
      name: 'Plate',
      params: {
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        lightweight: true,
      },
    },
  },
  designVersions: {
    id: 'version-1',
    payload: {
      designId: 'design-1',
      name: 'Before the cutouts',
      createdAt: ISO,
      origin: 'manual',
      content: { name: 'Bin', params: binParams },
    },
  },
  folders: {
    id: 'folder_1771464121030_9ltk1f',
    payload: { name: 'Garage', parentId: null, kind: 'place', createdAt: 900 },
    body: { schemaVersion: 2 },
  },
  cutoutItems: {
    id: 'clib_00000000-0000-4000-8000-000000000001',
    payload: {
      name: 'Wrench',
      folderId: null,
      createdAt: ISO,
      content: { params: { cutouts: [rect] } },
    },
  },
  cutoutFolders: {
    id: 'cfold_00000000-0000-4000-8000-000000000002',
    payload: { name: 'Tools', parentId: null, createdAt: ISO },
  },
};

function stored(kind: Kind) {
  const { id, payload, body = {} } = FIXTURES[kind];
  const spec = KIND_SPECS[kind];
  const built = spec.buildPut(payload, T, id, { [spec.payloadKey]: payload, ...body });
  if (!built.ok) throw new Error(`${kind} fixture rejected: ${built.error}`);
  return { id, built, text: JSON.stringify(built.envelope) };
}

function inventoryOf(kind: Kind, blobSize: number, sizeBytes: number): Inventory {
  const { id } = FIXTURES[kind];
  const blob: BlobRow = {
    uid: 'u1',
    kind,
    id,
    size: blobSize,
    url: `https://blob/u1/${kind}/${id}`,
    uploadedAt: new Date(T),
  };
  const row: IndexRow = {
    uid: 'u1',
    kind,
    id,
    entry: { modifiedAt: T, sizeBytes },
    tombstone: false,
  };
  const key = itemKey('u1', kind, id);
  return {
    blobs: [blob],
    blobMap: new Map([[key, blob]]),
    indexRows: [row],
    indexMap: new Map([[key, row]]),
    blobUsers: new Set(['u1']),
    redisUsers: new Set(['u1']),
    blobsListed: true,
  };
}

describe('KIND_SPECS', () => {
  it('covers every kind that the server syncs', () => {
    expect([...ALL_KINDS].sort()).toEqual(
      [
        'baseplates',
        'cutoutFolders',
        'cutoutItems',
        'designVersions',
        'designs',
        'folders',
        'layouts',
      ].sort()
    );
    expect(isKind('cutoutItems')).toBe(true);
    expect(isKind('meshes')).toBe(false);
    expect(isKind('toString')).toBe(false);
    expect(parseIndexKey('users:u1:index:cutoutFolders')).toEqual({
      uid: 'u1',
      kind: 'cutoutFolders',
    });
  });

  it.each(ALL_KINDS)('%s: the size formula matches what the handler stores', (kind) => {
    const { built, text } = stored(kind);
    expect(Buffer.byteLength(text, 'utf8') - built.sizeBytes).toBe(expectedEnvelopeDelta(kind, T));
  });

  it.each(ALL_KINDS)('%s: a stored envelope passes its own handler again', (kind) => {
    const { id, built } = stored(kind);
    const spec = KIND_SPECS[kind];
    const envelope = built.envelope as unknown as Record<string, unknown>;
    const again = spec.buildPut(envelope[spec.payloadKey], T, id, envelope);
    expect(again.ok && again.sizeBytes).toBe(built.sizeBytes);
  });

  it.each(ALL_KINDS)('%s: a consistent blob and index entry give no findings', async (kind) => {
    const { built, text } = stored(kind);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => text });
    const findings = await analyze(
      inventoryOf(kind, Buffer.byteLength(text, 'utf8'), built.sizeBytes)
    );
    expect(findings).toEqual([]);
  });
});

describe('assembly and imported-mesh designs', () => {
  const assembly = {
    name: 'Kit',
    kind: 'assembly',
    envelope: {
      width: 2,
      depth: 1.5,
      gridUnitMm: 42,
      heightUnitMm: 7,
      attachment: {
        magnetHoles: true,
        magnetDiameter: 6.5,
        magnetDepth: 2.4,
        magnetCrushRibs: true,
        screwHoles: false,
        screwDiameter: 3,
      },
      featureColors: { enabled: false },
    },
    structure: {
      kind: 'assembly',
      schemaVersion: 1,
      base: { floorThickness: 2 },
      mirrorAxis: 'x',
      parts: [],
    },
  };

  it('are measured whole, and a consistent pair gives no findings', async () => {
    const spec = KIND_SPECS.designs;
    const built = spec.buildPut(assembly, T, 'design-2', { design: assembly });
    if (!built.ok) throw new Error(built.error);
    const text = JSON.stringify(built.envelope);
    const bytes = Buffer.byteLength(text, 'utf8');
    expect(bytes - built.sizeBytes).toBe(expectedEnvelopeDelta('designs', T, 'stored'));
    expect(designShape((built.envelope as unknown as { design: unknown }).design)).toBe('stored');

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => text });
    const inv = inventoryOf('designs', bytes, built.sizeBytes);
    expect(await analyze(inv)).toEqual([]);
  });
});

describe('analyze on library kinds', () => {
  it('reports a stored cutout item that its handler now refuses', async () => {
    const { built } = stored('cutoutItems');
    const envelope = built.envelope as unknown as {
      cutoutItem: { content: { params: { cutouts: unknown[] } } };
    };
    envelope.cutoutItem.content.params.cutouts = [{ ...rect, width: 0 }];
    const text = JSON.stringify(envelope);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => text });

    const findings = await analyze(
      inventoryOf('cutoutItems', Buffer.byteLength(text, 'utf8'), built.sizeBytes)
    );

    const invalid = findings.find((f) => f.kind === 'payload_invalid');
    expect(invalid?.itemKind).toBe('cutoutItems');
    expect(invalid?.detail).toMatch(/^INVALID_PARAMS: /);
  });

  it('still checks the payload when the timestamp is not a number', async () => {
    const { built } = stored('cutoutFolders');
    const text = JSON.stringify({ ...built.envelope, modifiedAt: { toString: 'broken' } });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => text });

    const findings = await analyze(
      inventoryOf('cutoutFolders', Buffer.byteLength(text, 'utf8'), built.sizeBytes)
    );

    expect(findings.map((f) => f.kind)).toContain('envelope_invalid');
    expect(findings.map((f) => f.kind)).not.toContain('payload_invalid');
  });

  it('flags a schemaVersion newer than the handler writes', async () => {
    const { built } = stored('cutoutFolders');
    const text = JSON.stringify({ ...built.envelope, schemaVersion: 2 });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => text });

    const findings = await analyze(
      inventoryOf('cutoutFolders', Buffer.byteLength(text, 'utf8'), built.sizeBytes)
    );

    expect(findings.find((f) => f.kind === 'envelope_invalid')?.detail).toBe(
      'schemaVersion=2 (expected 1 to 1)'
    );
  });
});
