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

import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { WorkerMessage, WorkerResponse, WorkerCacheStats, ExportFormat } from './types';
import { AdaptiveDebounce } from './adaptiveDebounce';
import {
  generateBin as generateBinImpl,
  generateBaseplate as generateBaseplateImpl,
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
} from './bridgeTypes';
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
} from './bridgeTypes';
export { ExportTimeoutError } from './bridgeTypes';

export class GenerationBridge {
  private readonly kernel: KernelName;
  worker: Worker | null = null;
  initPromise: Promise<void> | null = null;
  currentRequestId: string | null = null;
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

  /** Optional callback for cache performance stats (called after each generation). */
  onCacheStats: CacheStatsCallback | null = null;

  /** Optional callback for kernel performance stats (called after each generation). */
  onKernelPerfStats: KernelPerfStatsCallback | null = null;

  /** Optional callback for boolean fallback stats (called after each generation that had ≥1 fallback). */
  onBooleanFallbackStats: BooleanFallbackStatsCallback | null = null;

  /** Pending export requests keyed by slot. Only one per slot at a time. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Values are PendingExport<T> with different T per slot; type safety is enforced at each call site
  readonly pendingExports = new Map<ExportSlot, PendingExport<any>>();

  constructor(kernel: KernelName = 'opencascade') {
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

    for (const pending of this.pendingExports.values()) {
      this.clearExportTimer(pending);
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

  // ── Export methods (delegate to bridgeExports) ────────────────────

  exportBin(
    params: BinParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<ExportResult> {
    return exportBinImpl(this, params, format, options);
  }

  exportDividers(params: BinParams): Promise<DividersExportResult> {
    return exportDividersImpl(this, params);
  }

  exportCombined(
    params: BinParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
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
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return generateBaseplateImpl(this, params, onProgress, true);
  }

  /** Used by the worker pool for parallel split piece generation. */
  generateBaseplateImmediate(
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    return generateBaseplateImpl(this, params, onProgress, false);
  }

  exportBaseplate(
    params: BaseplateParams,
    format: ExportFormat,
    options?: { tolerance?: number; angularTolerance?: number }
  ): Promise<BaseplateExportResult> {
    return exportBaseplateImpl(this, params, format, options);
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
   * Start a timeout that cancels an in-flight export if the worker doesn't
   * respond. On fire, sends `CANCEL`, removes the pending entry, and rejects
   * with an `ExportTimeoutError`.
   */
  startExportTimeout(slot: ExportSlot, requestId: string, timeoutMs: number): void {
    const pending = this.pendingExports.get(slot);
    if (!pending) return;
    pending.timer = setTimeout(() => {
      const current = this.pendingExports.get(slot);
      if (!current || current.requestId !== requestId) return;
      this.pendingExports.delete(slot);
      current.timer = null;
      this.postMessage({ type: 'CANCEL', requestId });
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
