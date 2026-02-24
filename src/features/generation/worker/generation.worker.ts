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

import { initFromOC } from 'brepjs';
import type { WorkerMessage, WorkerResponse, MeshData } from '../bridge/types';
import { generateBin, exportBin, exportSplitBin } from './generators/binGenerator';
import { exportDividers } from './generators/dividerExport';
import { generateBaseplate, exportBaseplate } from './generators/baseplateGenerator';
import { detectWasmCapabilities } from '../utils/wasmCapabilities';

// Single-threaded WASM (always available)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import opencascadeSingleWasm from 'brepjs-opencascade/src/brepjs_single.wasm?url';

// Multi-threaded WASM (conditionally loaded)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';
import opencascadeThreadedWasm from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import opencascadeThreadedWorker from 'brepjs-opencascade/src/brepjs_threaded.worker.js?url';
import opencascadeThreadedJs from 'brepjs-opencascade/src/brepjs_threaded.js?url';

/** Currently active generation request ID (for cancellation) */
let activeRequestId: string | null = null;

/** AbortController for mid-operation cancellation of brepjs boolean operations */
let activeController: AbortController | null = null;

/** Whether OCCT has been initialized */
let ocInitialized = false;

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

/**
 * Detect if multi-threaded WASM is supported in this worker context.
 * Disabled in development mode due to Vite dev server limitations with pthread workers.
 */
function detectThreadingSupport(): boolean {
  // Disable threading in development - Vite dev server can't handle pthread workers
  // correctly (the worker.js uses dynamic import() which fails in non-module context)
  if (import.meta.env.DEV) {
    return false;
  }
  return detectWasmCapabilities().supportsThreads;
}

/**
 * Initialize OpenCascade WASM kernel.
 * Automatically selects multi-threaded build when browser supports it.
 */
async function initOpenCascade(): Promise<void> {
  // Detect hardware concurrency with robust validation
  hardwareConcurrency =
    typeof navigator !== 'undefined' &&
    Number.isFinite(navigator.hardwareConcurrency) &&
    navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;

  // Check if we can use multi-threaded WASM
  isThreaded = detectThreadingSupport();

  // The Emscripten factory accepts a config object with locateFile
  // to resolve the WASM binary URL relative to the worker

  let OC: Awaited<ReturnType<typeof opencascadeSingleInit>>;
  if (isThreaded) {
    OC = await opencascadeThreadedInit({
      mainScriptUrlOrBlob: opencascadeThreadedJs,
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) {
          return opencascadeThreadedWasm;
        }
        if (fileName.endsWith('.worker.js')) {
          return opencascadeThreadedWorker;
        }
        return fileName;
      },
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Emscripten WASM factory returns untyped module (see vite-env.d.ts TECH-DEBT)
    OC = await opencascadeSingleInit({
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) {
          return opencascadeSingleWasm;
        }
        return fileName;
      },
    });
  }

  initFromOC(OC);
  ocInitialized = true;
}

/** Format an error message from an unknown thrown value */
function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Check OCCT init state, responding with error if not ready. Returns true if initialized. */
function requireOCCT(requestId: string): boolean {
  if (!ocInitialized) {
    respond({ type: 'ERROR', requestId, error: 'OpenCascade not initialized' });
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
  if (!requireOCCT(requestId)) return;

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
  if (!requireOCCT(requestId)) return;

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

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  void (async () => {
    const message: WorkerMessage = event.data;

    switch (message.type) {
      case 'INIT':
        try {
          await initOpenCascade();
          respond({ type: 'INIT_READY', isThreaded, hardwareConcurrency });
        } catch (e) {
          respond({
            type: 'ERROR',
            requestId: '__init__',
            error: `OpenCascade init failed: ${formatError(e)}`,
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
              false,
              signal
            ),
          requestId,
          'BaseplateGen',
          true // Copy buffers -- baseplateGenerator caches mesh results internally
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
              splitPayload.angularTolerance
            );
            reportProgress(splitPayload.requestId, 'splitting', 1);
            return { pieces: result.pieces };
          },
          'Split export failed',
          (p) => (p.pieces as Array<{ data: ArrayBuffer }>).map((piece) => piece.data)
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
    }
  })();
});
