/**
 * Shared dual-kernel initialization for parity / stress tests.
 *
 * Unlike `wasmInit.ts` (which selects one kernel via env var), these helpers
 * initialize BOTH OCCT and brepkit in the same process so tests can compare
 * outputs side-by-side.
 */
import { describe as describeSolid, measureVolume, exportSTEP, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TopologyStats {
  readonly isValid: boolean;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly volume: number;
  readonly eulerCharacteristic: number;
  readonly stepByteSize: number;
  /** Size-only heuristic; actual header validation requires async `validateStepBlob()`. */
  readonly stepNonEmpty: boolean;
}

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

// ─── Topology helpers ────────────────────────────────────────────────────────

/**
 * Collect BREP topology stats from an in-memory solid.
 * Uses brepjs `describe()` for counts/validity and `measureVolume()` for exact volume.
 */
export function collectTopologyStats(solid: Shape3D): TopologyStats {
  const desc = describeSolid(solid);

  // STEP export — synchronous size check only; header validation is async via validateStepBlob()
  let stepByteSize = 0;
  try {
    const blob: Blob = unwrap(exportSTEP(solid));
    stepByteSize = blob.size;
  } catch {
    // exportSTEP may fail on some kernel/shape combos — record as zero
  }

  return {
    isValid: desc.valid,
    faceCount: desc.faceCount,
    edgeCount: desc.edgeCount,
    vertexCount: desc.vertexCount,
    volume: measureVolume(solid),
    eulerCharacteristic: desc.vertexCount - desc.edgeCount + desc.faceCount,
    stepByteSize,
    stepNonEmpty: stepByteSize > 0,
  };
}

/**
 * Export a STEP blob synchronously (kernel-sensitive).
 * Call inside `withKernel()`, then pass the blob to `validateStepBlob()` for async header check.
 */
export function exportStepBlob(solid: Shape3D): Blob | null {
  try {
    return unwrap(exportSTEP(solid));
  } catch {
    return null;
  }
}

/**
 * Validate a STEP blob asynchronously (reads content to check header).
 * Not kernel-sensitive — safe to call outside `withKernel()`.
 */
export async function validateStepBlob(
  blob: Blob | null
): Promise<{ byteSize: number; headerValid: boolean }> {
  if (!blob) return { byteSize: 0, headerValid: false };
  try {
    const buffer = await blob.arrayBuffer();
    const byteSize = buffer.byteLength;
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(50, byteSize)));
    return { byteSize, headerValid: header.trimStart().startsWith('ISO-10303-21') };
  } catch {
    return { byteSize: 0, headerValid: false };
  }
}
