import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));

/** Runs after a holder's meshes are stored and before the pass rewrites the record. */
const interleave = vi.hoisted(() => ({
  after: null as null | ((holder: unknown) => Promise<void>),
}));
vi.mock('@/shared/generation/meshRefs', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshRefs>();
  return {
    ...actual,
    storeHolderMeshes: vi.fn(async (holder: MeshRefs.MeshHolder) => {
      const stored = await actual.storeHolderMeshes(holder);
      await interleave.after?.(holder);
      return stored;
    }),
  };
});

import { isOk, unwrap } from '@/core/result';
import { designId } from '@/core/types';
import { encodeMeshData, isMeshAssetRef } from '@/shared/generation/meshAsset';
import type { MeshAsset, MeshAssetEntry } from '@/shared/generation/meshAsset';
import { __clearMeshOutlinesForTests } from '@/shared/generation/meshOutlines';
import { holderMeshHashes } from '@/shared/generation/meshRefs';
import type * as MeshRefs from '@/shared/generation/meshRefs';
import {
  MESH_SWEEP_GRACE_MS,
  __resetMeshStoreForTests,
  hasMeshFile,
} from '@/shared/generation/meshStore';
import { compressString, decompressString } from '@/shared/utils/compression';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams, Cutout, DesignVersion, SavedDesign } from '../types';
import { subscribe as subscribeDesignerEvents } from '../sync/designerEvents';
import {
  branchFromVersion,
  closeDesignerDb,
  createVariant,
  deleteDesign,
  duplicateDesign,
  loadDesign,
  saveDesign,
} from './DesignerStorage';
import {
  createDesignVersion,
  readDesignVersion,
  renameDesignVersion,
  setDesignVersionPinned,
} from './DesignVersionService';
import { DESIGNS_STORE, DESIGN_VERSIONS_STORE, getDb } from './designerDb';
import {
  maintainMeshFiles,
  moveInlineMeshesToFiles,
  referencedMeshHashes,
} from './designMeshFiles';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function makeAsset(name = 'wrench', scale = 30): Promise<MeshAsset> {
  const positions = new Float32Array([0, 0, 0, scale, 0, 0, 0, scale, 0, 0, 0, scale]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    name,
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    sizeMm: { x: scale, y: scale, z: scale },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: scale, y: 0 },
        { x: 0, y: scale },
      ],
    ],
  };
}

const cutout: Cutout = {
  id: 'c1',
  shape: 'mesh',
  meshId: 'm1',
  x: 5,
  y: 5,
  width: 30,
  depth: 30,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

function meshParams(entry: MeshAssetEntry): BinParams {
  return { ...DEFAULT_BIN_PARAMS, cutouts: [cutout], meshAssets: { m1: entry } };
}

function entryOf(design: SavedDesign): MeshAssetEntry | undefined {
  return design.params?.meshAssets?.m1;
}

const ENVELOPE = { width: 1, depth: 1, gridUnitMm: 42, heightUnitMm: 7 } as ItemEnvelope;

beforeEach(async () => {
  closeDesignerDb();
  __resetMeshStoreForTests();
  __clearMeshOutlinesForTests();
  await deleteDb('gridfinity-designer-v1');
  await deleteDb('gridfinity-mesh-files');
});

afterEach(() => {
  vi.restoreAllMocks();
  interleave.after = null;
});

describe('saving designs', () => {
  it('stores an inline mesh as a file and saves the design with its ref', async () => {
    const asset = await makeAsset();
    const saved = unwrap(
      await saveDesign({
        name: 'd',
        params: meshParams(asset),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );

    const entry = entryOf(unwrap(await loadDesign(saved.id)));
    expect(entry && isMeshAssetRef(entry)).toBe(true);
    expect(await hasMeshFile(holderMeshHashes(saved)[0])).toBe(true);
    expect(unwrap(await loadDesign(saved.id)).params?.cutouts).toEqual([cutout]);
  });

  it('is idempotent: saving a design of refs keeps the same refs', async () => {
    const first = unwrap(
      await saveDesign({
        name: 'd',
        params: meshParams(await makeAsset()),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const loaded = unwrap(await loadDesign(first.id));
    const again = unwrap(await saveDesign({ ...loaded }));
    expect(entryOf(again)).toEqual(entryOf(first));
  });

  it('stores an imported STL design as a ref', async () => {
    const structure: ImportedMeshStructure = {
      kind: 'importedMesh',
      heightUnits: 3,
      asset: await makeAsset('bin', 40),
    };
    const saved = unwrap(
      await saveDesign({
        name: 'bin',
        kind: 'importedMesh',
        envelope: ENVELOPE,
        structure,
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const loaded = unwrap(await loadDesign(saved.id));
    const asset = loaded.structure?.kind === 'importedMesh' ? loaded.structure.asset : undefined;
    expect(asset && isMeshAssetRef(asset)).toBe(true);
  });

  it('keeps a mesh the file format cannot hold inline rather than lose it', async () => {
    const odd = { ...(await makeAsset()), outlines: [] };
    const saved = unwrap(
      await saveDesign({
        name: 'd',
        params: meshParams(odd),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    expect(entryOf(unwrap(await loadDesign(saved.id)))).toEqual(odd);
  });

  it('shares one file across duplicates, variants, branches and versions', async () => {
    const asset = await makeAsset();
    const original = unwrap(
      await saveDesign({
        name: 'd',
        params: meshParams(asset),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const hash = holderMeshHashes(original)[0];

    const duplicate = unwrap(await duplicateDesign(original.id));
    const variant = unwrap(await createVariant(original.id, 'v', {}));
    const version = unwrap(
      await createDesignVersion(original.id, 'v1', { name: 'd', params: meshParams(asset) }, null)
    );
    const branch = unwrap(await branchFromVersion(original.id, version.version.id, 'b'));
    const body = unwrap(await readDesignVersion(version.version.id));

    for (const holder of [duplicate, variant, branch, body]) {
      expect(holderMeshHashes(holder)).toEqual([hash]);
    }
    expect([...(await referencedMeshHashes())]).toEqual([hash]);
  });
});

describe('moveInlineMeshesToFiles', () => {
  async function writeLegacy(): Promise<{ design: SavedDesign; version: DesignVersion }> {
    const asset = await makeAsset();
    const design: SavedDesign = {
      id: designId('design_legacy'),
      name: 'legacy',
      params: meshParams(asset),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      exportFileNameConfig: null,
    };
    const version: DesignVersion = {
      id: 'version_legacy',
      designId: design.id,
      name: 'v',
      content: compressString(JSON.stringify({ name: 'legacy', params: meshParams(asset) })),
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      origin: 'manual',
    };
    const db = await getDb();
    await db.put(DESIGNS_STORE, design);
    await db.put(DESIGN_VERSIONS_STORE, version);
    return { design, version };
  }

  it('rewrites designs and versions saved inline with refs, silently and in place', async () => {
    const { design, version } = await writeLegacy();
    const events: unknown[] = [];
    const unsubscribe = subscribeDesignerEvents((e) => events.push(e));

    expect(await moveInlineMeshesToFiles()).toBe(2);
    unsubscribe();

    const db = await getDb();
    const stored = (await db.get(DESIGNS_STORE, design.id)) as SavedDesign;
    const entry = entryOf(stored);
    expect(entry && isMeshAssetRef(entry)).toBe(true);
    expect(stored.updatedAt).toBe(design.updatedAt);
    const storedVersion = (await db.get(DESIGN_VERSIONS_STORE, version.id)) as DesignVersion;
    const body = JSON.parse(decompressString(storedVersion.content) ?? '{}') as {
      params: BinParams;
    };
    expect(holderMeshHashes(body)).toEqual(holderMeshHashes(stored));
    expect(storedVersion.createdAt).toBe(version.createdAt);
    expect(events).toEqual([]);
  });

  it('keeps a rename and a pin made while the version was being converted', async () => {
    const { version } = await writeLegacy();
    interleave.after = async (holder) => {
      if (typeof holder === 'object' && holder !== null && 'id' in holder) return;
      interleave.after = null;
      unwrap(await renameDesignVersion(version.id, 'renamed'));
      unwrap(await setDesignVersionPinned(version.id, true));
    };
    const edited = async (): Promise<DesignVersion> =>
      (await (await getDb()).get(DESIGN_VERSIONS_STORE, version.id)) as DesignVersion;

    await moveInlineMeshesToFiles();

    const stored = await edited();
    expect(stored.name).toBe('renamed');
    expect(stored.pinned).toBe(true);
    expect(stored.updatedAt).toBeDefined();
    const body = JSON.parse(decompressString(stored.content) ?? '{}') as { params: BinParams };
    expect(holderMeshHashes(body)).toHaveLength(1);
  });

  it('leaves a design that was saved while it was being converted', async () => {
    const { design } = await writeLegacy();
    interleave.after = async (holder) => {
      if (typeof holder !== 'object' || holder === null || !('id' in holder)) return;
      interleave.after = null;
      unwrap(await saveDesign({ ...design, name: 'edited' }));
    };

    await moveInlineMeshesToFiles();

    const stored = (await (await getDb()).get(DESIGNS_STORE, design.id)) as SavedDesign;
    expect(stored.name).toBe('edited');
    const entry = entryOf(stored);
    expect(entry && isMeshAssetRef(entry)).toBe(true);
  });

  it('is idempotent', async () => {
    await writeLegacy();
    await moveInlineMeshesToFiles();
    expect(await moveInlineMeshesToFiles()).toBe(0);
  });
});

describe('maintainMeshFiles', () => {
  it('sweeps the file of a deleted design once the grace period has passed', async () => {
    const start = Date.now();
    const kept = unwrap(
      await saveDesign({
        name: 'kept',
        params: meshParams(await makeAsset('a')),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const gone = unwrap(
      await saveDesign({
        name: 'gone',
        params: meshParams(await makeAsset('b', 20)),
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );
    const keptHash = holderMeshHashes(kept)[0];
    const goneHash = holderMeshHashes(gone)[0];
    expect(isOk(await deleteDesign(gone.id))).toBe(true);

    await maintainMeshFiles();
    expect(await hasMeshFile(goneHash)).toBe(true);

    vi.spyOn(Date, 'now').mockReturnValue(start + MESH_SWEEP_GRACE_MS + 60_000);
    await maintainMeshFiles();

    expect(await hasMeshFile(goneHash)).toBe(false);
    expect(await hasMeshFile(keptHash)).toBe(true);
  });
});
