// @vitest-environment node
/**
 * Scratch verification (not a CI gate): honeycomb wall pattern must actually
 * carve the walls on the active kernel. On Manifold this was a silent no-op
 * (composeTransform degree/radian mismatch + unimplemented makeCompound in
 * brepjs); plain and honeycomb meshes came back with identical triangles.
 *
 * Run per kernel:
 *   BREPJS_KERNEL=manifold pnpm exec vitest run --config vitest.profile.config.ts honeycombManifoldCheck --reporter=verbose
 *   pnpm exec vitest run --config vitest.profile.config.ts honeycombManifoldCheck --reporter=verbose
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches } from '../shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function minZ(vertices: Float32Array | null): number {
  if (!vertices) return NaN;
  let lo = Infinity;
  for (let i = 2; i < vertices.length; i += 3) lo = Math.min(lo, vertices[i]);
  return lo;
}

describe(`honeycomb wall pattern on ${getKernelName()}`, () => {
  it('carves the walls (triangles change, geometry stays above z=0)', () => {
    const generateBin = getGenerateBin();

    clearAllCaches();
    const plain = generateBin(buildParams({ width: 4, depth: 4, height: 8 }));

    clearAllCaches();
    const honeycomb = generateBin(
      buildParams({
        width: 4,
        depth: 4,
        height: 8,
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'honeycomb' },
      })
    );

    // eslint-disable-next-line no-console
    console.log(
      `[${getKernelName()}] plain tris=${plain.triangleCount} honeycomb tris=${honeycomb.triangleCount} minZ=${minZ(honeycomb.vertices)}`
    );

    expect(honeycomb.triangleCount).toBeGreaterThan(plain.triangleCount);
    expect(minZ(honeycomb.vertices)).toBeGreaterThanOrEqual(-0.001);
  });
});
