/**
 * Public type surface for `GenerationBridge` — extracted so the bridge file
 * itself stays focused on the worker-lifecycle state machine.
 */

import type {
  WorkerCacheStats,
  MeshData,
  GenerationStage,
  ExportFormat,
  ExportErrorCode,
  SplitExportPiece,
  SplitPreviewPiece,
  CombinedExportPiece,
  FaceGroupData,
  KernelName,
  KernelPerfCategory,
  BooleanFallbackEntry,
} from './types';

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

/** Payload for boolean fallback stats callback */
export interface BooleanFallbackStatsPayload {
  readonly records: readonly BooleanFallbackEntry[];
}

/** Callback for boolean fallback stats reporting */
export type BooleanFallbackStatsCallback = (payload: BooleanFallbackStatsPayload) => void;

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
export interface DedupCache {
  fingerprint: string | null;
  result: GenerationResult | null;
  /** Fingerprint of the currently in-flight request (stored so we can cache on success). */
  pendingFingerprint: string | null;
}

/** Keys for the pending export request slots */
export type ExportSlot = 'export' | 'dividers' | 'combined' | 'split' | 'splitPreview';

/** A pending export request: resolve/reject callbacks + request ID + timeout timer */
export interface PendingExport<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly requestId: string;
  /**
   * Timeout handle that cancels the export and rejects the promise if the
   * worker becomes unresponsive. Cleared whenever the request resolves,
   * rejects, or the bridge is torn down.
   */
  timer: ReturnType<typeof setTimeout> | null;
}

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
