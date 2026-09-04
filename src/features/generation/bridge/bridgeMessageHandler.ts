/**
 * Worker-message handler for `GenerationBridge`.
 *
 * The bridge installs this listener on its worker; the listener routes
 * each WorkerResponse to the appropriate state mutation (generation
 * resolve/reject, export resolve/reject, cache stats, kernel perf stats).
 *
 * Extracted from the bridge class to keep the state-machine file focused on
 * lifecycle. The handler captures the bridge as a `MessageHandlerContext`
 * — a narrow view of the private fields it needs to mutate.
 */

import type { WorkerResponse } from './types';
import type { AdaptiveDebounce } from './adaptiveDebounce';
import type { GenerationResultCache } from './resultCache';
import type {
  ProgressCallback,
  GenerationResult,
  ExportSlot,
  PendingExport,
  PendingExportMap,
  ThreadingInfo,
  MeshImportOutcome,
} from './bridgeTypes';
import { WorkerRequestError } from './bridgeTypes';

export interface MessageHandlerContext {
  worker: Worker | null;
  initPromise: Promise<void> | null;
  threadingInfo: ThreadingInfo | null;
  currentRequestId: string | null;
  isWarming: boolean;
  pendingResolve: ((result: GenerationResult) => void) | null;
  pendingReject: ((error: Error) => void) | null;
  onProgress: ProgressCallback | null;
  readonly adaptiveDebounce: AdaptiveDebounce;
  readonly binCache: GenerationResultCache;
  readonly baseplateCache: GenerationResultCache;
  readonly itemCache: GenerationResultCache;
  readonly pendingExports: PendingExportMap;
  readonly pendingEstimates: Map<string, (predictedMs: number | null) => void>;
  readonly pendingImports: Map<
    string,
    {
      readonly resolve: (result: MeshImportOutcome) => void;
      readonly reject: (error: Error) => void;
    }
  >;
  clearPending: () => void;
  clearExportTimer: (pending: PendingExport<unknown>) => void;
  resolveExport: (slot: ExportSlot, requestId: string, result: unknown) => boolean;
  rejectExportByRequestId: (requestId: string, error: Error) => boolean;
  hardResetWorker: (reason?: string) => void;
}

/**
 * Install the worker error + message listeners on `ctx.worker`.
 * Caller must have a non-null worker before calling.
 */
export function installMessageHandler(ctx: MessageHandlerContext): void {
  if (!ctx.worker) return;

  // Handle worker crashes (WASM OOM, unrecoverable kernel errors).
  // Without this, a worker crash leaves pending Promises unresolved and the
  // UI stuck in "generating" state forever.
  ctx.worker.addEventListener('error', (e) => {
    e.preventDefault();
    const message = e.message || 'Worker crashed unexpectedly (possible out-of-memory)';

    // Tear down the dead worker so subsequent calls don't post to it.
    // Clearing initPromise allows re-init on the next generate() call.
    if (ctx.worker) {
      ctx.worker.terminate();
      ctx.worker = null;
    }
    ctx.initPromise = null;
    ctx.threadingInfo = null;

    if (ctx.pendingReject) {
      const reject = ctx.pendingReject;
      ctx.clearPending();
      reject(new Error(message));
    }

    for (const pending of ctx.pendingExports.values()) {
      ctx.clearExportTimer(pending);
      pending.reject(new Error(message));
    }
    ctx.pendingExports.clear();

    for (const pending of ctx.pendingImports.values()) {
      pending.reject(new Error(message));
    }
    ctx.pendingImports.clear();
  });

  ctx.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    switch (response.type) {
      case 'PROGRESS':
        if (response.requestId === ctx.currentRequestId && ctx.onProgress) {
          ctx.onProgress(response.stage, response.progress);
        } else {
          // Export requests live in `pendingExports` (keyed by slot, not the
          // live generate requestId) — route their progress to the export's
          // own callback so the export dialog can show a determinate bar.
          for (const pending of ctx.pendingExports.values()) {
            if (pending.requestId === response.requestId) {
              pending.onProgress?.(response.progress);
              break;
            }
          }
        }
        break;

      case 'WARM_DONE':
        ctx.isWarming = false;
        break;

      case 'ESTIMATE_RESULT':
        ctx.pendingEstimates.get(response.requestId)?.(response.predictedMs);
        break;

      case 'IMPORT_MESH_RESULT': {
        const pendingImport = ctx.pendingImports.get(response.requestId);
        if (pendingImport) {
          ctx.pendingImports.delete(response.requestId);
          pendingImport.resolve({
            ok: true,
            asset: response.asset,
            positions: response.positions,
            indices: response.indices,
            suggestedCutDepth: response.suggestedCutDepth,
            volumeMm3: response.volumeMm3,
          });
        }
        break;
      }

      case 'IMPORT_MESH_ERROR': {
        const pendingImport = ctx.pendingImports.get(response.requestId);
        if (pendingImport) {
          ctx.pendingImports.delete(response.requestId);
          pendingImport.resolve({
            ok: false,
            reason: response.reason,
            message: response.error,
          });
        }
        break;
      }

      case 'MESH_RESULT':
        if (response.requestId === ctx.currentRequestId && ctx.pendingResolve) {
          ctx.adaptiveDebounce.recordTiming(response.timingMs);
          const resolve = ctx.pendingResolve;
          // Lid is optional: assemble it only when the worker actually sent
          // lid arrays. All five lid fields land or are absent together.
          const lidMesh =
            response.lidVertices &&
            response.lidNormals &&
            response.lidIndices &&
            response.lidEdgeVertices &&
            response.lidTriangleCount !== undefined
              ? {
                  vertices: response.lidVertices,
                  normals: response.lidNormals,
                  indices: response.lidIndices,
                  edgeVertices: response.lidEdgeVertices,
                  triangleCount: response.lidTriangleCount,
                  faceGroups: response.lidFaceGroups,
                }
              : undefined;
          // Separate stack-grid baseplate mesh is optional; all five fields
          // arrive together (or none).
          const stackPlateMesh =
            response.stackPlateVertices &&
            response.stackPlateNormals &&
            response.stackPlateIndices &&
            response.stackPlateEdgeVertices &&
            response.stackPlateTriangleCount !== undefined
              ? {
                  vertices: response.stackPlateVertices,
                  normals: response.stackPlateNormals,
                  indices: response.stackPlateIndices,
                  edgeVertices: response.stackPlateEdgeVertices,
                  triangleCount: response.stackPlateTriangleCount,
                }
              : undefined;
          // Sliding-tray mesh is optional; all six fields arrive together.
          const slideTrayMesh =
            response.slideTrayVertices &&
            response.slideTrayNormals &&
            response.slideTrayIndices &&
            response.slideTrayEdgeVertices &&
            response.slideTrayTriangleCount !== undefined &&
            response.slideTrayRestZ !== undefined
              ? {
                  vertices: response.slideTrayVertices,
                  normals: response.slideTrayNormals,
                  indices: response.slideTrayIndices,
                  edgeVertices: response.slideTrayEdgeVertices,
                  triangleCount: response.slideTrayTriangleCount,
                  restZ: response.slideTrayRestZ,
                }
              : undefined;
          // Seated snap-clip mesh is optional; all four fields arrive together.
          const connectorKeyMesh =
            response.connectorKeyVertices &&
            response.connectorKeyNormals &&
            response.connectorKeyIndices &&
            response.connectorKeyTriangleCount !== undefined
              ? {
                  vertices: response.connectorKeyVertices,
                  normals: response.connectorKeyNormals,
                  indices: response.connectorKeyIndices,
                  triangleCount: response.connectorKeyTriangleCount,
                }
              : undefined;
          // Detachable feet are optional; all four fields arrive together.
          const detachableFeetMesh =
            response.detachableFeetVertices &&
            response.detachableFeetNormals &&
            response.detachableFeetIndices &&
            response.detachableFeetTriangleCount !== undefined
              ? {
                  vertices: response.detachableFeetVertices,
                  normals: response.detachableFeetNormals,
                  indices: response.detachableFeetIndices,
                  edgeVertices: response.detachableFeetEdgeVertices ?? new Float32Array(0),
                  triangleCount: response.detachableFeetTriangleCount,
                }
              : undefined;
          // The knife rest is optional; all five fields arrive together.
          const knifeRestMesh =
            response.knifeRestVertices &&
            response.knifeRestNormals &&
            response.knifeRestIndices &&
            response.knifeRestEdgeVertices &&
            response.knifeRestTriangleCount !== undefined
              ? {
                  vertices: response.knifeRestVertices,
                  normals: response.knifeRestNormals,
                  indices: response.knifeRestIndices,
                  edgeVertices: response.knifeRestEdgeVertices,
                  triangleCount: response.knifeRestTriangleCount,
                }
              : undefined;
          const result: GenerationResult = {
            mesh: {
              vertices: response.vertices,
              normals: response.normals,
              indices: response.indices,
              edgeVertices: response.edgeVertices,
              triangleCount: response.triangleCount,
              faceGroups: response.faceGroups,
              coarseLOD: response.coarseLOD,
              lidMesh,
              stackPlateMesh,
              slideTrayMesh,
              connectorKeyMesh,
              detachableFeetMesh,
              knifeRestMesh,
              labelPlates: response.labelPlates,
              labelTextOverflow: response.labelTextOverflow,
              typeStemWarning: response.typeStemWarning,
            },
            timingMs: response.timingMs,
            perfSnapshot: response.perfSnapshot,
          };

          // Only one of the three has a request in flight; the other two
          // hold no pending fingerprint and ignore the offer.
          ctx.binCache.commit(result);
          ctx.baseplateCache.commit(result);
          ctx.itemCache.commit(result);

          ctx.clearPending();
          resolve(result);
        }
        break;

      case 'ERROR': {
        const error = new WorkerRequestError(response.error, response.errorCode);
        if (response.requestId === ctx.currentRequestId && ctx.pendingReject) {
          const reject = ctx.pendingReject;
          ctx.clearPending();
          reject(error);
        } else {
          ctx.rejectExportByRequestId(response.requestId, error);
        }
        // A trapped kernel refuses every later request (see isWasmTrap), and a
        // heap grown to the wasm32 ceiling never shrinks; replace the worker
        // now rather than after the next request fails on it.
        if (response.errorCode === 'KERNEL_CRASHED') {
          ctx.hardResetWorker('Worker was reset after a geometry kernel crash');
        } else if (response.errorCode === 'OUT_OF_MEMORY') {
          ctx.hardResetWorker('Worker was reset after the geometry kernel ran out of memory');
        }
        break;
      }

      case 'EXPORT_RESULT':
        ctx.resolveExport('export', response.requestId, {
          data: response.data,
          fileName: response.fileName,
          format: response.format,
          faceGroups: response.faceGroups,
        });
        break;

      case 'BASEPLATE_EXPORT_RESULT':
        ctx.resolveExport('export', response.requestId, {
          data: response.data,
          fileName: response.fileName,
          format: response.format,
          faceGroups: response.faceGroups,
        });
        break;

      case 'DIVIDERS_EXPORT_RESULT':
        ctx.resolveExport('dividers', response.requestId, {
          data: response.data,
          fileName: response.fileName,
        });
        break;

      case 'COMBINED_EXPORT_RESULT':
        ctx.resolveExport('combined', response.requestId, {
          pieces: response.pieces,
          format: response.format,
          faceGroups: response.faceGroups,
        });
        break;

      case 'SPLIT_EXPORT_RESULT':
        ctx.resolveExport('split', response.requestId, {
          pieces: response.pieces,
        });
        break;

      case 'FIT_TEST_EXPORT_RESULT':
        ctx.resolveExport('fitTest', response.requestId, {
          pieces: response.pieces,
          fileName: response.fileName,
          blockedSeams: response.blockedSeams,
        });
        break;

      case 'SPLIT_PREVIEW_RESULT':
        ctx.resolveExport('splitPreview', response.requestId, {
          pieces: response.pieces,
        });
        break;

      case 'INIT_READY':
        // Already handled during init
        break;
    }
  });
}
