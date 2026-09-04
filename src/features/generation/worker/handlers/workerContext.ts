/**
 * Shared worker state and utilities used by message handlers.
 *
 * Encapsulates the mutable worker state (active request, abort controller,
 * kernel status) and provides helper functions for generation, export,
 * progress reporting, and error handling.
 */

import type { WorkerResponse, MeshData, KernelName, ExportErrorCode } from '../../bridge/types';
import { clearAllCaches } from '../generators/shapeCache';
import { clearBaseplateCaches } from '../generators/baseplateGenerator';
import { clearMeshImprintCache } from '../generators/meshImprint';
import { recoverBrepkitKernel, getLastBrepkitPanic, getKernelHeapBytes } from '../wasmInstantiator';
import { isAbortError } from '../generators/utils/abort';
import { isWasmTrap } from '@/shared/generation/wasmTrap';
import { PerfCollector } from '../generators/pipeline/perfCollector';
import { recordCompletedGeneration } from '../generators/estimateBin';

/** Mutable worker state */
let activeRequestId: string | null = null;
let activeController: AbortController | null = null;
let kernelInitialized = false;
let kernelCrashed = false;
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

/** Borrow-flag poison signature thrown by every op after the kernel is stranded. */
const POISON_RE = /recursive use of an object|unsafe aliasing/i;

/**
 * brepkit kernel-poison recovery. A stranded wasm borrow flag (brepkit task #14:
 * a `raw_vec` capacity-overflow panic-abort, or a JS exception unwinding through
 * a `&mut self` method) makes every later request throw "recursive use / unsafe
 * aliasing"; left unhandled the worker stays bricked until the page reloads. When
 * the active kernel is brepkit and this error is the poison signature (or
 * brepkit's panic hook recorded a trap on the poisoning request itself), drop the
 * now-stale cache handles that index the dead arena and recreate the kernel so the
 * NEXT request runs on a fresh borrow flag. No-op for occt-wasm/manifold.
 */
function maybeRecoverPoisonedKernel(errorMsg: string): void {
  if (activeKernel !== 'brepkit') return;
  if (!POISON_RE.test(errorMsg) && !getLastBrepkitPanic()) return;
  // Best-effort cache eviction: disposal calls shape.delete() on the poisoned
  // kernel. brepkit's dispose is a no-op (safe even while poisoned), but guard
  // anyway so a throwing disposer can't prevent the essential step — recreating
  // the kernel — from running.
  for (const clear of [clearAllCaches, clearBaseplateCaches, clearMeshImprintCache]) {
    try {
      clear();
    } catch (err) {
      console.warn('[Worker] cache eviction during kernel recovery failed (continuing):', err);
    }
  }
  try {
    if (recoverBrepkitKernel()) {
      console.warn('[Worker] brepkit kernel was poisoned; recreated it for the next request.');
    }
  } catch (err) {
    console.error('[Worker] brepkit kernel recovery failed:', err);
  }
}

const KERNEL_CRASHED_MESSAGE = 'Geometry kernel crashed and must be restarted';

/** occt-wasm links with MAXIMUM_MEMORY at the wasm32 ceiling. */
const WASM32_HEAP_CEILING_BYTES = 4 * 1024 * 1024 * 1024;

type KernelCrashCode = Extract<ExportErrorCode, 'KERNEL_CRASHED' | 'OUT_OF_MEMORY'>;

function heapAtCeiling(): boolean {
  const heapBytes = getKernelHeapBytes();
  return heapBytes !== null && heapBytes >= WASM32_HEAP_CEILING_BYTES;
}

/**
 * Latch a WASM trap (see `isWasmTrap`) so every later request on this worker
 * is refused with `KERNEL_CRASHED` until the main thread replaces the worker,
 * instead of running on the corrupted instance.
 *
 * A trap with the heap grown to the ceiling is the allocator failing, not a
 * kernel bug (a 4x4x36 goma bin needs more than 4 GB to tessellate): report
 * that as `OUT_OF_MEMORY` so the caller can say so instead of retrying.
 */
function noteKernelCrash(e: unknown): KernelCrashCode | null {
  if (!isWasmTrap(e)) return null;
  kernelCrashed = true;
  return heapAtCeiling() ? 'OUT_OF_MEMORY' : 'KERNEL_CRASHED';
}

function describeCrash(code: KernelCrashCode, e: unknown): string {
  return code === 'OUT_OF_MEMORY'
    ? `Geometry kernel ran out of memory at the ${WASM32_HEAP_CEILING_BYTES / 1048576} MB WebAssembly limit (${formatError(e)})`
    : `Geometry kernel crashed (${formatError(e)})`;
}

/** Check kernel init state, responding with error if not ready. */
function requireKernel(requestId: string): boolean {
  if (kernelCrashed) {
    respond({
      type: 'ERROR',
      requestId,
      error: KERNEL_CRASHED_MESSAGE,
      errorCode: 'KERNEL_CRASHED',
    });
    return false;
  }
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
    const meshData = generator(signal, perfCollector);

    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;
    const perfSnapshot = perfCollector.snapshot(timingMs);
    recordCompletedGeneration(perfSnapshot);

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

    // Prepare sliding-tray buffers when present (rides the bin's rail)
    const slideTray = meshData.slideTrayMesh
      ? {
          vertices: maybeCopy(meshData.slideTrayMesh.vertices),
          normals: maybeCopy(meshData.slideTrayMesh.normals),
          indices: maybeCopy(meshData.slideTrayMesh.indices),
          edgeVertices: maybeCopy(meshData.slideTrayMesh.edgeVertices),
          triangleCount: meshData.slideTrayMesh.triangleCount,
          restZ: meshData.slideTrayMesh.restZ,
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

    const feet = meshData.detachableFeetMesh
      ? {
          vertices: maybeCopy(meshData.detachableFeetMesh.vertices),
          normals: maybeCopy(meshData.detachableFeetMesh.normals),
          indices: maybeCopy(meshData.detachableFeetMesh.indices),
          edgeVertices: maybeCopy(meshData.detachableFeetMesh.edgeVertices),
          triangleCount: meshData.detachableFeetMesh.triangleCount,
        }
      : undefined;

    const knifeRest = meshData.knifeRestMesh
      ? {
          vertices: maybeCopy(meshData.knifeRestMesh.vertices),
          normals: maybeCopy(meshData.knifeRestMesh.normals),
          indices: maybeCopy(meshData.knifeRestMesh.indices),
          edgeVertices: maybeCopy(meshData.knifeRestMesh.edgeVertices),
          triangleCount: meshData.knifeRestMesh.triangleCount,
        }
      : undefined;

    // Plates are a variable-length set, unlike the fixed lid/stack/connector
    // companions — each carries its own buffers plus its seated pose.
    const labelPlates = meshData.labelPlates
      ? {
          plates: meshData.labelPlates.plates.map((plate) => ({
            vertices: maybeCopy(plate.vertices),
            normals: maybeCopy(plate.normals),
            indices: maybeCopy(plate.indices),
            triangleCount: plate.triangleCount,
            seatX: plate.seatX,
            seatY: plate.seatY,
            seatZ: plate.seatZ,
            slideY: plate.slideY,
            ...(plate.slideZ !== undefined ? { slideZ: plate.slideZ } : {}),
            ...(plate.yawDeg !== undefined ? { yawDeg: plate.yawDeg } : {}),
            widthMm: plate.widthMm,
          })),
          omittedCount: meshData.labelPlates.omittedCount,
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
      ...(slideTray
        ? {
            slideTrayVertices: slideTray.vertices,
            slideTrayNormals: slideTray.normals,
            slideTrayIndices: slideTray.indices,
            slideTrayEdgeVertices: slideTray.edgeVertices,
            slideTrayTriangleCount: slideTray.triangleCount,
            slideTrayRestZ: slideTray.restZ,
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
      ...(feet
        ? {
            detachableFeetVertices: feet.vertices,
            detachableFeetNormals: feet.normals,
            detachableFeetIndices: feet.indices,
            detachableFeetEdgeVertices: feet.edgeVertices,
            detachableFeetTriangleCount: feet.triangleCount,
          }
        : {}),
      ...(knifeRest
        ? {
            knifeRestVertices: knifeRest.vertices,
            knifeRestNormals: knifeRest.normals,
            knifeRestIndices: knifeRest.indices,
            knifeRestEdgeVertices: knifeRest.edgeVertices,
            knifeRestTriangleCount: knifeRest.triangleCount,
          }
        : {}),
      ...(labelPlates ? { labelPlates } : {}),
      ...(meshData.labelTextOverflow ? { labelTextOverflow: meshData.labelTextOverflow } : {}),
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
    if (slideTray) {
      transfer.push(
        slideTray.vertices.buffer,
        slideTray.normals.buffer,
        slideTray.indices.buffer,
        slideTray.edgeVertices.buffer
      );
    }
    if (feet) {
      transfer.push(
        feet.vertices.buffer,
        feet.normals.buffer,
        feet.indices.buffer,
        feet.edgeVertices.buffer
      );
    }
    if (knifeRest) {
      transfer.push(
        knifeRest.vertices.buffer,
        knifeRest.normals.buffer,
        knifeRest.indices.buffer,
        knifeRest.edgeVertices.buffer
      );
    }
    if (connectorKey) {
      transfer.push(
        connectorKey.vertices.buffer,
        connectorKey.normals.buffer,
        connectorKey.indices.buffer
      );
    }
    if (labelPlates) {
      for (const plate of labelPlates.plates) {
        transfer.push(plate.vertices.buffer, plate.normals.buffer, plate.indices.buffer);
      }
    }
    const nonEmptyTransfer = transfer.filter((b) => b.byteLength > 0);
    self.postMessage(response, { transfer: nonEmptyTransfer });
  } catch (e) {
    if (isAbortError(e)) return;
    const errorMsg = formatError(e);
    // Recreate the kernel if this failure stranded brepkit's borrow flag, so the
    // next request isn't cascaded into "recursive use" — even when this request
    // was already superseded (the poison is global to the kernel).
    maybeRecoverPoisonedKernel(errorMsg);
    // A superseded request's error is normally dropped, but a crash has to reach
    // the main thread regardless: nothing else tells it to replace the worker.
    const crash = noteKernelCrash(e);
    if (activeRequestId !== requestId && !crash) return;

    console.error(`[${logPrefix}] Generation failed:`, errorMsg);
    if (e instanceof Error && e.stack) {
      console.error(`[${logPrefix}] Stack:`, e.stack);
    }
    respond({
      type: 'ERROR',
      requestId,
      error: crash ? describeCrash(crash, e) : errorMsg,
      ...(crash ? { errorCode: crash } : {}),
    });
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
    const crash = noteKernelCrash(e);
    if (crash) {
      // The warm has no caller waiting, but the trap still poisoned the
      // instance; an ERROR with the code is what makes the bridge replace it.
      respond({ type: 'ERROR', requestId, error: describeCrash(crash, e), errorCode: crash });
    } else if (!isAbortError(e)) {
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
  if (isWasmTrap(e)) return heapAtCeiling() ? 'OUT_OF_MEMORY' : 'KERNEL_CRASHED';
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
    // Recreate the kernel if this export stranded brepkit's borrow flag, so the
    // next request isn't cascaded into "recursive use".
    maybeRecoverPoisonedKernel(formatError(e));
    const crash = noteKernelCrash(e);
    const errorCode = crash ?? classifyError?.(e);
    respond({
      type: 'ERROR',
      requestId,
      error: `${errorPrefix}: ${crash ? describeCrash(crash, e) : formatError(e)}`,
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
