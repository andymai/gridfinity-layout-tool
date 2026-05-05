/**
 * Isolation test — runs `generateBin` under occt-wasm WITHOUT initialising
 * occt first, to determine whether the parity gap from #90 is a real kernel
 * divergence or harness state leakage.
 *
 * Hypothesis being tested:
 *   If the parity test runs `occt` first and `occt-wasm` second, the second
 *   run might inherit cached state. By running occt-wasm in isolation, we
 *   compare its output to the parity-test "occt-wasm" column to see if the
 *   numbers stand up.
 *
 *   - Match → kernels really diverge in generateBin's pipeline.
 *   - Drift → state leakage, fix the harness.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel, getBounds, describe as describeSolid } from 'brepjs';
import { clearAllCaches, getLastSolid } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import { initOcctWasmKernel, loadGenerateBin } from './dualKernelInit';
import type { GenerateBinFn } from './dualKernelInit';
import { CORE_PARITY_CASES } from './testCases';

interface BBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface IsolatedResult {
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  bounds: BBox;
}

describe('occt-wasm isolation: generateBin without occt init', () => {
  const results = new Map<string, IsolatedResult>();

  beforeAll(async () => {
    await initOcctWasmKernel(); // ONLY occt-wasm — no initOcctKernel
    const generateBin: GenerateBinFn = await loadGenerateBin();

    for (const tc of CORE_PARITY_CASES) {
      clearAllCaches();
      const params = migrateParams({ ...DEFAULT_BIN_PARAMS, ...tc.overrides });
      try {
        withKernel('occt-wasm', () => generateBin(params));
      } catch {
        /* ignore mesh-stage errors */
      }
      const solid = withKernel('occt-wasm', () => getLastSolid());
      if (!solid) continue;
      const desc = withKernel('occt-wasm', () => describeSolid(solid));
      const bounds = withKernel('occt-wasm', () => getBounds(solid)) as BBox;
      results.set(tc.name, {
        faceCount: desc.faceCount,
        edgeCount: desc.edgeCount,
        vertexCount: desc.vertexCount,
        bounds,
      });
    }
  }, 600_000);

  it('prints isolated occt-wasm results for cross-reference vs parity test', () => {
    /* eslint-disable no-console */
    console.log('\n=== OCCT-WASM ISOLATION (no occt registered) ===\n');
    for (const tc of CORE_PARITY_CASES) {
      const r = results.get(tc.name);
      if (!r) {
        console.log(`[${tc.name}] no solid produced`);
        continue;
      }
      console.log(
        `[${tc.name}]  F/E/V=${r.faceCount}/${r.edgeCount}/${r.vertexCount}  xMin=${r.bounds.xMin.toFixed(3)}`
      );
    }
    console.log('\nCompare against the "occt-wasm" column of occtWasmParity.test.ts:');
    console.log(
      '  expected (paired run):  1×1 lip=59f, 2×2 nolip=71f, 2×2 mag+screw=170f, 2×2 scoop=355f, 1×1 flat=27f'
    );
    console.log('\n=================================================\n');
    /* eslint-enable no-console */

    expect(results.size).toBeGreaterThan(0);
  });
});
