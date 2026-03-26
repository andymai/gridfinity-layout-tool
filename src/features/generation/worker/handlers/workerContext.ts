/**
 * Shared worker state and utilities used by message handlers.
 *
 * Encapsulates the mutable worker state (active request, abort controller,
 * kernel status) and provides helper functions for generation, export,
 * progress reporting, and error handling.
 */

import { getPerformanceStats, resetPerformanceStats } from 'brepjs';
import type { WorkerResponse, MeshData, KernelName } from '../../bridge/types';
import { getAllShapeCacheStats, resetAllShapeCacheStats } from '../generators/shapeCache';
import { getBaseplateCacheStats, resetBaseplateCacheStats } from '../generators/baseplateGenerator';
import { isAbortError } from '../generators/utils/abort';

/** Mutable worker state */
let activeRequestId: string | null = null;
let activeController: AbortController | null = null;
let kernelInitialized = false;
let activeKernel: KernelName = 'opencascade';
let isThreaded = false;
let hardwareConcurrency = 4;

/** Post a typed response to the main thread */
export function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/** Post a progress update */
export function reportProgress(
  requestId: string,
  stage: 'base' | 'shell' | 'features' | 'merge' | 'splitting',
  progress: number
): void {
  respond({ type: 'PROGRESS', requestId, stage, progress });
}

/** Format an error message from an unknown thrown value */
export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Check kernel init state, responding with error if not ready. */
function requireKernel(requestId: string): boolean {
  if (!kernelInitialized) {
    respond({ type: 'ERROR', requestId, error: 'Geometry kernel not initialized' });
    return false;
  }
  return true;
}

/** Get the currently active request ID */
export function getActiveRequestId(): string | null {
  return activeRequestId;
}

/** Get kernel info for INIT_READY response */
export function getKernelInfo(): {
  isThreaded: boolean;
  hardwareConcurrency: number;
  kernel: KernelName;
} {
  return { isThreaded, hardwareConcurrency, kernel: activeKernel };
}

/** Set kernel as initialized */
export function setKernelInitialized(kernel: KernelName, threaded: boolean, cores: number): void {
  activeKernel = kernel;
  isThreaded = threaded;
  hardwareConcurrency = cores;
  kernelInitialized = true;
}

/**
 * Unified generation pipeline for both bin and baseplate mesh generation.
 */
export function runGeneration(
  generator: (signal: AbortSignal) => MeshData,
  requestId: string,
  logPrefix: string,
  copyBuffers: boolean
): void {
  if (!requireKernel(requestId)) return;

  activeRequestId = requestId;
  activeController = new AbortController();
  const { signal } = activeController;
  const startTime = performance.now();

  try {
    // brepjs perf stats are only meaningful for the opencascade kernel
    if (activeKernel === 'opencascade') resetPerformanceStats();
    const meshData = generator(signal);

    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;
    const kernelPerfStats = activeKernel === 'opencascade' ? getPerformanceStats() : {};

    const maybeCopy = <T extends Float32Array | Uint32Array>(buf: T): T =>
      (copyBuffers ? buf.slice() : buf) as T;

    const verts = maybeCopy(meshData.vertices);
    const norms = maybeCopy(meshData.normals);
    const idxs = maybeCopy(meshData.indices);
    const edges = maybeCopy(meshData.edgeVertices);

    // Prepare coarse LOD buffers when available (preview mode)
    const coarseLOD = meshData.coarseLOD
      ? {
          vertices: maybeCopy(meshData.coarseLOD.vertices),
          indices: maybeCopy(meshData.coarseLOD.indices),
          triangleCount: meshData.coarseLOD.triangleCount,
        }
      : undefined;

    const response: WorkerResponse = {
      type: 'MESH_RESULT',
      requestId,
      vertices: verts,
      normals: norms,
      indices: idxs,
      edgeVertices: edges,
      triangleCount: meshData.triangleCount,
      timingMs,
      faceGroups: meshData.faceGroups,
      coarseLOD,
    };

    const transfer = [verts.buffer, norms.buffer, idxs.buffer, edges.buffer];
    if (coarseLOD) {
      transfer.push(coarseLOD.vertices.buffer, coarseLOD.indices.buffer);
    }
    const nonEmptyTransfer = transfer.filter((b) => b.byteLength > 0);
    self.postMessage(response, { transfer: nonEmptyTransfer });

    const cacheStats = [...getAllShapeCacheStats(), ...getBaseplateCacheStats()];
    respond({ type: 'CACHE_STATS', requestId, caches: cacheStats });
    resetAllShapeCacheStats();
    resetBaseplateCacheStats();

    if (activeKernel === 'opencascade') {
      respond({ type: 'KERNEL_PERF_STATS', requestId, stats: kernelPerfStats });
    }
  } catch (e) {
    if (isAbortError(e)) return;
    if (activeRequestId !== requestId) return;
    const errorMsg = formatError(e);

    console.error(`[${logPrefix}] Generation failed:`, errorMsg);
    if (e instanceof Error && e.stack) {
      console.error(`[${logPrefix}] Stack:`, e.stack);
    }
    respond({ type: 'ERROR', requestId, error: errorMsg });
  } finally {
    if (activeRequestId === requestId) {
      activeRequestId = null;
      activeController = null;
    }
  }
}

/**
 * Unified export handler for all export types.
 */
export async function runExport<TPayload extends Record<string, unknown>>(
  requestId: string,
  responseType: string,
  exportFn: () => Promise<TPayload>,
  errorPrefix: string,
  transferFn: (payload: TPayload) => ArrayBuffer[]
): Promise<void> {
  if (!requireKernel(requestId)) return;

  try {
    const payload = await exportFn();
    const response = { type: responseType, requestId, ...payload };
    self.postMessage(response, { transfer: transferFn(payload) });
  } catch (e) {
    respond({
      type: 'ERROR',
      requestId,
      error: `${errorPrefix}: ${formatError(e)}`,
    });
  }
}

/** Cancel the active request if it matches */
export function cancelRequest(requestId: string): void {
  if (activeRequestId === requestId) {
    activeController?.abort();
    activeController = null;
    activeRequestId = null;
  }
}

/** Extract transferable ArrayBuffers from split preview mesh pieces */
export function extractMeshTransferBuffers(payload: {
  pieces: ReadonlyArray<{
    vertices: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    edgeVertices: Float32Array;
  }>;
}): ArrayBuffer[] {
  return payload.pieces
    .flatMap((piece) => [
      piece.vertices.buffer as ArrayBuffer,
      piece.normals.buffer as ArrayBuffer,
      piece.indices.buffer as ArrayBuffer,
      piece.edgeVertices.buffer as ArrayBuffer,
    ])
    .filter((b) => b.byteLength > 0);
}

/** Extract transferable ArrayBuffers from split export pieces */
export function extractExportTransferBuffers(payload: {
  pieces: ReadonlyArray<{ data: ArrayBuffer }>;
}): ArrayBuffer[] {
  return payload.pieces.map((piece) => piece.data);
}
