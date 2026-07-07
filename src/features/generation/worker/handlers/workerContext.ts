/**
 * Shared worker state and utilities used by message handlers.
 *
 * Encapsulates the mutable worker state (active request, abort controller,
 * kernel status) and provides helper functions for generation, export,
 * progress reporting, and error handling.
 */

import { getPerformanceStats, resetPerformanceStats } from 'brepjs';
import type { WorkerResponse, MeshData, KernelName, ExportErrorCode } from '../../bridge/types';
import { stageStats } from './stageStats';
import { getAllShapeCacheStats, resetAllShapeCacheStats } from '../generators/shapeCache';
import { getBaseplateCacheStats, resetBaseplateCacheStats } from '../generators/baseplateGenerator';
import {
  getBooleanFallbackStats,
  resetBooleanFallbackStats,
} from '../generators/pipeline/stages/booleanStage';
import { isAbortError } from '../generators/utils/abort';
import { PerfCollector } from '../generators/pipeline/perfCollector';
import { recordCompletedGeneration } from '../generators/estimateBin';

/** Mutable worker state */
let activeRequestId: string | null = null;
let activeController: AbortController | null = null;
let kernelInitialized = false;
let activeKernel: KernelName = 'occt-wasm';
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
  generator: (signal: AbortSignal, perf: PerfCollector) => MeshData,
  requestId: string,
  logPrefix: string,
  copyBuffers: boolean
): void {
  if (!requireKernel(requestId)) return;

  activeRequestId = requestId;
  activeController = new AbortController();
  const { signal } = activeController;
  const startTime = performance.now();
  const perfCollector = new PerfCollector();

  try {
    resetPerformanceStats();
    resetBooleanFallbackStats();
    const meshData = generator(signal, perfCollector);

    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;
    const perfSnapshot = perfCollector.snapshot(timingMs);
    recordCompletedGeneration(perfSnapshot);
    // brepjs's perf categories are populated only by the legacy opencascade
    // adapter. occt-wasm (the default kernel) routes booleans through its C++
    // BooleanPipeline and doesn't instrument mesh timing, so getPerformanceStats
    // returns all-zero counts and `generation_kernel_perf` would never fire
    // (its emit guard drops zero-count categories). Fold in the kernel-agnostic
    // pipeline stage timings so the metric survives any kernel.
    const kernelPerfStats = { ...getPerformanceStats(), ...stageStats(perfSnapshot) };

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

    // Prepare lid buffers when present (lid runs alongside bin generation)
    const lid = meshData.lidMesh
      ? {
          vertices: maybeCopy(meshData.lidMesh.vertices),
          normals: maybeCopy(meshData.lidMesh.normals),
          indices: maybeCopy(meshData.lidMesh.indices),
          edgeVertices: maybeCopy(meshData.lidMesh.edgeVertices),
          triangleCount: meshData.lidMesh.triangleCount,
          faceGroups: meshData.lidMesh.faceGroups,
        }
      : undefined;

    // Prepare separate stack-grid baseplate buffers when present (glue-on companion)
    const stackPlate = meshData.stackPlateMesh
      ? {
          vertices: maybeCopy(meshData.stackPlateMesh.vertices),
          normals: maybeCopy(meshData.stackPlateMesh.normals),
          indices: maybeCopy(meshData.stackPlateMesh.indices),
          edgeVertices: maybeCopy(meshData.stackPlateMesh.edgeVertices),
          triangleCount: meshData.stackPlateMesh.triangleCount,
        }
      : undefined;

    // Prepare snap-clip connector buffers when present (split snap-clip plates)
    const connectorKey = meshData.connectorKeyMesh
      ? {
          vertices: maybeCopy(meshData.connectorKeyMesh.vertices),
          normals: maybeCopy(meshData.connectorKeyMesh.normals),
          indices: maybeCopy(meshData.connectorKeyMesh.indices),
          triangleCount: meshData.connectorKeyMesh.triangleCount,
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
      perfSnapshot,
      ...(lid
        ? {
            lidVertices: lid.vertices,
            lidNormals: lid.normals,
            lidIndices: lid.indices,
            lidEdgeVertices: lid.edgeVertices,
            lidTriangleCount: lid.triangleCount,
            lidFaceGroups: lid.faceGroups,
          }
        : {}),
      ...(stackPlate
        ? {
            stackPlateVertices: stackPlate.vertices,
            stackPlateNormals: stackPlate.normals,
            stackPlateIndices: stackPlate.indices,
            stackPlateEdgeVertices: stackPlate.edgeVertices,
            stackPlateTriangleCount: stackPlate.triangleCount,
          }
        : {}),
      ...(connectorKey
        ? {
            connectorKeyVertices: connectorKey.vertices,
            connectorKeyNormals: connectorKey.normals,
            connectorKeyIndices: connectorKey.indices,
            connectorKeyTriangleCount: connectorKey.triangleCount,
          }
        : {}),
    };

    const transfer = [verts.buffer, norms.buffer, idxs.buffer, edges.buffer];
    if (coarseLOD) {
      transfer.push(coarseLOD.vertices.buffer, coarseLOD.indices.buffer);
    }
    if (lid) {
      transfer.push(
        lid.vertices.buffer,
        lid.normals.buffer,
        lid.indices.buffer,
        lid.edgeVertices.buffer
      );
    }
    if (stackPlate) {
      transfer.push(
        stackPlate.vertices.buffer,
        stackPlate.normals.buffer,
        stackPlate.indices.buffer,
        stackPlate.edgeVertices.buffer
      );
    }
    if (connectorKey) {
      transfer.push(
        connectorKey.vertices.buffer,
        connectorKey.normals.buffer,
        connectorKey.indices.buffer
      );
    }
    const nonEmptyTransfer = transfer.filter((b) => b.byteLength > 0);
    self.postMessage(response, { transfer: nonEmptyTransfer });

    const cacheStats = [...getAllShapeCacheStats(), ...getBaseplateCacheStats()];
    respond({ type: 'CACHE_STATS', requestId, caches: cacheStats });
    resetAllShapeCacheStats();
    resetBaseplateCacheStats();

    respond({ type: 'KERNEL_PERF_STATS', requestId, stats: kernelPerfStats });

    const fallbackRecords = getBooleanFallbackStats();
    if (fallbackRecords.length > 0) {
      respond({
        type: 'BOOLEAN_FALLBACK_STATS',
        requestId,
        records: fallbackRecords.map((r) => ({
          category: r.category,
          totalInputs: r.totalInputs,
          batchAttempts: r.batchAttempts,
          batchSucceeded: r.batchSucceeded,
          singletonFallbacks: r.singletonFallbacks,
          failedInputCount: r.failedInputCount,
        })),
      });
      resetBooleanFallbackStats();
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
 * Speculative export-shell warm. Runs an export-quality generation (which
 * populates the export-shell cache + lastSolid) so a subsequent export skips
 * the deferred socket↔body fuse. Best-effort: abort or any failure is swallowed
 * (a warm must never surface an error), and no mesh is transferred back.
 */
export function runWarm(requestId: string, generator: (signal: AbortSignal) => void): void {
  if (!requireKernel(requestId)) return;
  activeRequestId = requestId;
  activeController = new AbortController();
  try {
    generator(activeController.signal);
  } catch (e) {
    if (!isAbortError(e)) {
      console.warn('[Warm] export warm failed (non-fatal):', formatError(e));
    }
  } finally {
    if (activeRequestId === requestId) {
      activeRequestId = null;
      activeController = null;
    }
    respond({ type: 'WARM_DONE', requestId });
  }
}

/**
 * Classify an export-side error by inspecting its message.
 *
 * Codes feed the main-thread resilience wrapper (see `exportWithResilience`):
 * `INVALID_PARAMS` and `EMPTY_GEOMETRY` are non-retryable (user input is wrong);
 * everything else is treated as retryable (transient WASM/BREP wobble).
 *
 * Pattern matching is intentionally permissive — the worker can't reliably
 * raise typed errors across the brepjs WASM boundary, and message text drifts
 * across kernel versions. `UNKNOWN` is the safe default for unmatched errors.
 */
export function classifyExportError(e: unknown): ExportErrorCode {
  const msg = e instanceof Error ? e.message : String(e);
  if (/boolean.*fail|union.*fail|cut.*fail|fuse.*fail/i.test(msg)) {
    return 'BREP_BOOLEAN_FAILED';
  }
  if (/tessellat|triangulat|mesh.*fail/i.test(msg)) {
    return 'MESH_TESSELLATION_FAILED';
  }
  if (/out of memory|allocation failed|oom/i.test(msg)) {
    return 'OUT_OF_MEMORY';
  }
  if (/invalid (param|argument)|out of range|bad input/i.test(msg)) {
    return 'INVALID_PARAMS';
  }
  if (/empty (geometry|solid|shape)|no geometry|zero[- ]size/i.test(msg)) {
    return 'EMPTY_GEOMETRY';
  }
  if (/timeout|timed out/i.test(msg)) {
    return 'TIMEOUT';
  }
  return 'UNKNOWN';
}

/**
 * Unified export handler for all export types.
 *
 * Optional `classifyError` lets the caller attach an {@link ExportErrorCode}
 * to the error response so the main thread can decide whether to retry. When
 * omitted, the error surfaces without a code (treated as retryable upstream).
 */
export async function runExport<TPayload extends Record<string, unknown>>(
  requestId: string,
  responseType: string,
  exportFn: () => Promise<TPayload>,
  errorPrefix: string,
  transferFn: (payload: TPayload) => ArrayBuffer[],
  classifyError?: (e: unknown) => ExportErrorCode | undefined
): Promise<void> {
  if (!requireKernel(requestId)) return;

  try {
    const payload = await exportFn();
    const response = { type: responseType, requestId, ...payload };
    self.postMessage(response, { transfer: transferFn(payload) });
  } catch (e) {
    const errorCode = classifyError?.(e);
    respond({
      type: 'ERROR',
      requestId,
      error: `${errorPrefix}: ${formatError(e)}`,
      ...(errorCode ? { errorCode } : {}),
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
