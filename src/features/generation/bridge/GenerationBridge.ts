/**
 * Main-thread bridge to the generation Web Worker.
 *
 * Manages worker lifecycle, debounces rapid parameter changes, and supports
 * request cancellation via AbortController pattern.
 *
 * Includes params-level deduplication: if generate() is called with the same
 * parameters as the last successful generation, the cached result is returned
 * immediately without dispatching to the worker.
 */

import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';
import type {
  WorkerMessage,
  WorkerResponse,
  WorkerCacheStats,
  MeshData,
  GenerationStage,
  ExportFormat,
  SplitExportPiece,
  SplitPreviewPiece,
  CombinedExportPiece,
  FaceGroupData,
  KernelName,
  KernelPerfCategory,
} from './types';
import { AdaptiveDebounce } from './adaptiveDebounce';
import { computeBaseplateTimeoutMs, computeGenerationTimeoutMs } from './generationTimeout';

/**
 * Deterministic fingerprint for generation params.
 *
 * Uses JSON.stringify with sorted keys to ensure identical params always
 * produce the same string, regardless of property insertion order.
 */
function paramsFingerprint(params: unknown): string {
  return JSON.stringify(params, (_, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}

/** Extract threading info from INIT_READY with defensive validation. */
function extractThreadingInfo(data: {
  isThreaded: boolean;
  hardwareConcurrency: number;
  kernel: KernelName;
}): ThreadingInfo {
  const isThreaded = typeof data.isThreaded === 'boolean' ? data.isThreaded : false;
  const hardwareConcurrency =
    Number.isFinite(data.hardwareConcurrency) && data.hardwareConcurrency > 0
      ? data.hardwareConcurrency
      : 4;
  const kernel = data.kernel === 'brepkit' ? 'brepkit' : 'opencascade';
  return { isThreaded, hardwareConcurrency, kernel };
}

/** Callback for progress updates during generation */
export type ProgressCallback = (stage: GenerationStage, progress: number) => void;

/** Result from a successful generation */
export interface GenerationResult {
  readonly mesh: MeshData;
  readonly timingMs: number;
}

/** Result from a successful BREP export */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly format: ExportFormat;
  readonly faceGroups?: readonly FaceGroupData[];
}

/** Result from a successful dividers export */
export interface DividersExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/** Result from a combined bin + dividers export */
export interface CombinedExportResult {
  readonly pieces: readonly CombinedExportPiece[];
  readonly format: ExportFormat;
  readonly faceGroups?: readonly FaceGroupData[];
}

/** Result from a successful split export */
export interface SplitExportResult {
  readonly pieces: readonly SplitExportPiece[];
}

/** Result from a successful split preview generation (mesh data per piece) */
export interface SplitPreviewResult {
  readonly pieces: readonly SplitPreviewPiece[];
}

/** Result from a successful baseplate export */
export interface BaseplateExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
  readonly format: ExportFormat;
}

/** Aggregated cache performance stats for analytics. */
export interface CacheStatsPayload {
  readonly total_hits: number;
  readonly total_misses: number;
  readonly total_evictions: number;
  readonly hit_rate: number;
  readonly cache_count: number;
  readonly per_cache: readonly WorkerCacheStats[];
}

/** Callback for cache stats reporting */
export type CacheStatsCallback = (stats: CacheStatsPayload) => void;

/** Payload for kernel performance stats callback */
export interface KernelPerfStatsPayload {
  readonly stats: Readonly<Record<string, KernelPerfCategory>>;
}

/** Callback for kernel perf stats reporting */
export type KernelPerfStatsCallback = (payload: KernelPerfStatsPayload) => void;

/** Information about the WASM threading capabilities */
export interface ThreadingInfo {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
  /** Which geometry kernel was loaded */
  readonly kernel: KernelName;
}

/** Size-1 dedup cache: stores the fingerprint and result of the last successful generation. */
interface DedupCache {
  fingerprint: string | null;
  result: GenerationResult | null;
  /** Fingerprint of the currently in-flight request (stored so we can cache on success). */
  pendingFingerprint: string | null;
}

function createDedupCache(): DedupCache {
  return { fingerprint: null, result: null, pendingFingerprint: null };
}

/** Keys for the pending export request slots */
type ExportSlot = 'export' | 'dividers' | 'combined' | 'split' | 'splitPreview';

/** A pending export request: resolve/reject callbacks + request ID */
interface PendingExport<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly requestId: string;
}

/**
 * GenerationBridge manages a single Web Worker instance for geometry generation.
 *
 * Key behaviors:
 * - Debounces rapid generate() calls (200ms)
 * - Cancels in-flight requests when a new one arrives
 * - Provides Promise-based API over the message-passing protocol
 */

/**
 * Defensive fallback timeout for {@link startGenerationTimeout} when a caller
 * omits an explicit budget. Current callers (bin and baseplate generation)
 * pass complexity-aware budgets from {@link computeGenerationTimeoutMs} and
 * {@link computeBaseplateTimeoutMs} respectively; the default is kept so a
 * future caller added without a budget still cancels on unresponsive workers.
 */
const DEFAULT_GENERATION_TIMEOUT_MS = 30_000;

export class GenerationBridge {
  private readonly kernel: KernelName;
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private currentRequestId: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private generationTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolve: ((result: GenerationResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private onProgress: ProgressCallback | null = null;
  private requestCounter = 0;
  private destroyed = false;
  private adaptiveDebounce = new AdaptiveDebounce();
  private threadingInfo: ThreadingInfo | null = null;

  /** Size-1 dedup caches for bin and baseplate generation. */
  private binCache: DedupCache = createDedupCache();
  private baseplateCache: DedupCache = createDedupCache();

  /** Optional callback for cache performance stats (called after each generation). */
  onCacheStats: CacheStatsCallback | null = null;

  /** Optional callback for kernel performance stats (called after each generation). */
  onKernelPerfStats: KernelPerfStatsCallback | null = null;

  constructor(kernel: KernelName = 'opencascade') {
    this.kernel = kernel;
  }

  /** Pending export requests keyed by slot. Only one per slot at a time. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Values are PendingExport<T> with different T per slot; type safety is enforced at each call site
  private pendingExports = new Map<ExportSlot, PendingExport<any>>();

  /**
   * Initialize the worker. Resolves when the worker signals INIT_READY.
   * Safe to call multiple times (returns cached promise).
   *
   * Retries once on failure to recover from transient network errors,
   * CDN edge cache misses, and service worker update races.
   */
  init(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.tryInit().catch((firstError: unknown) => {
      // Tear down the failed worker before retrying
      this.worker?.terminate();
      this.worker = null;

      if (this.destroyed) throw firstError;

      return this.tryInit().catch((retryError: unknown) => {
        // Both attempts failed — throw the retry error (more recent/relevant)
        // but preserve the first error for diagnostics
        const message = retryError instanceof Error ? retryError.message : String(retryError);
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
        throw new Error(`${message} (first attempt: ${firstMessage})`);
      });
    });

    return this.initPromise;
  }

  /** Single init attempt: create worker, send INIT, wait for INIT_READY. */
  private tryInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(new URL('../worker/generation.worker.ts', import.meta.url), {
          type: 'module',
        });

        const onInitError = (e: ErrorEvent): void => {
          // When a worker script fails to load (network error, CSP block, missing module),
          // the ErrorEvent.message is often empty. Build a diagnostic message from whatever
          // fields are available so the error is actionable in telemetry.
          const detail =
            e.message ||
            (e.filename ? `loading ${e.filename}${e.lineno ? `:${e.lineno}` : ''}` : '') ||
            'script failed to load (possible network error, CSP restriction, or unsupported browser)';
          reject(new Error(`Worker failed to initialize: ${detail}`));
        };

        const onInitMessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === 'INIT_READY') {
            this.worker?.removeEventListener('message', onInitMessage);
            this.worker?.removeEventListener('error', onInitError);
            this.threadingInfo = extractThreadingInfo(event.data);
            this.setupMessageHandler();
            resolve();
          } else if (event.data.type === 'ERROR') {
            this.worker?.removeEventListener('message', onInitMessage);
            this.worker?.removeEventListener('error', onInitError);
            reject(new Error(event.data.error));
          }
        };

        this.worker.addEventListener('message', onInitMessage);
        this.worker.addEventListener('error', onInitError);

        this.postMessage({ type: 'INIT', kernel: this.kernel });
      } catch (e) {
        reject(new Error(`Failed to create worker: ${e instanceof Error ? e.message : String(e)}`));
      }
    });
  }

  /**
   * Generate mesh geometry from bin parameters.
   *
   * Debounces calls by adaptive delay (50-300ms). Cancels any in-flight request.
   * Returns the generated mesh data and timing information.
   */
  generate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
    return this.generateInternal(params, onProgress, true);
  }

  /**
   * Generate immediately without debounce.
   * Useful for initial generation or user-triggered regeneration.
   */
  generateImmediate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
    return this.generateInternal(params, onProgress, false);
  }

  /**
   * Internal generation handler shared by generate and generateImmediate.
   */
  private generateInternal(
    params: BinParams,
    onProgress: ProgressCallback | undefined,
    debounce: boolean
  ): Promise<GenerationResult> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }

    // Deduplication: return cached result if params haven't changed
    const fingerprint = paramsFingerprint(params);
    if (this.binCache.fingerprint === fingerprint && this.binCache.result) {
      return Promise.resolve(this.binCache.result);
    }

    // Cancel any pending debounce
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Reject any in-flight request
    this.cancelCurrentRequest();

    this.onProgress = onProgress ?? null;

    return new Promise<GenerationResult>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      if (debounce) {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          this.sendGenerateMessage(params, fingerprint);
        }, this.adaptiveDebounce.getDelay());
      } else {
        this.sendGenerateMessage(params, fingerprint);
      }
    });
  }

  /** Cancel any in-flight generation request */
  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.cancelCurrentRequest();
  }

  /** Terminate the worker and clean up all resources */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.cancel();

    // Reject all pending exports
    for (const pending of this.pendingExports.values()) {
      pending.reject(new Error('Bridge destroyed'));
    }
    this.pendingExports.clear();

    if (this.worker) {
      // terminate() frees the entire WASM heap — no explicit cleanup needed
      this.worker.terminate();
      this.worker = null;
    }

    this.initPromise = null;
    this.onProgress = null;
    this.adaptiveDebounce.reset();
    this.binCache = createDedupCache();
    this.baseplateCache = createDedupCache();
  }

  /**
   * Export the current (or regenerated) bin solid in the specified format.
   * Returns a Promise that resolves with the binary file data.
   *
   * If the worker has a cached solid from a previous generate() call,
   * it exports directly. Otherwise, it regenerates the solid first.
   */
  async exportBin(
    params: BinParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<ExportResult> {
    const requestId = await this.prepareExport('export');

    return new Promise<ExportResult>((resolve, reject) => {
      this.pendingExports.set('export', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT',
        payload: {
          params,
          requestId,
          format,
          tolerance: options?.tolerance,
          angularTolerance: options?.angularTolerance,
        },
      });
    });
  }

  /**
   * Export divider pieces as a combined STL file.
   * Returns a Promise that resolves with the binary file data.
   */
  async exportDividers(params: BinParams): Promise<DividersExportResult> {
    const requestId = await this.prepareExport('dividers');

    return new Promise<DividersExportResult>((resolve, reject) => {
      this.pendingExports.set('dividers', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT_DIVIDERS',
        payload: { params, requestId },
      });
    });
  }

  /**
   * Export bin + divider pieces in a single worker call.
   *
   * Returns labeled pieces that the caller packages per format:
   * - STL: multiple pieces → ZIP
   * - STEP: single compound assembly piece
   * - No dividers: single bin piece
   */
  async exportCombined(
    params: BinParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<CombinedExportResult> {
    const requestId = await this.prepareExport('combined');

    return new Promise<CombinedExportResult>((resolve, reject) => {
      this.pendingExports.set('combined', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT_COMBINED',
        payload: {
          params,
          requestId,
          format,
          tolerance: options?.tolerance,
          angularTolerance: options?.angularTolerance,
        },
      });
    });
  }

  /**
   * Export the current bin solid split into pieces via boolean cuts.
   * Returns a Promise resolving with an array of STL ArrayBuffers, one per piece.
   */
  async exportSplitBin(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      splitConnectorConfig?: SplitConnectorConfig;
    }
  ): Promise<SplitExportResult> {
    const requestId = await this.prepareExport('split');

    return new Promise<SplitExportResult>((resolve, reject) => {
      this.pendingExports.set('split', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT_SPLIT',
        payload: {
          params,
          requestId,
          cutPlanesX,
          cutPlanesY,
          tolerance: options?.tolerance,
          angularTolerance: options?.angularTolerance,
          splitConnectorConfig: options?.splitConnectorConfig,
        },
      });
    });
  }

  /**
   * Generate split bin piece meshes for 3D preview rendering.
   * Returns MeshData per piece instead of STL, for use in Three.js scene.
   */
  async generateSplitPreview(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    options?: {
      splitConnectorConfig?: SplitConnectorConfig;
    }
  ): Promise<SplitPreviewResult> {
    const requestId = await this.prepareExport('splitPreview');

    return new Promise<SplitPreviewResult>((resolve, reject) => {
      this.pendingExports.set('splitPreview', { resolve, reject, requestId });
      this.postMessage({
        type: 'GENERATE_SPLIT_PREVIEW',
        payload: {
          params,
          requestId,
          cutPlanesX,
          cutPlanesY,
          splitConnectorConfig: options?.splitConnectorConfig,
        },
      });
    });
  }

  /**
   * Generate split preview meshes for a subset of pieces.
   * Used by the worker pool to distribute piece processing across workers.
   */
  async generateSplitPreviewRange(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    pieceIndices: readonly number[],
    options?: {
      splitConnectorConfig?: SplitConnectorConfig;
    }
  ): Promise<SplitPreviewResult> {
    const requestId = await this.prepareExport('splitPreview');

    return new Promise<SplitPreviewResult>((resolve, reject) => {
      this.pendingExports.set('splitPreview', { resolve, reject, requestId });
      this.postMessage({
        type: 'GENERATE_SPLIT_PREVIEW_RANGE',
        payload: {
          params,
          requestId,
          cutPlanesX,
          cutPlanesY,
          pieceIndices,
          splitConnectorConfig: options?.splitConnectorConfig,
        },
      });
    });
  }

  /**
   * Export split bin pieces for a subset of piece indices.
   * Used by the worker pool to distribute piece export across workers.
   */
  async exportSplitBinRange(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    pieceIndices: readonly number[],
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      splitConnectorConfig?: SplitConnectorConfig;
    }
  ): Promise<SplitExportResult> {
    const requestId = await this.prepareExport('split');

    return new Promise<SplitExportResult>((resolve, reject) => {
      this.pendingExports.set('split', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT_SPLIT_RANGE',
        payload: {
          params,
          requestId,
          cutPlanesX,
          cutPlanesY,
          pieceIndices,
          tolerance: options?.tolerance,
          angularTolerance: options?.angularTolerance,
          splitConnectorConfig: options?.splitConnectorConfig,
        },
      });
    });
  }

  /**
   * Generate baseplate mesh from baseplate parameters.
   * Uses the same debounce and cancellation as bin generation.
   */
  generateBaseplate(
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return this.generateBaseplateInternal(params, onProgress, true);
  }

  /**
   * Generate baseplate mesh immediately without debounce.
   * Used by the worker pool for parallel split piece generation.
   */
  generateBaseplateImmediate(
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return this.generateBaseplateInternal(params, onProgress, false);
  }

  private generateBaseplateInternal(
    params: BaseplateParams,
    onProgress: ProgressCallback | undefined,
    debounce: boolean
  ): Promise<GenerationResult> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }

    // Deduplication: return cached result if params haven't changed
    const fingerprint = paramsFingerprint(params);
    if (this.baseplateCache.fingerprint === fingerprint && this.baseplateCache.result) {
      return Promise.resolve(this.baseplateCache.result);
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.cancelCurrentRequest();
    this.onProgress = onProgress ?? null;

    return new Promise<GenerationResult>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const sendMessage = (): void => {
        const requestId = this.nextRequestId();
        this.currentRequestId = requestId;
        this.baseplateCache.pendingFingerprint = fingerprint;
        this.startGenerationTimeout(requestId, computeBaseplateTimeoutMs(params));
        this.postMessage({
          type: 'GENERATE_BASEPLATE',
          payload: { params, requestId },
        });
      };

      if (debounce) {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          sendMessage();
        }, this.adaptiveDebounce.getDelay());
      } else {
        sendMessage();
      }
    });
  }

  /**
   * Export baseplate in the specified format.
   */
  async exportBaseplate(
    params: BaseplateParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    const requestId = await this.prepareExport('export');

    return new Promise<BaseplateExportResult>((resolve, reject) => {
      this.pendingExports.set('export', { resolve, reject, requestId });
      this.postMessage({
        type: 'EXPORT_BASEPLATE',
        payload: {
          params,
          requestId,
          format,
          tolerance: options?.tolerance,
          angularTolerance: options?.angularTolerance,
        },
      });
    });
  }

  /** Whether the bridge has been destroyed */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Get threading information after initialization.
   * Returns null if not yet initialized.
   */
  getThreadingInfo(): ThreadingInfo | null {
    return this.threadingInfo;
  }
  /**
   * Prepare an export slot: check destroyed state, ensure worker is initialized,
   * reject any existing pending export on the same slot, and return a new request ID.
   */
  private async prepareExport(slot: ExportSlot): Promise<string> {
    if (this.destroyed) {
      throw new Error('Bridge has been destroyed');
    }

    await this.init();

    // Reject any pending export on this slot (only one at a time)
    const existing = this.pendingExports.get(slot);
    if (existing) {
      existing.reject(new Error('Export superseded'));
      this.pendingExports.delete(slot);
    }

    return this.nextRequestId();
  }

  /**
   * Resolve a pending export by slot, if the request ID matches.
   * Returns true if the export was resolved, false if stale/missing.
   */
  private resolveExport(slot: ExportSlot, requestId: string, result: unknown): boolean {
    const pending = this.pendingExports.get(slot);
    if (pending && pending.requestId === requestId) {
      this.pendingExports.delete(slot);
      pending.resolve(result);
      return true;
    }
    return false;
  }

  /**
   * Reject a pending export by request ID, checking all slots.
   * Returns true if a matching export was found and rejected.
   */
  private rejectExportByRequestId(requestId: string, error: Error): boolean {
    for (const [slot, pending] of this.pendingExports) {
      if (pending.requestId === requestId) {
        this.pendingExports.delete(slot);
        pending.reject(error);
        return true;
      }
    }
    return false;
  }

  private sendGenerateMessage(params: BinParams, fingerprint: string): void {
    const requestId = this.nextRequestId();
    this.currentRequestId = requestId;
    this.binCache.pendingFingerprint = fingerprint;

    this.startGenerationTimeout(requestId, computeGenerationTimeoutMs(params));

    this.postMessage({
      type: 'GENERATE',
      payload: { params, requestId },
    });
  }

  /**
   * Start a timeout to recover from unresponsive workers (WASM OOM, infinite loops).
   * Cleared in clearPending() when the worker responds (success, error, or cancel).
   *
   * Bin and baseplate generations pass complexity-aware budgets; callers
   * without params fall back to {@link DEFAULT_GENERATION_TIMEOUT_MS}.
   */
  private startGenerationTimeout(
    requestId: string,
    timeoutMs: number = DEFAULT_GENERATION_TIMEOUT_MS
  ): void {
    this.clearGenerationTimer();
    this.generationTimer = setTimeout(() => {
      if (this.currentRequestId === requestId && this.pendingReject) {
        const reject = this.pendingReject;
        this.clearPending();
        // Send cancel so the worker can abort if it's still alive
        this.postMessage({ type: 'CANCEL', requestId });
        reject(
          new Error(
            'Generation timed out — this design may be too complex. Try reducing grid size or disabling features like magnets, compartments, or wall patterns.'
          )
        );
      }
    }, timeoutMs);
  }

  private setupMessageHandler(): void {
    if (!this.worker) return;

    // Handle worker crashes (WASM OOM, unrecoverable kernel errors).
    // Without this, a worker crash leaves pending Promises unresolved
    // and the UI stuck in "generating" state forever.
    this.worker.addEventListener('error', (e) => {
      e.preventDefault();
      const message = e.message || 'Worker crashed unexpectedly (possible out-of-memory)';

      // Tear down the dead worker so subsequent calls don't post to it.
      // Clearing initPromise allows re-init on the next generate() call.
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      this.initPromise = null;
      this.threadingInfo = null;

      // Reject the pending generation promise so the UI can show an error
      if (this.pendingReject) {
        const reject = this.pendingReject;
        this.clearPending();
        reject(new Error(message));
      }

      // Reject all pending exports
      for (const pending of this.pendingExports.values()) {
        pending.reject(new Error(message));
      }
      this.pendingExports.clear();
    });

    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      switch (response.type) {
        case 'PROGRESS':
          if (response.requestId === this.currentRequestId && this.onProgress) {
            this.onProgress(response.stage, response.progress);
          }
          break;

        case 'MESH_RESULT':
          if (response.requestId === this.currentRequestId && this.pendingResolve) {
            this.adaptiveDebounce.recordTiming(response.timingMs);
            const resolve = this.pendingResolve;
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
            };

            // Cache for deduplication (bin or baseplate — only one is in-flight)
            this.commitDedupCache(this.binCache, result);
            this.commitDedupCache(this.baseplateCache, result);

            this.clearPending();
            resolve(result);
          }
          break;

        case 'ERROR':
          if (response.requestId === this.currentRequestId && this.pendingReject) {
            const reject = this.pendingReject;
            this.clearPending();
            reject(new Error(response.error));
          } else {
            this.rejectExportByRequestId(response.requestId, new Error(response.error));
          }
          break;

        case 'EXPORT_RESULT':
          this.resolveExport('export', response.requestId, {
            data: response.data,
            fileName: response.fileName,
            format: response.format,
            faceGroups: response.faceGroups,
          });
          break;

        case 'BASEPLATE_EXPORT_RESULT':
          this.resolveExport('export', response.requestId, {
            data: response.data,
            fileName: response.fileName,
            format: response.format,
          });
          break;

        case 'DIVIDERS_EXPORT_RESULT':
          this.resolveExport('dividers', response.requestId, {
            data: response.data,
            fileName: response.fileName,
          });
          break;

        case 'COMBINED_EXPORT_RESULT':
          this.resolveExport('combined', response.requestId, {
            pieces: response.pieces,
            format: response.format,
            faceGroups: response.faceGroups,
          });
          break;

        case 'SPLIT_EXPORT_RESULT':
          this.resolveExport('split', response.requestId, {
            pieces: response.pieces,
          });
          break;

        case 'SPLIT_PREVIEW_RESULT':
          this.resolveExport('splitPreview', response.requestId, {
            pieces: response.pieces,
          });
          break;

        case 'CACHE_STATS':
          this.handleCacheStats(response.caches);
          break;

        case 'KERNEL_PERF_STATS':
          this.onKernelPerfStats?.({ stats: response.stats });
          break;

        case 'INIT_READY':
          // Already handled during init
          break;
      }
    });
  }

  private handleCacheStats(caches: readonly WorkerCacheStats[]): void {
    if (!this.onCacheStats) return;

    let totalHits = 0;
    let totalMisses = 0;
    let totalEvictions = 0;
    for (const c of caches) {
      totalHits += c.hits;
      totalMisses += c.misses;
      totalEvictions += c.evictions;
    }
    const total = totalHits + totalMisses;
    if (total === 0) return;

    this.onCacheStats({
      total_hits: totalHits,
      total_misses: totalMisses,
      total_evictions: totalEvictions,
      hit_rate: Math.round((totalHits / total) * 1000) / 1000,
      cache_count: caches.length,
      per_cache: caches,
    });
  }

  private cancelCurrentRequest(): void {
    if (this.currentRequestId && this.worker) {
      this.postMessage({ type: 'CANCEL', requestId: this.currentRequestId });
    }

    if (this.pendingReject) {
      const reject = this.pendingReject;
      this.clearPending();
      reject(new Error('Generation cancelled'));
    }
  }

  /** If this cache has a pending fingerprint, promote it to the cached result and clear pending. */
  private commitDedupCache(cache: DedupCache, result: GenerationResult): void {
    if (cache.pendingFingerprint) {
      cache.fingerprint = cache.pendingFingerprint;
      cache.result = result;
      cache.pendingFingerprint = null;
    }
  }

  private clearPending(): void {
    this.clearGenerationTimer();
    this.pendingResolve = null;
    this.pendingReject = null;
    this.currentRequestId = null;
    this.onProgress = null;
    this.binCache.pendingFingerprint = null;
    this.baseplateCache.pendingFingerprint = null;
  }

  private clearGenerationTimer(): void {
    if (this.generationTimer !== null) {
      clearTimeout(this.generationTimer);
      this.generationTimer = null;
    }
  }

  private postMessage(message: WorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private nextRequestId(): string {
    return `gen_${++this.requestCounter}_${Date.now()}`;
  }
}
