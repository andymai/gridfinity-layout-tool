/**
 * Main-thread bridge to the generation Web Worker.
 *
 * Manages worker lifecycle, debounces rapid parameter changes, and supports
 * request cancellation via AbortController pattern.
 *
 * Includes params-level deduplication: if generate() is called with the same
 * parameters as the last successful generation, the cached result is returned
 * immediately without dispatching to the worker.
 *
 * The class itself focuses on the lifecycle state machine. Concern-specific
 * pieces live in sibling modules:
 *   - `bridgeTypes.ts`: public types + `ExportTimeoutError`
 *   - `bridgeHelpers.ts`: `paramsFingerprint`, threading-info validation,
 *     dedup-cache initialization
 *   - `bridgeMessageHandler.ts`: worker `error` + `message` listener install
 *   - `bridgeExports.ts`: the 8 export methods (delegated 1:1 from this class)
 */

import type {
  BinParams,
  ResolvedBaseplateParams,
  SplitConnectorConfig,
  MarginPiece,
} from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { WorkerMessage, WorkerResponse, WorkerCacheStats, ExportFormat } from './types';
import { AdaptiveDebounce } from './adaptiveDebounce';
import {
  generateBin as generateBinImpl,
  generateBaseplate as generateBaseplateImpl,
  generateMargin as generateMarginImpl,
  generateItem as generateItemImpl,
} from './bridgeGeneration';
import {
  ExportTimeoutError,
  type ProgressCallback,
  type GenerationResult,
  type ExportResult,
  type DividersExportResult,
  type CombinedExportResult,
  type SplitExportResult,
  type SplitPreviewResult,
  type BaseplateExportResult,
  type CacheStatsCallback,
  type KernelPerfStatsCallback,
  type BooleanFallbackStatsCallback,
  type ThreadingInfo,
  type DedupCache,
  type ExportSlot,
  type PendingExport,
  type PendingExportMap,
  type MeshImportOutcome,
} from './bridgeTypes';
import type { MeshImportFlips } from '@/shared/generation/meshAsset';
import { extractThreadingInfo, createDedupCache } from './bridgeHelpers';
import { installMessageHandler } from './bridgeMessageHandler';
import {
  exportBin as exportBinImpl,
  exportDividers as exportDividersImpl,
  exportCombined as exportCombinedImpl,
  exportSplitBin as exportSplitBinImpl,
  generateSplitPreview as generateSplitPreviewImpl,
  generateSplitPreviewRange as generateSplitPreviewRangeImpl,
  exportSplitBinRange as exportSplitBinRangeImpl,
  exportBaseplate as exportBaseplateImpl,
  exportItem as exportItemImpl,
  exportConnectorKey as exportConnectorKeyImpl,
  exportMargin as exportMarginImpl,
  exportConnectorSample as exportConnectorSampleImpl,
} from './bridgeExports';
import type { KernelName } from './types';

export type {
  ProgressCallback,
  GenerationResult,
  ExportResult,
  DividersExportResult,
  CombinedExportResult,
  SplitExportResult,
  SplitPreviewResult,
  BaseplateExportResult,
  CacheStatsPayload,
  CacheStatsCallback,
  KernelPerfStatsPayload,
  KernelPerfStatsCallback,
  BooleanFallbackStatsPayload,
  BooleanFallbackStatsCallback,
  ThreadingInfo,
  MeshImportOutcome,
} from './bridgeTypes';
export { ExportTimeoutError } from './bridgeTypes';

export class GenerationBridge {
  private readonly kernel: KernelName;
  worker: Worker | null = null;
  initPromise: Promise<void> | null = null;
  currentRequestId: string | null = null;
  /** True while a speculative idle export-warm is in flight (clears on WARM_DONE). */
  isWarming = false;
  private warmSeq = 0;
  debounceTimer: ReturnType<typeof setTimeout> | null = null;
  generationTimer: ReturnType<typeof setTimeout> | null = null;
  pendingResolve: ((result: GenerationResult) => void) | null = null;
  pendingReject: ((error: Error) => void) | null = null;
  onProgress: ProgressCallback | null = null;
  private requestCounter = 0;
  private destroyed = false;
  readonly adaptiveDebounce = new AdaptiveDebounce();
  threadingInfo: ThreadingInfo | null = null;

  /** Size-1 dedup caches for bin and baseplate generation. */
  binCache: DedupCache = createDedupCache();
  baseplateCache: DedupCache = createDedupCache();
  itemCache: DedupCache = createDedupCache();

  /** Optional callback for cache performance stats (called after each generation). */
  onCacheStats: CacheStatsCallback | null = null;

  /** Optional callback for kernel performance stats (called after each generation). */
  onKernelPerfStats: KernelPerfStatsCallback | null = null;

  /** Optional callback for boolean fallback stats (called after each generation that had ≥1 fallback). */
  onBooleanFallbackStats: BooleanFallbackStatsCallback | null = null;

  /** Pending export requests keyed by slot. Only one per slot at a time. */
  readonly pendingExports: PendingExportMap = new Map();

  /** Pending cost-estimate requests keyed by their requestId. */
  readonly pendingEstimates = new Map<string, (predictedMs: number | null) => void>();
  private estimateSeq = 0;

  /** Pending mesh-import requests keyed by their requestId. */
  readonly pendingImports = new Map<
    string,
    {
      readonly resolve: (result: MeshImportOutcome) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  private importSeq = 0;

  constructor(kernel: KernelName = 'occt-wasm') {
    this.kernel = kernel;
  }

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
      this.worker?.terminate();
      this.worker = null;

      if (this.destroyed) throw firstError;

      return this.tryInit().catch((retryError: unknown) => {
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
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Generate bin mesh — debounced. */
  generate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
    return generateBinImpl(this, params, onProgress, true);
  }

  /** Generate immediately without debounce — for initial generation or user-triggered regeneration. */
  generateImmediate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
    return generateBinImpl(this, params, onProgress, false);
  }

  /**
   * Predict the cost of generating `params` from the worker's cache state and
   * last observed stage timings. Resolves `null` when the worker has no
   * history, or doesn't answer within the timeout — the worker is single-
   * threaded, so no answer means a generation is already in flight, i.e.
   * things ARE slow. Callers must treat `null` as slow.
   */
  estimateGenerate(params: BinParams, timeoutMs = 30): Promise<number | null> {
    if (this.isDestroyed || !this.worker) return Promise.resolve(null);
    const requestId = `estimate-${++this.estimateSeq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingEstimates.delete(requestId);
        resolve(null);
      }, timeoutMs);
      this.pendingEstimates.set(requestId, (predictedMs) => {
        clearTimeout(timer);
        this.pendingEstimates.delete(requestId);
        resolve(predictedMs);
      });
      this.postMessage({ type: 'ESTIMATE', payload: { params, requestId } });
    });
  }

  /**
   * Parse + normalize an uploaded STL into a compressed `MeshAsset` in the
   * worker. The file buffer is transferred (the caller's copy is detached).
   * Import failures (broken mesh, bad format) resolve as `ok: false`; the
   * promise rejects only on worker-lifecycle failures.
   */
  importMesh(
    buffer: ArrayBuffer,
    fileName: string,
    flips?: MeshImportFlips
  ): Promise<MeshImportOutcome> {
    if (this.isDestroyed || !this.worker) {
      return Promise.reject(new Error('Bridge not initialized'));
    }
    const requestId = `import-${++this.importSeq}`;
    return new Promise((resolve, reject) => {
      this.pendingImports.set(requestId, { resolve, reject });
      this.worker?.postMessage(
        { type: 'IMPORT_MESH', payload: { requestId, buffer, fileName, flips } },
        [buffer]
      );
    });
  }

  /**
   * Speculatively build the export-quality (fused) shell during idle so a
   * subsequent export skips the deferred socket↔body fuse. Best-effort and
   * fire-and-forget: skipped when the worker is busy or already warming, and
   * cleared on WARM_DONE. A new generation simply queues behind an in-flight
   * warm (the separate Manifold draft worker keeps the preview responsive).
   */
  warmExport(params: BinParams): void {
    if (this.isDestroyed || !this.worker) return;
    if (this.isWarming || this.currentRequestId) return;
    this.isWarming = true;
    const requestId = `warm-${++this.warmSeq}`;
    this.postMessage({ type: 'WARM', payload: { params, requestId } });
  }

  /** Cancel any in-flight generation request */
  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.cancelCurrentRequest();
  }

  /**
   * Terminate the current worker and bring up a fresh one.
   *
   * A single-threaded WASM worker blocked inside an uninterruptible synchronous
   * op (e.g. a long boolean union) cannot process a CANCEL message, so the only
   * real recovery is to kill it. Used by the generation-timeout circuit breaker:
   * without this, one over-budget generation wedges the worker and every later
   * generation queues behind it and times out in turn. A replacement worker is
   * started eagerly so the next generation doesn't pay the full init latency.
   */
  hardResetWorker(): void {
    if (this.destroyed) return;
    this.isWarming = false;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initPromise = null;
    // Any export in flight was running on the worker we just killed; reject it
    // so its caller fails fast instead of hanging until its own export timeout.
    for (const pending of this.pendingExports.values()) {
      this.clearExportTimer(pending);
      pending.reject(new Error('Worker was reset after a generation timeout'));
    }
    this.pendingExports.clear();
    for (const pending of this.pendingImports.values()) {
      pending.reject(new Error('Worker was reset'));
    }
    this.pendingImports.clear();
    // Errors here surface on the next generation's init() await; swallow the
    // unhandled rejection from this eager warm-up.
    void this.init().catch(() => {});
  }

  /** Terminate the worker and clean up all resources */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.cancel();

    for (const pending of this.pendingExports.values()) {
      this.clearExportTimer(pending);
      pending.reject(new Error('Bridge destroyed'));
    }
    this.pendingExports.clear();
    for (const pending of this.pendingImports.values()) {
      pending.reject(new Error('Bridge destroyed'));
    }
    this.pendingImports.clear();

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
    this.itemCache = createDedupCache();
  }

  // ── Export methods (delegate to bridgeExports) ────────────────────

  exportBin(
    params: BinParams,
    format: ExportFormat,
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<ExportResult> {
    return exportBinImpl(this, params, format, options);
  }

  exportDividers(params: BinParams): Promise<DividersExportResult> {
    return exportDividersImpl(this, params);
  }

  exportCombined(
    params: BinParams,
    format: ExportFormat,
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<CombinedExportResult> {
    return exportCombinedImpl(this, params, format, options);
  }

  exportSplitBin(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      splitConnectorConfig?: SplitConnectorConfig;
    }
  ): Promise<SplitExportResult> {
    return exportSplitBinImpl(this, params, cutPlanesX, cutPlanesY, options);
  }

  generateSplitPreview(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    options?: { splitConnectorConfig?: SplitConnectorConfig }
  ): Promise<SplitPreviewResult> {
    return generateSplitPreviewImpl(this, params, cutPlanesX, cutPlanesY, options);
  }

  generateSplitPreviewRange(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    pieceIndices: readonly number[],
    options?: { splitConnectorConfig?: SplitConnectorConfig }
  ): Promise<SplitPreviewResult> {
    return generateSplitPreviewRangeImpl(
      this,
      params,
      cutPlanesX,
      cutPlanesY,
      pieceIndices,
      options
    );
  }

  exportSplitBinRange(
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
    return exportSplitBinRangeImpl(this, params, cutPlanesX, cutPlanesY, pieceIndices, options);
  }

  generateBaseplate(
    params: ResolvedBaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return generateBaseplateImpl(this, params, onProgress, true);
  }

  /** Used by the worker pool for parallel split piece generation. */
  generateBaseplateImmediate(
    params: ResolvedBaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return generateBaseplateImpl(this, params, onProgress, false);
  }

  /** Generate one detached margin rail (issue #2392). */
  generateMargin(params: ResolvedBaseplateParams, margin: MarginPiece): Promise<GenerationResult> {
    return generateMarginImpl(this, params, margin);
  }

  exportBaseplate(
    params: ResolvedBaseplateParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportBaseplateImpl(this, params, format, options);
  }

  /** Generate any registered item kind (envelope + discriminated structure). */
  generateItem(item: GridfinityItem, onProgress?: ProgressCallback): Promise<GenerationResult> {
    return generateItemImpl(this, item, onProgress, true);
  }

  /** Generate an item immediately (no debounce) — used for thumbnails/export warmup. */
  generateItemImmediate(
    item: GridfinityItem,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return generateItemImpl(this, item, onProgress, false);
  }

  exportItem(
    item: GridfinityItem,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportItemImpl(this, item, format, options);
  }

  exportConnectorKey(
    params: ResolvedBaseplateParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportConnectorKeyImpl(this, params, format, options);
  }

  /** Export one detached margin rail (issue #2392). */
  exportMargin(
    params: ResolvedBaseplateParams,
    margin: MarginPiece,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportMarginImpl(this, params, margin, format, options);
  }

  exportConnectorSample(
    params: ResolvedBaseplateParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportConnectorSampleImpl(this, params, format, options);
  }

  /** Whether the bridge has been destroyed */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Get threading information after initialization. Returns null if not yet initialized. */
  getThreadingInfo(): ThreadingInfo | null {
    return this.threadingInfo;
  }

  // ── Internal helpers (used by sibling modules + this class) ───────

  /**
   * Prepare an export slot: check destroyed state, ensure worker is initialized,
   * reject any existing pending export on the same slot, and return a new request ID.
   */
  async prepareExport(slot: ExportSlot): Promise<string> {
    if (this.destroyed) {
      throw new Error('Bridge has been destroyed');
    }

    await this.init();

    const existing = this.pendingExports.get(slot);
    if (existing) {
      this.clearExportTimer(existing);
      existing.reject(new Error('Export superseded'));
      this.pendingExports.delete(slot);
    }

    return this.nextRequestId();
  }

  /** Resolve a pending export by slot, if the request ID matches. */
  resolveExport(slot: ExportSlot, requestId: string, result: unknown): boolean {
    const pending = this.pendingExports.get(slot);
    if (pending && pending.requestId === requestId) {
      this.pendingExports.delete(slot);
      this.clearExportTimer(pending);
      pending.resolve(result);
      return true;
    }
    return false;
  }

  /** Reject a pending export by request ID, checking all slots. */
  rejectExportByRequestId(requestId: string, error: Error): boolean {
    for (const [slot, pending] of this.pendingExports) {
      if (pending.requestId === requestId) {
        this.pendingExports.delete(slot);
        this.clearExportTimer(pending);
        pending.reject(error);
        return true;
      }
    }
    return false;
  }

  /** Clear an export's timeout timer, if any. */
  clearExportTimer(pending: PendingExport<unknown>): void {
    if (pending.timer !== null) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
  }

  /**
   * Start a timeout that recovers from an in-flight export the worker never
   * answers. On fire, removes the pending entry, hard-resets the worker (a
   * worker wedged in a long synchronous export can't process a CANCEL, exactly
   * as on the generation path), and rejects with an `ExportTimeoutError`.
   */
  startExportTimeout(slot: ExportSlot, requestId: string, timeoutMs: number): void {
    const pending = this.pendingExports.get(slot);
    if (!pending) return;
    pending.timer = setTimeout(() => {
      const current = this.pendingExports.get(slot);
      if (!current || current.requestId !== requestId) return;
      this.pendingExports.delete(slot);
      current.timer = null;
      // Drop this slot before resetting so hardResetWorker doesn't also reject
      // it with the generic reset error — it gets the specific timeout error.
      this.hardResetWorker();
      current.reject(new ExportTimeoutError());
    }, timeoutMs);
  }

  private setupMessageHandler(): void {
    installMessageHandler(this);
  }

  handleCacheStats(caches: readonly WorkerCacheStats[]): void {
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

  cancelCurrentRequest(): void {
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
  commitDedupCache(cache: DedupCache, result: GenerationResult): void {
    if (cache.pendingFingerprint) {
      cache.fingerprint = cache.pendingFingerprint;
      cache.result = result;
      cache.pendingFingerprint = null;
    }
  }

  clearPending(): void {
    this.clearGenerationTimer();
    this.pendingResolve = null;
    this.pendingReject = null;
    this.currentRequestId = null;
    this.onProgress = null;
    this.binCache.pendingFingerprint = null;
    this.baseplateCache.pendingFingerprint = null;
    this.itemCache.pendingFingerprint = null;
  }

  private clearGenerationTimer(): void {
    if (this.generationTimer !== null) {
      clearTimeout(this.generationTimer);
      this.generationTimer = null;
    }
  }

  postMessage(message: WorkerMessage): void {
    this.worker?.postMessage(message);
  }

  nextRequestId(): string {
    return `gen_${++this.requestCounter}_${Date.now()}`;
  }
}
