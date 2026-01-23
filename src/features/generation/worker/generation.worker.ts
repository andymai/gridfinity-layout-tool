/**
 * Web Worker entry point for bin geometry generation.
 *
 * Receives messages from GenerationBridge, runs geometry generation,
 * and posts results back. Runs off the main thread to avoid blocking UI.
 *
 * Protocol:
 * - INIT → INIT_READY (future: load WASM here)
 * - GENERATE → PROGRESS* → MESH_RESULT | ERROR
 * - CANCEL → (silently aborts current generation)
 */

import type { WorkerMessage, WorkerResponse, MeshData } from '../bridge/types';
import type { BinParams } from '@/features/bin-designer/types';
import { generateBinGeometry } from './generators/binGenerator';
import { generateBaseGeometry } from './generators/baseGenerator';
import { mergeMeshes } from './generators/geometry';

/** Currently active generation request ID (for cancellation) */
let activeRequestId: string | null = null;

/** Post a typed response to the main thread */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/** Post a progress update */
function reportProgress(requestId: string, stage: WorkerResponse extends { type: 'PROGRESS' } ? WorkerResponse['stage'] : string, progress: number): void {
  respond({
    type: 'PROGRESS',
    requestId,
    stage: stage as 'base' | 'shell' | 'features' | 'merge',
    progress,
  });
}

/**
 * Main generation pipeline.
 * Produces geometry in stages: base → shell → features → merge.
 */
function generate(params: BinParams, requestId: string): void {
  activeRequestId = requestId;
  const startTime = performance.now();

  try {
    // Stage 1: Generate base
    reportProgress(requestId, 'base', 0.1);
    if (activeRequestId !== requestId) return; // Cancelled

    const baseMesh = generateBaseGeometry(params);

    // Stage 2: Generate shell
    reportProgress(requestId, 'shell', 0.4);
    if (activeRequestId !== requestId) return;

    const binMesh = generateBinGeometry(params);

    // Stage 3: Features already included in binMesh (dividers etc.)
    reportProgress(requestId, 'features', 0.7);
    if (activeRequestId !== requestId) return;

    // Stage 4: Merge all geometry
    reportProgress(requestId, 'merge', 0.9);
    if (activeRequestId !== requestId) return;

    const meshes: MeshData[] = [binMesh];
    if (baseMesh.triangleCount > 0) {
      meshes.push(baseMesh);
    }
    const finalMesh = meshes.length === 1 ? meshes[0] : mergeMeshes(meshes);

    const timingMs = performance.now() - startTime;

    respond({
      type: 'MESH_RESULT',
      requestId,
      vertices: finalMesh.vertices,
      normals: finalMesh.normals,
      triangleCount: finalMesh.triangleCount,
      timingMs,
    });
  } catch (e) {
    respond({
      type: 'ERROR',
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    if (activeRequestId === requestId) {
      activeRequestId = null;
    }
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'INIT':
      // In future: load WASM module here
      respond({ type: 'INIT_READY' });
      break;

    case 'GENERATE':
      generate(message.payload.params, message.payload.requestId);
      break;

    case 'CANCEL':
      if (activeRequestId === message.requestId) {
        activeRequestId = null;
      }
      break;
  }
});
