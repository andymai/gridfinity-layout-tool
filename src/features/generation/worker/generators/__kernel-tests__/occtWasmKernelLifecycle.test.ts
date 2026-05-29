/**
 * occt-wasm kernel lifecycle regression.
 *
 * occt-wasm's `OcctKernel` wrapper owns the raw Embind kernel and releases it
 * via a `FinalizationRegistry` when the wrapper is garbage-collected. brepjs's
 * `OcctWasmAdapter` only borrows the raw kernel + module, so the integrator
 * (our worker init) MUST keep the wrapper reachable for as long as the adapter
 * is registered. If the wrapper is dropped, a GC pass fires the finalizer,
 * `raw.delete()` frees the kernel, and the next generation throws:
 *
 *   "Cannot pass deleted object as a pointer of type OcctKernel*"
 *
 * This reproduces the production report: the first bin renders, then a later
 * design change (after enough idle time for a GC) blows up. Requires real
 * occt-wasm WASM + `--expose-gc`.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__kernel-tests__/occtWasmKernelLifecycle
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel } from 'brepjs';
import { initOcctWasmKernel, loadGenerateBin } from './dualKernelInit';
import type { GenerateBinFn } from './dualKernelInit';
import { buildParams } from './scenarioTypes';
import { clearAllCaches } from '../shapeCache';

let generateBin: GenerateBinFn;

beforeAll(async () => {
  await initOcctWasmKernel();
  generateBin = await loadGenerateBin();
}, 60_000);

const gen = (gridW: number, gridD: number): void => {
  withKernel('occt-wasm', () => generateBin(buildParams({ gridW, gridD }), undefined, false));
};

describe('occt-wasm kernel lifecycle', () => {
  it.skipIf(!(globalThis as { gc?: () => void }).gc)(
    'survives a GC pass between generations (wrapper not finalized out from under the adapter)',
    async () => {
      const gcFn = (globalThis as { gc: () => void }).gc;
      const drainGc = async (): Promise<void> => {
        for (let i = 0; i < 5; i++) {
          gcFn();
          // FinalizationRegistry callbacks are scheduled on a later task —
          // yield the macrotask queue so any pending finalizer actually runs.
          await new Promise((resolve) => setImmediate(resolve));
        }
      };

      // First generation: works, and warms the registered adapter.
      expect(() => gen(1, 2)).not.toThrow();

      // Drop cached shapes so the next generation must drive the kernel
      // (not just clone cache hits), then provoke the finalizer.
      clearAllCaches();
      await drainGc();

      // Second generation after GC — this is the production "make a change"
      // step. With the wrapper dropped, the raw kernel is already deleted and
      // this throws the Embind use-after-free.
      expect(() => gen(2, 3)).not.toThrow();
    },
    120_000
  );
});
