/**
 * Web Worker entry point for bin geometry generation using Replicad (OpenCascade WASM).
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

import { setOC } from 'replicad';
import type { WorkerMessage, WorkerResponse } from '../bridge/types';
import type { BinParams } from '@/shared/types/bin';
import type { ExportPayload, ExportDividersPayload } from '../bridge/types';
import { generateBin, exportBin } from './generators/replicadBin';
import { exportDividers } from './generators/dividerExport';

import opencascade from 'replicad-opencascadejs/src/replicad_single.js';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';

/** Currently active generation request ID (for cancellation) */
let activeRequestId: string | null = null;

/** Whether OCCT has been initialized */
let ocInitialized = false;

/** Post a typed response to the main thread */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/** Post a progress update */
function reportProgress(
  requestId: string,
  stage: 'base' | 'shell' | 'features' | 'merge',
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
 * Initialize OpenCascade WASM kernel.
 * This loads ~11MB of WASM and takes 2-4 seconds.
 */
async function initOpenCascade(): Promise<void> {
  // The Emscripten factory accepts a config object with locateFile
  // to resolve the WASM binary URL relative to the worker
  const OC = await opencascade({
    locateFile: (fileName: string) => {
      if (fileName.endsWith('.wasm')) {
        return opencascadeWasm;
      }
      return fileName;
    },
  });

  setOC(OC);
  ocInitialized = true;
}

/**
 * Main generation pipeline using Replicad BREP operations.
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
  const startTime = performance.now();

  try {
    const meshData = generateBin(params, (stage, progress) => {
      if (activeRequestId !== requestId) return; // Cancelled
      reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
    });

    // Check for cancellation before posting result
    if (activeRequestId !== requestId) return;

    const timingMs = performance.now() - startTime;

    respond({
      type: 'MESH_RESULT',
      requestId,
      vertices: meshData.vertices,
      normals: meshData.normals,
      triangleCount: meshData.triangleCount,
      timingMs,
    });
  } catch (e) {
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

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'INIT':
      try {
        await initOpenCascade();
        respond({ type: 'INIT_READY' });
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

    case 'CANCEL':
      if (activeRequestId === message.requestId) {
        activeRequestId = null;
      }
      break;
  }
});
