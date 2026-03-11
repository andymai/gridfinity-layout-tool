/**
 * Shared dual-kernel initialization for parity / stress tests.
 *
 * Unlike `wasmInit.ts` (which selects one kernel via env var), these helpers
 * initialize BOTH OCCT and brepkit in the same process so tests can compare
 * outputs side-by-side.
 */
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type GenerateBinFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

// ─── Kernel initialisation ──────────────────────────────────────────────────

export async function initOcctKernel(): Promise<void> {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await (opencascade as (opts?: Record<string, unknown>) => Promise<unknown>)({
    wasmBinary,
  });
  initFromOC(OC);
}

export async function initBrepkitKernel(): Promise<void> {
  const { registerKernel, BrepkitAdapter } = await import('brepjs');
  const brepkitWasm = await import('brepkit-wasm');
  const kernel = new brepkitWasm.BrepKernel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  const adapter = new BrepkitAdapter(kernel as any);
  registerKernel('brepkit', adapter);
}

/** Import and return the generateBin function. Call after kernel init. */
export async function loadGenerateBin(): Promise<GenerateBinFn> {
  const binMod = await import('@/features/generation/worker/generators/binGenerator');
  return binMod.generateBin as GenerateBinFn;
}

// ─── Mesh volume helper ─────────────────────────────────────────────────────

/**
 * Compute mesh volume via the divergence theorem.
 * Sums signed tetrahedra volumes (each triangle to origin).
 */
export function computeSignedVolume(mesh: MeshData): number {
  const { vertices, indices } = mesh;
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    vol +=
      (vertices[i0] * (vertices[i1 + 1] * vertices[i2 + 2] - vertices[i1 + 2] * vertices[i2 + 1]) +
        vertices[i0 + 1] * (vertices[i1 + 2] * vertices[i2] - vertices[i1] * vertices[i2 + 2]) +
        vertices[i0 + 2] * (vertices[i1] * vertices[i2 + 1] - vertices[i1 + 1] * vertices[i2])) /
      6;
  }
  return Math.abs(vol);
}
