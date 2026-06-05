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

import type { WorkerResponse, WorkerCacheStats } from './types';
import type { AdaptiveDebounce } from './adaptiveDebounce';
import type {
  ProgressCallback,
  GenerationResult,
  CacheStatsCallback,
  KernelPerfStatsCallback,
  BooleanFallbackStatsCallback,
  DedupCache,
  ExportSlot,
  PendingExport,
  PendingExportMap,
  ThreadingInfo,
} from './bridgeTypes';

export interface MessageHandlerContext {
  worker: Worker | null;
  initPromise: Promise<void> | null;
  threadingInfo: ThreadingInfo | null;
  currentRequestId: string | null;
  isWarming: boolean;
  pendingResolve: ((result: GenerationResult) => void) | null;
  pendingReject: ((error: Error) => void) | null;
  onProgress: ProgressCallback | null;
  onCacheStats: CacheStatsCallback | null;
  onKernelPerfStats: KernelPerfStatsCallback | null;
  onBooleanFallbackStats: BooleanFallbackStatsCallback | null;
  readonly adaptiveDebounce: AdaptiveDebounce;
  readonly binCache: DedupCache;
  readonly baseplateCache: DedupCache;
  readonly pendingExports: PendingExportMap;
  readonly pendingEstimates: Map<string, (predictedMs: number | null) => void>;
  clearPending: () => void;
  clearExportTimer: (pending: PendingExport<unknown>) => void;
  resolveExport: (slot: ExportSlot, requestId: string, result: unknown) => boolean;
  rejectExportByRequestId: (requestId: string, error: Error) => boolean;
  commitDedupCache: (cache: DedupCache, result: GenerationResult) => void;
  handleCacheStats: (caches: readonly WorkerCacheStats[]) => void;
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
            },
            timingMs: response.timingMs,
            perfSnapshot: response.perfSnapshot,
          };

          // Cache for deduplication (bin or baseplate — only one is in-flight)
          ctx.commitDedupCache(ctx.binCache, result);
          ctx.commitDedupCache(ctx.baseplateCache, result);

          ctx.clearPending();
          resolve(result);
        }
        break;

      case 'ERROR':
        if (response.requestId === ctx.currentRequestId && ctx.pendingReject) {
          const reject = ctx.pendingReject;
          ctx.clearPending();
          reject(new Error(response.error));
        } else {
          ctx.rejectExportByRequestId(response.requestId, new Error(response.error));
        }
        break;

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

      case 'SPLIT_PREVIEW_RESULT':
        ctx.resolveExport('splitPreview', response.requestId, {
          pieces: response.pieces,
        });
        break;

      case 'CACHE_STATS':
        ctx.handleCacheStats(response.caches);
        break;

      case 'KERNEL_PERF_STATS':
        ctx.onKernelPerfStats?.({ stats: response.stats });
        break;

      case 'BOOLEAN_FALLBACK_STATS':
        ctx.onBooleanFallbackStats?.({ records: response.records });
        break;

      case 'INIT_READY':
        // Already handled during init
        break;
    }
  });
}
