/**
 * Worker message protocol types.
 *
 * Defines the discriminated union messages exchanged between the main thread
 * (GenerationBridge) and the Web Worker (generation.worker.ts).
 */

import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';

/** Geometry kernel backend for BREP operations */
export type KernelName = 'opencascade' | 'brepkit' | 'occt-wasm';
export type WorkerMessage =
  | InitMessage
  | GenerateMessage
  | GenerateBaseplateMessage
  | GenerateSplitPreviewMessage
  | GenerateSplitPreviewRangeMessage
  | CancelMessage
  | CleanupMessage
  | ExportMessage
  | ExportBaseplateMessage
  | ExportDividersMessage
  | ExportCombinedMessage
  | ExportSplitMessage
  | ExportSplitRangeMessage;

export interface InitMessage {
  readonly type: 'INIT';
  readonly kernel?: KernelName;
}

export interface GenerateMessage {
  readonly type: 'GENERATE';
  readonly payload: GeneratePayload;
}

export interface CancelMessage {
  readonly type: 'CANCEL';
  readonly requestId: string;
}

/** Request pre-termination disposal of all WASM shape caches. */
export interface CleanupMessage {
  readonly type: 'CLEANUP';
}

export interface GeneratePayload {
  readonly params: BinParams;
  readonly requestId: string;
}

export interface GenerateBaseplateMessage {
  readonly type: 'GENERATE_BASEPLATE';
  readonly payload: GenerateBaseplatePayload;
}

export interface GenerateBaseplatePayload {
  readonly params: BaseplateParams;
  readonly requestId: string;
}

export interface ExportBaseplateMessage {
  readonly type: 'EXPORT_BASEPLATE';
  readonly payload: ExportBaseplatePayload;
}

export interface ExportBaseplatePayload {
  readonly params: BaseplateParams;
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly tolerance?: number;
  readonly angularTolerance?: number;
}

export interface ExportMessage {
  readonly type: 'EXPORT';
  readonly payload: ExportPayload;
}

export interface ExportPayload {
  readonly params: BinParams;
  readonly requestId: string;
  readonly format: ExportFormat;
  /** STL tessellation tolerance in mm (lower = smoother, default 0.01) */
  readonly tolerance?: number;
  /** STL angular tolerance in degrees (default 5) */
  readonly angularTolerance?: number;
}

export interface ExportDividersMessage {
  readonly type: 'EXPORT_DIVIDERS';
  readonly payload: ExportDividersPayload;
}

export interface ExportDividersPayload {
  readonly params: BinParams;
  readonly requestId: string;
}

export interface ExportCombinedMessage {
  readonly type: 'EXPORT_COMBINED';
  readonly payload: ExportCombinedPayload;
}

export interface ExportCombinedPayload {
  readonly params: BinParams;
  readonly requestId: string;
  readonly format: ExportFormat;
  /** STL tessellation tolerance in mm (lower = smoother, default 0.01) */
  readonly tolerance?: number;
  /** STL angular tolerance in degrees (default 5) */
  readonly angularTolerance?: number;
}

export interface GenerateSplitPreviewMessage {
  readonly type: 'GENERATE_SPLIT_PREVIEW';
  readonly payload: GenerateSplitPreviewPayload;
}

export interface GenerateSplitPreviewPayload {
  readonly params: BinParams;
  readonly requestId: string;
  /** Cut plane positions along X axis in mm, relative to bin center */
  readonly cutPlanesX: readonly number[];
  /** Cut plane positions along Y axis in mm, relative to bin center */
  readonly cutPlanesY: readonly number[];
  /** Alignment connector config for split pieces. Omit to skip connectors. */
  readonly splitConnectorConfig?: SplitConnectorConfig;
}

export interface ExportSplitMessage {
  readonly type: 'EXPORT_SPLIT';
  readonly payload: ExportSplitPayload;
}

export interface ExportSplitPayload {
  readonly params: BinParams;
  readonly requestId: string;
  /** Cut plane positions along X axis in mm, relative to bin center */
  readonly cutPlanesX: readonly number[];
  /** Cut plane positions along Y axis in mm, relative to bin center */
  readonly cutPlanesY: readonly number[];
  /** STL tessellation tolerance in mm (default 0.01) */
  readonly tolerance?: number;
  /** STL angular tolerance in degrees (default 5) */
  readonly angularTolerance?: number;
  /** Alignment connector config for split pieces. Omit to skip connectors. */
  readonly splitConnectorConfig?: SplitConnectorConfig;
}

export interface GenerateSplitPreviewRangeMessage {
  readonly type: 'GENERATE_SPLIT_PREVIEW_RANGE';
  readonly payload: GenerateSplitPreviewRangePayload;
}

export interface GenerateSplitPreviewRangePayload {
  readonly params: BinParams;
  readonly requestId: string;
  readonly cutPlanesX: readonly number[];
  readonly cutPlanesY: readonly number[];
  readonly splitConnectorConfig?: SplitConnectorConfig;
  /** Indices into the flat piece array (col-major) to process on this worker */
  readonly pieceIndices: readonly number[];
}

export interface ExportSplitRangeMessage {
  readonly type: 'EXPORT_SPLIT_RANGE';
  readonly payload: ExportSplitRangePayload;
}

export interface ExportSplitRangePayload {
  readonly params: BinParams;
  readonly requestId: string;
  readonly cutPlanesX: readonly number[];
  readonly cutPlanesY: readonly number[];
  readonly tolerance?: number;
  readonly angularTolerance?: number;
  readonly splitConnectorConfig?: SplitConnectorConfig;
  /** Indices into the flat piece array (col-major) to process on this worker */
  readonly pieceIndices: readonly number[];
}

/** Export file formats supported by the BREP worker */
export type ExportFormat = 'stl' | 'step';

/** Coarse LOD mesh data for distance-based rendering (preview only). */
export interface CoarseLODData {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
}

/** Per-face-group feature tag for provenance-based coloring. */
export interface FaceGroupData {
  /** Starting index offset into the triangles/indices array. */
  readonly start: number;
  /** Number of indices in this group. */
  readonly count: number;
  /** FeatureTag identifying the modeling step that created these faces. */
  readonly tag: number;
}
export type WorkerResponse =
  | InitReadyResponse
  | ProgressResponse
  | MeshResultResponse
  | SplitPreviewResultResponse
  | BaseplateExportResultResponse
  | ExportResultResponse
  | DividersExportResultResponse
  | CombinedExportResultResponse
  | SplitExportResultResponse
  | CacheStatsResponse
  | KernelPerfStatsResponse
  | BooleanFallbackStatsResponse
  | CleanupDoneResponse
  | ErrorResponse;

/** Per-cache statistics snapshot from the worker. */
export interface WorkerCacheStats {
  readonly name: string;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
  readonly maxSize: number;
}

/** Aggregated cache stats posted after each generation. */
export interface CacheStatsResponse {
  readonly type: 'CACHE_STATS';
  readonly requestId: string;
  readonly caches: readonly WorkerCacheStats[];
}

export interface CleanupDoneResponse {
  readonly type: 'CLEANUP_DONE';
}

/** Per-category kernel performance timing from brepjs. */
export interface KernelPerfCategory {
  readonly totalMs: number;
  readonly count: number;
}

/** Kernel performance stats posted after each generation. */
export interface KernelPerfStatsResponse {
  readonly type: 'KERNEL_PERF_STATS';
  readonly requestId: string;
  readonly stats: Readonly<Record<string, KernelPerfCategory>>;
}

/**
 * Boolean fallback occurrence — one record per boolean op where bisect
 * recovery kicked in (`batchAttempts > 1` or `singletonFallbacks > 0`).
 * `failedInputCount` over `totalInputs` separates concentrated failures
 * (1-2 bad tools — bisect wins) from structural failures (all tools fail —
 * bisect bottoms out at pairwise).
 */
export interface BooleanFallbackEntry {
  readonly category: 'fuse' | 'cut' | 'pattern_cut';
  readonly totalInputs: number;
  readonly batchAttempts: number;
  readonly batchSucceeded: number;
  readonly singletonFallbacks: number;
  readonly failedInputCount: number;
}

/**
 * Boolean fallback stats posted after a generation if (and only if) at least
 * one bisect-recovery event fired in the boolean stage. The worker omits this
 * response on the common no-recovery path to keep worker/main chatter minimal.
 */
export interface BooleanFallbackStatsResponse {
  readonly type: 'BOOLEAN_FALLBACK_STATS';
  readonly requestId: string;
  readonly records: readonly BooleanFallbackEntry[];
}

export interface InitReadyResponse {
  readonly type: 'INIT_READY';
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
  /** Which geometry kernel was loaded */
  readonly kernel: KernelName;
}

export interface ProgressResponse {
  readonly type: 'PROGRESS';
  readonly requestId: string;
  readonly stage: GenerationStage;
  readonly progress: number; // 0-1
}

export interface MeshResultResponse {
  readonly type: 'MESH_RESULT';
  readonly requestId: string;
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly timingMs: number;
  /** Optional per-face feature groups for provenance-based coloring. */
  readonly faceGroups?: readonly FaceGroupData[];
  /** Coarse LOD mesh for distance-based rendering (preview only) */
  readonly coarseLOD?: CoarseLODData;
  /** Click-lock lid mesh — present only when `params.lid.enabled` is true. */
  readonly lidVertices?: Float32Array;
  readonly lidNormals?: Float32Array;
  readonly lidIndices?: Uint32Array;
  readonly lidEdgeVertices?: Float32Array;
  readonly lidTriangleCount?: number;
  readonly lidFaceGroups?: readonly FaceGroupData[];
}

export interface ExportResultResponse {
  readonly type: 'EXPORT_RESULT';
  readonly requestId: string;
  readonly data: ArrayBuffer;
  readonly format: ExportFormat;
  readonly fileName: string;
  /** Face groups for provenance coloring (reserved for future use). */
  readonly faceGroups?: readonly FaceGroupData[];
}

export interface BaseplateExportResultResponse {
  readonly type: 'BASEPLATE_EXPORT_RESULT';
  readonly requestId: string;
  readonly data: ArrayBuffer;
  readonly format: ExportFormat;
  readonly fileName: string;
}

export interface DividersExportResultResponse {
  readonly type: 'DIVIDERS_EXPORT_RESULT';
  readonly requestId: string;
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/** A single piece from a combined bin + divider export */
export interface CombinedExportPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

export interface CombinedExportResultResponse {
  readonly type: 'COMBINED_EXPORT_RESULT';
  readonly requestId: string;
  readonly pieces: readonly CombinedExportPiece[];
  readonly format: ExportFormat;
  /** Face groups for the bin piece (provenance coloring). */
  readonly faceGroups?: readonly FaceGroupData[];
}

/** A single piece from a split export */
export interface SplitExportPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
  readonly col: number;
  readonly row: number;
}

export interface SplitExportResultResponse {
  readonly type: 'SPLIT_EXPORT_RESULT';
  readonly requestId: string;
  readonly pieces: readonly SplitExportPiece[];
}

/** A single piece from a split preview (mesh data for Three.js rendering) */
export interface SplitPreviewPiece {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly label: string;
  readonly col: number;
  readonly row: number;
  /** Piece width in grid units */
  readonly widthUnits: number;
  /** Piece depth in grid units */
  readonly depthUnits: number;
  /** Piece X offset in grid units from bin origin (left edge) */
  readonly offsetX: number;
  /** Piece Y offset in grid units from bin origin (bottom edge) */
  readonly offsetY: number;
}

export interface SplitPreviewResultResponse {
  readonly type: 'SPLIT_PREVIEW_RESULT';
  readonly requestId: string;
  readonly pieces: readonly SplitPreviewPiece[];
}

/**
 * Coarse classification of export-side worker failures, used by the resilience
 * wrapper to decide whether to retry. Classification happens in the worker via
 * message-pattern matching on the thrown error — see `classifyExportError` in
 * `exportHandler.ts`. Codes intentionally collapse to a small set so retry
 * policy stays simple; richer telemetry comes from `error_message`/`error_stack`.
 */
export type ExportErrorCode =
  | 'BREP_BOOLEAN_FAILED'
  | 'MESH_TESSELLATION_FAILED'
  | 'INVALID_PARAMS'
  | 'EMPTY_GEOMETRY'
  | 'OUT_OF_MEMORY'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ErrorResponse {
  readonly type: 'ERROR';
  readonly requestId: string;
  readonly error: string;
  /** Optional taxonomy code attached by export handlers; absent for generic errors. */
  readonly errorCode?: ExportErrorCode;
}
/** Stages of geometry generation for progress reporting */
export type GenerationStage = 'base' | 'shell' | 'features' | 'merge' | 'splitting';

/** Result of mesh generation (used by generators and bridge) */
export interface MeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly faceGroups?: readonly FaceGroupData[];
  /** Coarse LOD mesh for distance-based rendering (preview only, omitted for export) */
  readonly coarseLOD?: CoarseLODData;
  /** Optional click-lock lid mesh — separate solid that pairs with the bin. */
  readonly lidMesh?: LidMeshData;
}

/** Mesh data for the click-lock lid (companion piece, separate solid). */
export interface LidMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  /** Per-face provenance for rail vs body rendering. */
  readonly faceGroups?: readonly FaceGroupData[];
}
