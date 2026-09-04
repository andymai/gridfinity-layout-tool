/**
 * Worker response protocol types.
 *
 * The discriminated union posted from the Web Worker (generation.worker.ts)
 * back to the main thread (GenerationBridge), plus the mesh, perf, cache, and
 * export payloads those responses carry.
 */

import type { MeshAsset, MeshImportErrorReason } from '@/shared/generation/meshAsset';
import type { KernelName, ExportFormat } from './messages';
import type { LabelPlatesMeshData, LabelTextOverflow, TypeStemWarning } from './meshData';
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
  | EstimateResultResponse
  | MeshResultResponse
  | SplitPreviewResultResponse
  | BaseplateExportResultResponse
  | ExportResultResponse
  | DividersExportResultResponse
  | CombinedExportResultResponse
  | SplitExportResultResponse
  | FitTestExportResultResponse
  | ImportMeshResultResponse
  | ImportMeshErrorResponse
  | CleanupDoneResponse
  | WarmDoneResponse
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

export interface CleanupDoneResponse {
  readonly type: 'CLEANUP_DONE';
}

export interface WarmDoneResponse {
  readonly type: 'WARM_DONE';
  readonly requestId: string;
}

/**
 * Per-pipeline-stage timing entry. Captures shell, features, boolean,
 * translate, and tessellate stage durations.
 */
export interface PerfStageEntry {
  readonly name: string;
  readonly ms: number;
}

/**
 * Sub-step timing inside a stage — feature builder or wall pattern phase.
 * `count` carries an optional scalar (hex centers built, items processed)
 * useful for spotting "slow per-unit" vs "slow due to volume".
 */
export interface PerfSubstepEntry {
  readonly name: string;
  readonly ms: number;
  readonly count?: number;
}

/**
 * Snapshot of one generation's timing breakdown. Sent with MESH_RESULT
 * when the worker has timing instrumentation enabled. Used by the
 * dev-only PerfOverlay and (in the future) regression guards.
 */
export interface PerfSnapshot {
  readonly totalMs: number;
  readonly stages: readonly PerfStageEntry[];
  /** Per-feature-builder timings (compartment walls, inserts, etc.). */
  readonly featureBuilders: readonly PerfSubstepEntry[];
  /** Wall-pattern substep timings (base build vs cache hit, clip apply). */
  readonly wallPatternSubsteps: readonly PerfSubstepEntry[];
  /** Total hex centers built across all walls. */
  readonly hexCenterCount: number;
  /** Number of pattern compounds fed into the final pattern_cut pass. */
  readonly patternCutToolCount: number;
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

export interface EstimateResultResponse {
  readonly type: 'ESTIMATE_RESULT';
  readonly requestId: string;
  /** Predicted generation duration in ms; null when the worker can't tell (treat as slow). */
  readonly predictedMs: number | null;
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
  /** Separate stack-grid baseplate mesh — present only when the lid opts into
   *  `separateStackPlate`. All five fields land or are absent together. */
  readonly stackPlateVertices?: Float32Array;
  readonly stackPlateNormals?: Float32Array;
  readonly stackPlateIndices?: Uint32Array;
  readonly stackPlateEdgeVertices?: Float32Array;
  readonly stackPlateTriangleCount?: number;
  /** Sliding-tray mesh — the companion part that rides the bin's rail. All
   *  six fields land or are absent together. */
  readonly slideTrayVertices?: Float32Array;
  readonly slideTrayNormals?: Float32Array;
  readonly slideTrayIndices?: Uint32Array;
  readonly slideTrayEdgeVertices?: Float32Array;
  readonly slideTrayTriangleCount?: number;
  readonly slideTrayRestZ?: number;
  /** Seated snap-clip connector mesh — present only for split snap-clip plates. */
  readonly connectorKeyVertices?: Float32Array;
  readonly connectorKeyNormals?: Float32Array;
  readonly connectorKeyIndices?: Uint32Array;
  readonly connectorKeyTriangleCount?: number;
  /** Detachable feet, assembled under the bin — present only when it has them. */
  readonly detachableFeetVertices?: Float32Array;
  readonly detachableFeetNormals?: Float32Array;
  readonly detachableFeetIndices?: Uint32Array;
  readonly detachableFeetEdgeVertices?: Float32Array;
  readonly detachableFeetTriangleCount?: number;
  /** Knife-block handle rest — present only when the design's rest is a
   *  companion block. All five fields land or are absent together. */
  readonly knifeRestVertices?: Float32Array;
  readonly knifeRestNormals?: Float32Array;
  readonly knifeRestIndices?: Uint32Array;
  readonly knifeRestEdgeVertices?: Float32Array;
  readonly knifeRestTriangleCount?: number;
  /**
   * Swappable label plates with their seated poses (preview only). A set
   * rather than flat fields because the count varies with the design; the
   * fixed companions above stay flat for back-compat.
   */
  readonly labelPlates?: LabelPlatesMeshData;
  /** Captions the build dropped for want of room. See {@link LabelTextOverflow}. */
  readonly labelTextOverflow?: LabelTextOverflow[];
  /** See {@link TypeStemWarning}. */
  readonly typeStemWarning?: TypeStemWarning;
  /**
   * Fine-grained timing breakdown. The worker always emits one — overhead
   * is a handful of `performance.now()` calls — but the field is `?` so
   * older worker builds (e.g., a stale Service Worker payload on the first
   * request after deploy) deserialize cleanly.
   */
  readonly perfSnapshot?: PerfSnapshot;
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
  /** Present on label plate exports: STL→3MF paint_color mapping. */
  readonly faceGroups?: readonly FaceGroupData[];
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
  /** Face groups for the lid piece, so its own lip can be painted. */
  readonly lidFaceGroups?: readonly FaceGroupData[];
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

/** A single piece of a fit-test card. A whole card is one piece, label ''. */
export interface FitTestExportPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

export interface FitTestExportResultResponse {
  readonly type: 'FIT_TEST_EXPORT_RESULT';
  readonly requestId: string;
  readonly pieces: readonly FitTestExportPiece[];
  readonly fileName: string;
  /**
   * Seams the nudge could not move clear of an opening. Non-zero means a cut
   * runs through a cutout, which makes that hole unmeasurable — the caller has
   * to say so rather than hand over a card that looks fine.
   */
  readonly blockedSeams: number;
}

export interface ImportMeshResultResponse {
  readonly type: 'IMPORT_MESH_RESULT';
  readonly requestId: string;
  readonly asset: MeshAsset;
  /** Decimated, oriented preview mesh (transferred). */
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  /** Default pocket depth: the oriented mesh height (mm). */
  readonly suggestedCutDepth: number;
  /** Solid volume of the oriented manifold in mm³. */
  readonly volumeMm3: number;
}

export interface ImportMeshErrorResponse {
  readonly type: 'IMPORT_MESH_ERROR';
  readonly requestId: string;
  readonly reason: MeshImportErrorReason;
  readonly error: string;
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
  | 'KERNEL_CRASHED'
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
