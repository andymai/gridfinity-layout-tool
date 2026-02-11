/**
 * Web Worker entry point for bin geometry generation using brepjs (OpenCascade WASM).
 *
 * Receives messages from GenerationBridge, initializes the OCCT kernel,
 * runs BREP geometry generation, and posts tessellated mesh results back.
 *
 * Protocol:
 * - INIT → (load WASM) → INIT_READY
 * - GENERATE → PROGRESS* → MESH_RESULT | ERROR
 * - EXPORT → EXPORT_RESULT | ERROR (uses cached solid or regenerates)
 * - CANCEL → (silently aborts current generation)
 */

import { initFromOC } from 'brepjs';
import type { WorkerMessage, WorkerResponse } from '../bridge/types';
import type { BinParams } from '@/shared/types/bin';
import type { ExportPayload, ExportDividersPayload, ExportSplitPayload } from '../bridge/types';
import { generateBin, exportBin, exportSplitBin } from './generators/binGenerator';
import { exportDividers } from './generators/dividerExport';
import { detectWasmCapabilities } from '../utils/wasmCapabilities';

// Single-threaded WASM (always available)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import opencascadeSingleWasm from 'brepjs-opencascade/src/brepjs_single.wasm?url';

// Multi-threaded WASM (conditionally loaded)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';
import opencascadeThreadedWasm from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import opencascadeThreadedWorker from 'brepjs-opencascade/src/brepjs_threaded.worker.js?url';
import opencascadeThreadedJs from 'brepjs-opencascade/src/brepjs_threaded.js?url';

// Emscripten module factory options (not reflected in the .d.ts)
interface EmscriptenModuleConfig {
  locateFile?: (path: string) => string;
  mainScriptUrlOrBlob?: string;
}

// Type assertion for Emscripten factory functions that accept config
const opencascadeSingle = opencascadeSingleInit as unknown as (
  config?: EmscriptenModuleConfig
) => ReturnType<typeof opencascadeSingleInit>;
const opencascadeThreaded = opencascadeThreadedInit as unknown as (
  config?: EmscriptenModuleConfig
) => ReturnType<typeof opencascadeThreadedInit>;

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
    OC = await opencascadeThreaded({
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
    OC = await opencascadeSingle({
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

/**
 * Main generation pipeline using brepjs BREP operations.
 */
function generate(params: BinParams, requestId: string): void {
  if (!ocInitialized) {
    respond({
      type: 'ERROR',
      requestId,
      error: 'OpenCascade not initialized',
    });
    return;
  }

  activeRequestId = requestId;
  activeController = new AbortController();
  const { signal } = activeController;
  const startTime = performance.now();

  try {
    const meshData = generateBin(
      params,
      (stage, progress) => {
        if (activeRequestId !== requestId) return; // Cancelled
        reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
      },
      false,
      signal
    );

    // Check for cancellation before posting result
    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;

    const response: WorkerResponse = {
      type: 'MESH_RESULT',
      requestId,
      vertices: meshData.vertices,
      normals: meshData.normals,
      indices: meshData.indices,
      edgeVertices: meshData.edgeVertices,
      triangleCount: meshData.triangleCount,
      timingMs,
    };
    // Transfer typed array buffers for zero-copy to main thread
    self.postMessage(response, {
      transfer: [
        meshData.vertices.buffer,
        meshData.normals.buffer,
        meshData.indices.buffer,
        meshData.edgeVertices.buffer,
      ].filter((b) => b.byteLength > 0),
    });
  } catch (e) {
    // AbortError = expected cancellation — silently discard
    if (e instanceof DOMException && e.name === 'AbortError') return;
    if (activeRequestId !== requestId) return; // Cancelled during generation
    const errorMsg = e instanceof Error ? e.message : String(e);
    // Log detailed error info for debugging
    console.error('[BinGen] Generation failed:', errorMsg);
    console.error('[BinGen] Params:', JSON.stringify(params, null, 2));
    if (e instanceof Error && e.stack) {
      console.error('[BinGen] Stack:', e.stack);
    }
    respond({
      type: 'ERROR',
      requestId,
      error: errorMsg,
    });
  } finally {
    if (activeRequestId === requestId) {
      activeRequestId = null;
      activeController = null;
    }
  }
}

/**
 * Export pipeline — generates file (STL/STEP) from BREP solid.
 * Uses the cached solid from the last GENERATE call if available.
 */
async function handleExport(payload: ExportPayload): Promise<void> {
  if (!ocInitialized) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: 'OpenCascade not initialized',
    });
    return;
  }

  try {
    const result = await exportBin(
      payload.params,
      payload.format,
      payload.tolerance,
      payload.angularTolerance
    );

    // Transfer the ArrayBuffer (zero-copy to main thread)
    const response = {
      type: 'EXPORT_RESULT' as const,
      requestId: payload.requestId,
      data: result.data,
      format: payload.format,
      fileName: result.fileName,
    };
    self.postMessage(response, { transfer: [result.data] });
  } catch (e) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: `Export failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Export pipeline for divider pieces — generates combined STL of all dividers.
 */
async function handleExportDividers(payload: ExportDividersPayload): Promise<void> {
  if (!ocInitialized) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: 'OpenCascade not initialized',
    });
    return;
  }

  try {
    const result = await exportDividers(payload.params);

    const response = {
      type: 'DIVIDERS_EXPORT_RESULT' as const,
      requestId: payload.requestId,
      data: result.data,
      fileName: result.fileName,
    };
    self.postMessage(response, { transfer: [result.data] });
  } catch (e) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: `Divider export failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Export pipeline for split bin — generates one STL per piece via boolean cuts.
 */
async function handleExportSplit(payload: ExportSplitPayload): Promise<void> {
  if (!ocInitialized) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: 'OpenCascade not initialized',
    });
    return;
  }

  try {
    reportProgress(payload.requestId, 'splitting', 0);

    const result = await exportSplitBin(
      payload.params,
      payload.cutPlanesX,
      payload.cutPlanesY,
      payload.tolerance,
      payload.angularTolerance
    );

    reportProgress(payload.requestId, 'splitting', 1);

    const response = {
      type: 'SPLIT_EXPORT_RESULT' as const,
      requestId: payload.requestId,
      pieces: result.pieces,
    };

    // Transfer all ArrayBuffers for zero-copy
    const transferables = result.pieces.map((p) => p.data);
    self.postMessage(response, { transfer: transferables });
  } catch (e) {
    respond({
      type: 'ERROR',
      requestId: payload.requestId,
      error: `Split export failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  void (async () => {
    const message = event.data;

    switch (message.type) {
      case 'INIT':
        try {
          await initOpenCascade();
          respond({ type: 'INIT_READY', isThreaded, hardwareConcurrency });
        } catch (e) {
          respond({
            type: 'ERROR',
            requestId: '__init__',
            error: `OpenCascade init failed: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
        break;

      case 'GENERATE':
        generate(message.payload.params, message.payload.requestId);
        break;

      case 'EXPORT':
        await handleExport(message.payload);
        break;

      case 'EXPORT_DIVIDERS':
        await handleExportDividers(message.payload);
        break;

      case 'EXPORT_SPLIT':
        await handleExportSplit(message.payload);
        break;

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
