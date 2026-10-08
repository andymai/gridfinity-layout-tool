import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));

import { isErr, unwrap } from '@/core/result';
import { designId } from '@/core/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { __resetMeshStoreForTests } from '@/shared/generation/meshStore';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { Cutout, SavedDesign } from '../types';
import { closeDesignerDb, saveDesign } from './DesignerStorage';
import { DESIGNS_STORE, getDb } from './designerDb';
import { designStoreAdapter } from './designStoreAdapter';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

const cutout: Cutout = {
  id: 'c1',
  shape: 'mesh',
  meshId: 'm1',
  x: 5,
  y: 5,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

const asset: MeshAsset = {
  name: 'wrench',
  data: 'AAAA',
  triangleCount: 1,
  sizeMm: { x: 20, y: 10, z: 5 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 10 },
    ],
  ],
};

beforeEach(async () => {
  closeDesignerDb();
  __resetMeshStoreForTests();
  await deleteDb('gridfinity-designer-v1');
  await deleteDb('gridfinity-mesh-files');
});

describe('designStoreAdapter.loadDesign', () => {
  it('hands layout exports and shares the meshes inline', async () => {
    const saved = unwrap(
      await saveDesign({
        name: 'd',
        params: { ...DEFAULT_BIN_PARAMS, cutouts: [cutout], meshAssets: { m1: asset } },
        thumbnail: null,
        exportFileNameConfig: null,
      })
    );

    const loaded = unwrap(await designStoreAdapter.loadDesign(saved.id));

    expect((loaded.params as SavedDesign['params'])?.meshAssets).toEqual({ m1: asset });
  });

  it('fails a design whose mesh file is missing rather than export it without the mesh', async () => {
    const id = designId('design_missing');
    const design: SavedDesign = {
      id,
      name: 'd',
      params: {
        ...DEFAULT_BIN_PARAMS,
        cutouts: [cutout],
        meshAssets: {
          m1: {
            name: 'gone',
            hash: '8'.repeat(64),
            triangleCount: 1,
            sizeMm: asset.sizeMm,
            bytes: 1,
          },
        },
      },
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      exportFileNameConfig: null,
    };
    await (await getDb()).put(DESIGNS_STORE, design);

    expect(isErr(await designStoreAdapter.loadDesign(id))).toBe(true);
  });

  it('keeps refs, reading no file, for a payload whose files travel apart', async () => {
    const id = designId('design_refs');
    const ref = {
      name: 'gone',
      hash: '8'.repeat(64),
      triangleCount: 1,
      sizeMm: asset.sizeMm,
      bytes: 1,
    };
    const design: SavedDesign = {
      id,
      name: 'd',
      params: { ...DEFAULT_BIN_PARAMS, cutouts: [cutout], meshAssets: { m1: ref } },
      thumbnail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      exportFileNameConfig: null,
    };
    await (await getDb()).put(DESIGNS_STORE, design);

    const loaded = unwrap(await designStoreAdapter.loadDesign(id, { meshRefs: true }));

    expect((loaded.params as SavedDesign['params'])?.meshAssets).toEqual({ m1: ref });
  });
});
