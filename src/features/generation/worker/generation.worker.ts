/**
 * Web Worker entry point for bin geometry generation using brepjs (OpenCascade WASM).
 *
 * Receives messages from GenerationBridge, initializes the OCCT kernel,
 * runs BREP geometry generation, and posts tessellated mesh results back.
 *
 * Protocol:
 * - INIT -> (load WASM) -> INIT_READY
 * - GENERATE -> PROGRESS* -> MESH_RESULT | ERROR
 * - EXPORT -> EXPORT_RESULT | ERROR (uses cached solid or regenerates)
 * - CANCEL -> (silently aborts current generation)
 */

// Must be first import — polyfills Symbol.dispose before brepjs loads
import './symbolDisposePolyfill';

import type { WorkerMessage, WorkerResponse, MeshData } from '../bridge/types';
import {
  generateBin,
  exportBin,
  exportSplitBin,
  exportSplitBinRange,
  generateSplitPreview,
  generateSplitPreviewRange,
} from './generators/binGenerator';
import { exportDividers } from './generators/dividerExport';
import {
  generateBaseplate,
  exportBaseplate,
  clearBaseplateCaches,
} from './generators/baseplateGenerator';
import { clearAllCaches } from './generators/shapeCache';
import type { KernelName } from '../bridge/types';
import { loadOpenCascade, loadBrepkit } from './wasmInstantiator';

/** Currently active generation request ID (for cancellation) */
let activeRequestId: string | null = null;

/** AbortController for mid-operation cancellation of brepjs boolean operations */
let activeController: AbortController | null = null;

/** Whether a geometry kernel has been initialized */
let kernelInitialized = false;

/** Which kernel was loaded */
let activeKernel: KernelName = 'opencascade';

/** Whether multi-threaded WASM is being used */
let isThreaded = false;

/** Number of CPU cores */
let hardwareConcurrency = 4;

/** Post a typed response to the main thread */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/** Post a progress update */
function reportProgress(
  requestId: string,
  stage: 'base' | 'shell' | 'features' | 'merge' | 'splitting',
  progress: number
): void {
  respond({
    type: 'PROGRESS',
    requestId,
    stage,
    progress,
  });
}

/** Initialize the geometry kernel selected by the INIT message. */
async function initKernel(kernel: KernelName = 'opencascade'): Promise<void> {
  const result = kernel === 'brepkit' ? await loadBrepkit() : await loadOpenCascade();
  isThreaded = result.isThreaded;
  hardwareConcurrency = result.hardwareConcurrency;
  activeKernel = kernel;
  kernelInitialized = true;
}

/** Format an error message from an unknown thrown value */
function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Check kernel init state, responding with error if not ready. Returns true if initialized. */
function requireKernel(requestId: string): boolean {
  if (!kernelInitialized) {
    respond({ type: 'ERROR', requestId, error: 'Geometry kernel not initialized' });
    return false;
  }
  return true;
}

/**
 * Unified generation pipeline for both bin and baseplate mesh generation.
 *
 * @param generator - Function that produces MeshData from params
 * @param requestId - Unique request ID for cancellation tracking
 * @param logPrefix - Prefix for error logging (e.g. 'BinGen', 'BaseplateGen')
 * @param copyBuffers - Whether to copy buffers before transferring (needed when
 *   the generator caches the mesh result internally, e.g. baseplateGenerator)
 */
function runGeneration(
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
    const meshData = generator(signal);

    // Check for cancellation before posting result
    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;

    const verts = copyBuffers ? meshData.vertices.slice() : meshData.vertices;
    const norms = copyBuffers ? meshData.normals.slice() : meshData.normals;
    const idxs = copyBuffers ? meshData.indices.slice() : meshData.indices;
    const edges = copyBuffers ? meshData.edgeVertices.slice() : meshData.edgeVertices;

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
    };
    // Transfer typed array buffers for zero-copy to main thread
    self.postMessage(response, {
      transfer: [verts.buffer, norms.buffer, idxs.buffer, edges.buffer].filter(
        (b) => b.byteLength > 0
      ),
    });
  } catch (e) {
    // AbortError = expected cancellation -- silently discard
    if (e instanceof DOMException && e.name === 'AbortError') return;
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
 *
 * @param requestId - Unique request ID for error responses
 * @param responseType - The WorkerResponse type discriminant to use on success
 * @param exportFn - Async function that performs the export and returns the response payload
 * @param errorPrefix - Human-readable prefix for error messages
 * @param transferFn - Extracts ArrayBuffers to transfer from the response payload
 */
async function runExport<TPayload extends Record<string, unknown>>(
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

/** Extract transferable ArrayBuffers from split preview mesh pieces */
function extractMeshTransferBuffers(payload: {
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
function extractExportTransferBuffers(payload: {
  pieces: ReadonlyArray<{ data: ArrayBuffer }>;
}): ArrayBuffer[] {
  return payload.pieces.map((piece) => piece.data);
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  void (async () => {
    const message: WorkerMessage = event.data;

    switch (message.type) {
      case 'INIT':
        try {
          await initKernel(message.kernel);
          respond({ type: 'INIT_READY', isThreaded, hardwareConcurrency, kernel: activeKernel });
        } catch (e) {
          respond({
            type: 'ERROR',
            requestId: '__init__',
            error: `Kernel init failed: ${formatError(e)}`,
          });
        }
        break;

      case 'GENERATE': {
        const { params, requestId } = message.payload;
        runGeneration(
          (signal) =>
            generateBin(
              params,
              (stage, progress) => {
                if (activeRequestId !== requestId) return;
                reportProgress(
                  requestId,
                  stage as 'base' | 'shell' | 'features' | 'merge',
                  progress
                );
              },
              false,
              signal
            ),
          requestId,
          'BinGen',
          false
        );
        break;
      }

      case 'GENERATE_BASEPLATE': {
        const { params, requestId } = message.payload;
        runGeneration(
          (signal) =>
            generateBaseplate(
              params,
              (stage, progress) => {
                if (activeRequestId !== requestId) return;
                reportProgress(
                  requestId,
                  stage as 'base' | 'shell' | 'features' | 'merge',
                  progress
                );
              },
              false, // preview mode (not export)
              signal
            ),
          requestId,
          'BaseplateGen',
          true // BREP tessellation returns shared buffers — must copy
        );
        break;
      }

      case 'GENERATE_SPLIT_PREVIEW': {
        const splitPreviewPayload = message.payload;
        await runExport(
          splitPreviewPayload.requestId,
          'SPLIT_PREVIEW_RESULT',
          () => {
            reportProgress(splitPreviewPayload.requestId, 'splitting', 0);
            const result = generateSplitPreview(
              splitPreviewPayload.params,
              splitPreviewPayload.cutPlanesX,
              splitPreviewPayload.cutPlanesY,
              splitPreviewPayload.splitConnectorConfig
            );
            reportProgress(splitPreviewPayload.requestId, 'splitting', 1);
            return Promise.resolve({ pieces: result.pieces });
          },
          'Split preview failed',
          extractMeshTransferBuffers
        );
        break;
      }

      case 'EXPORT': {
        const exportPayload = message.payload;
        await runExport(
          exportPayload.requestId,
          'EXPORT_RESULT',
          async () => {
            const result = await exportBin(
              exportPayload.params,
              exportPayload.format,
              exportPayload.tolerance,
              exportPayload.angularTolerance
            );
            return {
              data: result.data,
              format: exportPayload.format,
              fileName: result.fileName,
              faceGroups: result.faceGroups,
            };
          },
          'Export failed',
          (p) => [p.data]
        );
        break;
      }

      case 'EXPORT_BASEPLATE': {
        const bpPayload = message.payload;
        await runExport(
          bpPayload.requestId,
          'BASEPLATE_EXPORT_RESULT',
          async () => {
            const result = await exportBaseplate(
              bpPayload.params,
              bpPayload.format,
              bpPayload.tolerance,
              bpPayload.angularTolerance
            );
            return { data: result.data, format: bpPayload.format, fileName: result.fileName };
          },
          'Baseplate export failed',
          (p) => [p.data]
        );
        break;
      }

      case 'EXPORT_DIVIDERS': {
        const divPayload = message.payload;
        await runExport(
          divPayload.requestId,
          'DIVIDERS_EXPORT_RESULT',
          async () => {
            const result = await exportDividers(divPayload.params);
            return { data: result.data, fileName: result.fileName };
          },
          'Divider export failed',
          (p) => [p.data]
        );
        break;
      }

      case 'EXPORT_SPLIT': {
        const splitPayload = message.payload;
        await runExport(
          splitPayload.requestId,
          'SPLIT_EXPORT_RESULT',
          async () => {
            reportProgress(splitPayload.requestId, 'splitting', 0);
            const result = await exportSplitBin(
              splitPayload.params,
              splitPayload.cutPlanesX,
              splitPayload.cutPlanesY,
              splitPayload.tolerance,
              splitPayload.angularTolerance,
              splitPayload.splitConnectorConfig
            );
            reportProgress(splitPayload.requestId, 'splitting', 1);
            return { pieces: result.pieces };
          },
          'Split export failed',
          extractExportTransferBuffers
        );
        break;
      }

      case 'GENERATE_SPLIT_PREVIEW_RANGE': {
        const { requestId, params, cutPlanesX, cutPlanesY, pieceIndices, splitConnectorConfig } =
          message.payload;
        await runExport(
          requestId,
          'SPLIT_PREVIEW_RESULT',
          () => {
            reportProgress(requestId, 'splitting', 0);
            const result = generateSplitPreviewRange(
              params,
              cutPlanesX,
              cutPlanesY,
              pieceIndices,
              splitConnectorConfig
            );
            reportProgress(requestId, 'splitting', 1);
            return Promise.resolve({ pieces: result.pieces });
          },
          'Split preview range failed',
          extractMeshTransferBuffers
        );
        break;
      }

      case 'EXPORT_SPLIT_RANGE': {
        const {
          requestId,
          params,
          cutPlanesX,
          cutPlanesY,
          pieceIndices,
          tolerance,
          angularTolerance,
          splitConnectorConfig,
        } = message.payload;
        await runExport(
          requestId,
          'SPLIT_EXPORT_RESULT',
          async () => {
            reportProgress(requestId, 'splitting', 0);
            const result = await exportSplitBinRange(
              params,
              cutPlanesX,
              cutPlanesY,
              pieceIndices,
              tolerance,
              angularTolerance,
              splitConnectorConfig
            );
            reportProgress(requestId, 'splitting', 1);
            return { pieces: result.pieces };
          },
          'Split export range failed',
          extractExportTransferBuffers
        );
        break;
      }

      case 'CANCEL':
        if (activeRequestId === message.requestId) {
          activeController?.abort();
          activeController = null;
          activeRequestId = null;
        }
        break;

      case 'CLEANUP':
        clearAllCaches();
        clearBaseplateCaches();
        respond({ type: 'CLEANUP_DONE' });
        break;
    }
  })();
});
