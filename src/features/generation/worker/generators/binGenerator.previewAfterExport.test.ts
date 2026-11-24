import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { meshTopologyStats } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

// The shape caches outlive a generation, so an export meshes cached shapes at
// export density before the next preview of the same design reuses them.
describe('preview after an export', () => {
  it('meshes the same as a fresh preview, with no open edges', { timeout: 120_000 }, () => {
    const generateBin = getGenerateBin();
    const params = buildParams({ ...DEFAULT_BIN_PARAMS });

    const fresh = generateBin(params, undefined, false);
    generateBin(params, undefined, true);
    const again = generateBin(params, undefined, false);

    expect(again.triangleCount).toBe(fresh.triangleCount);
    expect(meshTopologyStats(again).boundaryEdges).toBe(meshTopologyStats(fresh).boundaryEdges);
    expect(meshTopologyStats(again).boundaryEdges).toBe(0);
  });
});
