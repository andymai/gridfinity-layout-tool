/**
 * Main-thread bridge to the generation Web Worker.
 *
 * Manages worker lifecycle, debounces rapid parameter changes, and supports
 * request cancellation via AbortController pattern.
 */

import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';
import type {
  WorkerMessage,
  WorkerResponse,
  MeshData,
  GenerationStage,
  ExportFormat,
  SplitExportPiece,
  SplitPreviewPiece,
  FaceGroupData,
} from './types';
import { AdaptiveDebounce } from './adaptiveDebounce';

/** Extract threading info from INIT_READY with defensive validation. */
function extractThreadingInfo(data: {
  isThreaded: boolean;
  hardwareConcurrency: number;
}): ThreadingInfo {
  const isThreaded = typeof data.isThreaded === 'boolean' ? data.isThreaded : false;
  const hardwareConcurrency =
    Number.isFinite(data.hardwareConcurrency) && data.hardwareConcurrency > 0
      ? data.hardwareConcurrency
      : 4;
  return { isThreaded, hardwareConcurrency };
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

/** Information about the WASM threading capabilities */
export interface ThreadingInfo {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
}

/** Keys for the pending export request slots */
type ExportSlot = 'export' | 'dividers' | 'split' | 'splitPreview';

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
export class GenerationBridge {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private currentRequestId: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolve: ((result: GenerationResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private onProgress: ProgressCallback | null = null;
  private requestCounter = 0;
  private destroyed = false;
  private adaptiveDebounce = new AdaptiveDebounce();
  private threadingInfo: ThreadingInfo | null = null;

  /** Pending export requests keyed by slot. Only one per slot at a time. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Values are PendingExport<T> with different T per slot; type safety is enforced at each call site
  private pendingExports = new Map<ExportSlot, PendingExport<any>>();

  /**
   * Initialize the worker. Resolves when the worker signals INIT_READY.
   * Safe to call multiple times (returns cached promise).
   */
  init(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(new URL('../worker/generation.worker.ts', import.meta.url), {
          type: 'module',
        });

        const onInitMessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === 'INIT_READY') {
            this.worker?.removeEventListener('message', onInitMessage);
            this.threadingInfo = extractThreadingInfo(event.data);
            this.setupMessageHandler();
            resolve();
          } else if (event.data.type === 'ERROR') {
            this.worker?.removeEventListener('message', onInitMessage);
            reject(new Error(event.data.error));
          }
        };

        this.worker.addEventListener('message', onInitMessage);
        this.worker.addEventListener('error', (e) => {
          reject(new Error(`Worker failed to initialize: ${e.message}`));
        });

        this.postMessage({ type: 'INIT' });
      } catch (e) {
        reject(new Error(`Failed to create worker: ${e instanceof Error ? e.message : String(e)}`));
      }
    });

    return this.initPromise;
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
          this.sendGenerateMessage(params);
        }, this.adaptiveDebounce.getDelay());
      } else {
        this.sendGenerateMessage(params);
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
      this.worker.terminate();
      this.worker = null;
    }

    this.initPromise = null;
    this.onProgress = null;
    this.adaptiveDebounce.reset();
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
   * Generate baseplate mesh from baseplate parameters.
   * Uses the same debounce and cancellation as bin generation.
   */
  generateBaseplate(
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
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

      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        const requestId = this.nextRequestId();
        this.currentRequestId = requestId;
        this.postMessage({
          type: 'GENERATE_BASEPLATE',
          payload: { params, requestId },
        });
      }, this.adaptiveDebounce.getDelay());
    });
  }

  /**
   * Generate baseplate mesh immediately without debounce.
   * Used by the worker pool for parallel split piece generation.
   */
  generateBaseplateImmediate(
    params: BaseplateParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
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

      const requestId = this.nextRequestId();
      this.currentRequestId = requestId;
      this.postMessage({
        type: 'GENERATE_BASEPLATE',
        payload: { params, requestId },
      });
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

  // ─── Private ────────────────────────────────────────────────────────────────

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

  private sendGenerateMessage(params: BinParams): void {
    const requestId = this.nextRequestId();
    this.currentRequestId = requestId;

    this.postMessage({
      type: 'GENERATE',
      payload: { params, requestId },
    });
  }

  private setupMessageHandler(): void {
    if (!this.worker) return;

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
            this.clearPending();
            resolve({
              mesh: {
                vertices: response.vertices,
                normals: response.normals,
                indices: response.indices,
                edgeVertices: response.edgeVertices,
                triangleCount: response.triangleCount,
                faceGroups: response.faceGroups,
              },
              timingMs: response.timingMs,
            });
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

        case 'INIT_READY':
          // Already handled during init
          break;
      }
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

  private clearPending(): void {
    this.pendingResolve = null;
    this.pendingReject = null;
    this.currentRequestId = null;
    this.onProgress = null;
  }

  private postMessage(message: WorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private nextRequestId(): string {
    return `gen_${++this.requestCounter}_${Date.now()}`;
  }
}
