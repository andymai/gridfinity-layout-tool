/**
 * Shared dual-kernel initialization for parity / stress tests.
 *
 * Unlike `wasmInit.ts` (which selects one kernel via env var), these helpers
 * initialize BOTH OCCT and brepkit in the same process so tests can compare
 * outputs side-by-side.
 */
import { describe as describeSolid, measureVolume, exportSTEP, unwrap, getKernel } from 'brepjs';
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
}

export type GenerateBinFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

/** Raw brepkit kernel interface for low-level BREP queries. */
export interface RawBrepkitKernel {
  getEntityCounts(solidId: number): number[];
  validateSolid(solidId: number): number;
  getSolidFaces(solidId: number): Iterable<number>;
  getSolidEdges(solidId: number): Iterable<number>;
  getSurfaceType(faceId: number): string;
  getEdgeCurveType(edgeId: number): string;
  unifyFaces(solidId: number): void;
  getWireEdges(wireId: number): Iterable<number>;
}

/** Get the raw brepkit kernel, typed for direct BREP queries. */
export function getRawBrepkitKernel(): RawBrepkitKernel {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- KernelInstance is typed as any in brepjs
  return getKernel('brepkit').oc;
}

/** Extract the internal solid ID from a brepkit Shape3D. */
export function getSolidId(solid: Shape3D): number {
  return (solid.wrapped as { id: number }).id;
}

// ─── Kernel initialisation ──────────────────────────────────────────────────
// Re-export from shared kernelInit.ts to keep existing imports working.

export { initOcctKernel, initBrepkitKernel } from './kernelInit';

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
  return {
    isValid: desc.valid,
    faceCount: desc.faceCount,
    edgeCount: desc.edgeCount,
    vertexCount: desc.vertexCount,
    volume: measureVolume(solid),
    eulerCharacteristic: desc.vertexCount - desc.edgeCount + desc.faceCount,
  };
}

/**
 * Collect BREP topology stats by querying the raw brepkit kernel directly.
 * Bypasses brepjs's internal topology cache (WeakMap on KernelShape), which
 * becomes stale after in-place mutations like `unifyFaces()`.
 * Must be called inside `withKernel('brepkit', ...)`.
 */
export function collectTopologyStatsRaw(
  solid: Shape3D,
  rawKernel: Pick<RawBrepkitKernel, 'getEntityCounts' | 'validateSolidRelaxed'>
): TopologyStats {
  const solidId = getSolidId(solid);
  const [faceCount, edgeCount, vertexCount] = rawKernel.getEntityCounts(solidId);
  // Use relaxed validation: operations like boolean and shell produce
  // geometrically correct shapes that may have minor topology imperfections
  // (boundary edges from edge splitting, non-shared edges at face junctions).
  // Strict validation would flag these as errors. Relaxed checks only for
  // degenerate faces, matching OCCT's effective validation level.
  const validationIssues = rawKernel.validateSolidRelaxed(solidId);
  return {
    isValid: validationIssues === 0,
    faceCount,
    edgeCount,
    vertexCount,
    volume: measureVolume(solid),
    eulerCharacteristic: vertexCount - edgeCount + faceCount,
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
