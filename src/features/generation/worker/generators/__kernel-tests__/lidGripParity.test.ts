/**
 * Dual-kernel parity for the lid's grip relief (#3272).
 *
 * The relief is built from primitives whose behaviour differs between kernels
 * — a rotated extrude and a batched `cutAll` — so "it works" on OCCT says
 * nothing about the brepkit path that the draft preview runs on. A mode that
 * silently produced nothing on one kernel would leave the user previewing a
 * lid that does not match what they export.
 *
 * Volume is the comparison, not triangle counts: the two kernels tessellate
 * differently by design, so mesh statistics disagree even where the solids are
 * identical.
 *
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/lidGripParity
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel } from 'brepjs';
import { initBrepkitKernel, initOcctWasmKernel } from './kernelInit';
import { computeSignedVolume } from './dualKernelInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidGripMode } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

const KERNELS = ['occt-wasm', 'brepkit'] as const;
const MODES: readonly LidGripMode[] = ['chamfer', 'reveal', 'scallop'];

function makeParams(mode: LidGripMode): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 4,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      grip: {
        ...DEFAULT_BIN_PARAMS.lid.grip,
        mode,
        sides: { front: true, back: true, left: false, right: false },
      },
    },
  };
}

beforeAll(async () => {
  await initOcctWasmKernel();
  await initBrepkitKernel();
}, 240000);

describe('grip relief dual-kernel parity', () => {
  for (const mode of MODES) {
    it(`${mode} removes the same volume on both kernels`, async () => {
      const { generateLid } = await import('../lidOrchestrator');
      const params = makeParams(mode);
      const off: BinParams = {
        ...params,
        lid: { ...params.lid, grip: { ...params.lid.grip, mode: 'none' } },
      };

      const removed = new Map<string, number>();
      for (const kernel of KERNELS) {
        const plain = withKernel(kernel, () => generateLid(off));
        const relieved = withKernel(kernel, () => generateLid(params));
        expect(plain, `${kernel} built no plain lid`).not.toBeNull();
        expect(relieved, `${kernel} built no relieved lid`).not.toBeNull();

        const delta =
          Math.abs(computeSignedVolume(plain as MeshData)) -
          Math.abs(computeSignedVolume(relieved as MeshData));
        // A kernel that silently no-opped the cut would land here at ~0.
        expect(delta, `${kernel} removed nothing for ${mode}`).toBeGreaterThan(0.5);
        removed.set(kernel, delta);
      }

      const [a, b] = KERNELS.map((k) => removed.get(k) as number);
      // Tessellation differs, so the volumes are not bit-identical; a few
      // percent apart means the same solid, an order of magnitude does not.
      expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.05);
    }, 240000);
  }
});
