/**
 * Public type surface for `GenerationBridge` — extracted so the bridge file
 * itself stays focused on the worker-lifecycle state machine.
 */

import type {
  MeshData,
  GenerationStage,
  ExportFormat,
  ExportErrorCode,
  SplitExportPiece,
  FitTestExportPiece,
  SplitPreviewPiece,
  CombinedExportPiece,
  FaceGroupData,
  KernelName,
  PerfSnapshot,
} from './types';
import type { MeshAsset, MeshImportErrorReason } from '@/shared/generation/meshAsset';

/** Callback for progress updates during generation */
export type ProgressCallback = (stage: GenerationStage, progress: number) => void;

/** Result from a successful generation */
export interface GenerationResult {
  readonly mesh: MeshData;
  readonly timingMs: number;
  /** Optional fine-grained perf breakdown (present when worker emits one). */
  readonly perfSnapshot?: PerfSnapshot;
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

/**
 * Outcome of a mesh (STL) import. Import failures are expected user-input
 * conditions (broken mesh, wrong format), so they resolve as `ok: false`
 * rather than rejecting — rejection is reserved for worker-lifecycle
 * failures (destroyed/reset mid-request).
 */
export type MeshImportOutcome =
  | {
      readonly ok: true;
      readonly asset: MeshAsset;
      readonly positions: Float32Array;
      readonly indices: Uint32Array;
      readonly suggestedCutDepth: number;
      readonly volumeMm3: number;
    }
  | {
      readonly ok: false;
      readonly reason: MeshImportErrorReason;
      readonly message: string;
    };

/** Result from a combined bin + dividers export */
export interface CombinedExportResult {
  readonly pieces: readonly CombinedExportPiece[];
  readonly format: ExportFormat;
  readonly faceGroups?: readonly FaceGroupData[];
  /**
   * Face groups for the LID piece, when one was exported. Separate from
   * {@link faceGroups} because the lid is its own object with its own triangle
   * list — indices from one cannot address the other.
   */
  readonly lidFaceGroups?: readonly FaceGroupData[];
}

/** Result from a successful split export */
export interface SplitExportResult {
  readonly pieces: readonly SplitExportPiece[];
}

/** Result from a successful fit-test card export. */
export interface FitTestExportResult {
  readonly pieces: readonly FitTestExportPiece[];
  readonly fileName: string;
  /** Seams that had to cross an opening; the caller warns when non-zero. */
  readonly blockedSeams: number;
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
  /**
   * Face provenance for STL→3MF paint_color mapping. Only label plate
   * exports populate this today (two-color plates).
   */
  readonly faceGroups?: readonly FaceGroupData[];
}

/** Information about the WASM threading capabilities */
export interface ThreadingInfo {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
  /** Which geometry kernel was loaded */
  readonly kernel: KernelName;
}

/** Keys for the pending export request slots */
export type ExportSlot = 'export' | 'dividers' | 'combined' | 'split' | 'splitPreview' | 'fitTest';

/** A pending export request: resolve/reject callbacks + request ID + timeout timer */
export interface PendingExport<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly requestId: string;
  /** Optional 0–1 progress callback, invoked as the worker reports PROGRESS. */
  readonly onProgress?: (progress: number) => void;
  /**
   * Timeout handle that cancels the export and rejects the promise if the
   * worker becomes unresponsive. Cleared whenever the request resolves,
   * rejects, or the bridge is torn down.
   */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Pending export requests keyed by slot — at most one per slot at a time.
 * Each slot resolves a different result type, so the stored `PendingExport<T>`
 * is heterogeneous; per-slot type safety is enforced at each call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous T per slot; type safety enforced at each call site
export type PendingExportMap = Map<ExportSlot, PendingExport<any>>;

/**
 * Custom error thrown when an export request hits its timeout budget.
 * The error message also passes the `/timeout/` regex used by the worker
 * classifier so any downstream wrappers map it to {@link ExportErrorCode}
 * `TIMEOUT` consistently.
 */
export class ExportTimeoutError extends Error {
  readonly code: ExportErrorCode = 'TIMEOUT';
  constructor(message = 'Export timed out — the geometry engine became unresponsive.') {
    super(message);
    this.name = 'ExportTimeoutError';
  }
}

/**
 * Rejection built from a worker `ERROR` response. Carries the worker's
 * {@link ExportErrorCode} as `code`, the same field {@link ExportTimeoutError}
 * uses, so `getErrorCode()` reads both alike.
 */
export class WorkerRequestError extends Error {
  readonly code: ExportErrorCode | undefined;
  constructor(message: string, code?: ExportErrorCode) {
    super(message);
    this.name = 'WorkerRequestError';
    this.code = code;
  }
}
