// @vitest-environment node
/**
 * Kernel-backed correctness gate for the deferred-socket mesh cache.
 *
 * The cache reuses a previously tessellated socket mesh across generations.
 * These tests prove (1) a cache hit returns geometry byte-identical to a fresh
 * tessellation, and (2) changing the socket's geometry (magnet holes) does not
 * let a stale entry leak into an unrelated bin.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches } from './shapeCache';
import { getSocketMeshCacheStats } from './socketMeshCache';
import type { MeshData } from '../../bridge/types';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

beforeEach(() => {
  clearAllCaches();
});

function expectSameGeometry(a: MeshData, b: MeshData): void {
  expect(a.vertices).toEqual(b.vertices);
  expect(a.normals).toEqual(b.normals);
  expect(a.indices).toEqual(b.indices);
  expect(a.edgeVertices).toEqual(b.edgeVertices);
}

describe('socket mesh cache (kernel)', () => {
  it('a cache hit produces geometry identical to a fresh tessellation', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({ width: 2, depth: 2 });

    const fresh = generateBin(params); // socket-mesh miss → tessellate + store
    const hitsAfterFresh = getSocketMeshCacheStats().hits;

    const hit = generateBin(params); // socket-mesh hit → reuse
    expect(getSocketMeshCacheStats().hits).toBeGreaterThan(hitsAfterFresh);

    expectSameGeometry(fresh, hit);
  });

  it('does not leak a stale socket mesh across a magnet-hole change', () => {
    const generateBin = getGenerateBin();
    const plain = buildParams({
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, magnetHoles: false },
    });
    const magnets = buildParams({
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, magnetHoles: true },
    });

    const plainRef = generateBin(plain);
    generateBin(magnets); // different socket geometry → different key
    const plainAgain = generateBin(plain); // must reuse the plain socket, not the magnet one

    expectSameGeometry(plainRef, plainAgain);
  });
});
