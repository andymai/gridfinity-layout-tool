/**
 * Main-thread bridge to the generation Web Worker.
 *
 * Manages worker lifecycle, debounces rapid parameter changes, and supports
 * request cancellation via AbortController pattern.
 */

import type { BinParams } from '@/features/bin-designer/types';
import type {
  WorkerMessage,
  WorkerResponse,
  MeshData,
  GenerationStage,
} from './types';

/** Debounce delay before sending a generation request (ms) */
const DEBOUNCE_MS = 200;

/** Callback for progress updates during generation */
export type ProgressCallback = (stage: GenerationStage, progress: number) => void;

/** Result from a successful generation */
export interface GenerationResult {
  readonly mesh: MeshData;
  readonly timingMs: number;
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
        this.worker = new Worker(
          new URL('../worker/generation.worker.ts', import.meta.url),
          { type: 'module' }
        );

        const onInitMessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === 'INIT_READY') {
            this.worker?.removeEventListener('message', onInitMessage);
            this.setupMessageHandler();
            resolve();
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
   * Debounces calls by 200ms. Cancels any in-flight request.
   * Returns the generated mesh data and timing information.
   */
  generate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
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

      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.sendGenerateMessage(params);
      }, DEBOUNCE_MS);
    });
  }

  /**
   * Generate immediately without debounce.
   * Useful for initial generation or user-triggered regeneration.
   */
  generateImmediate(params: BinParams, onProgress?: ProgressCallback): Promise<GenerationResult> {
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
      this.sendGenerateMessage(params);
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

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.initPromise = null;
    this.onProgress = null;
  }

  /** Whether the bridge has been destroyed */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

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
            const resolve = this.pendingResolve;
            this.clearPending();
            resolve({
              mesh: {
                vertices: response.vertices,
                normals: response.normals,
                triangleCount: response.triangleCount,
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
          }
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
