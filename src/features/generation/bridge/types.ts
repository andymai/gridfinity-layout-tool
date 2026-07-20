/**
 * Worker message protocol types.
 *
 * Defines the discriminated union messages exchanged between the main thread
 * (GenerationBridge) and the Web Worker (generation.worker.ts).
 */

import type {
  BinParams,
  ResolvedBaseplateParams,
  SplitConnectorConfig,
  MarginPiece,
  TextStyleDefaults,
} from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type {
  MeshAsset,
  MeshImportErrorReason,
  MeshImportRotation,
} from '@/shared/generation/meshAsset';

/** Geometry kernel backend for BREP operations */
export type KernelName = 'brepkit' | 'occt-wasm' | 'manifold';

/**
 * Skip the Manifold draft when the exact build is expected to finish faster
 * than this (ms, predicted from the previous exact generation). A draft that's
 * replaced within ~a second reads as flicker — two visual jumps for no real
 * feedback win — so fast generations (small/cache-warm) go straight to exact.
 * No history yet (cold start) counts as slow.
 */
export const FAST_EXACT_SKIP_MS = 1000;

/**
 * Edits arriving closer together than this are a scrub (slider drag, stepper
 * burst, key hold). The exact is debounced and won't land until the burst
 * settles, so the draft-vs-exact comparison changes: without a draft the
 * preview is dead for the whole scrub.
 */
export const EDIT_BURST_WINDOW_MS = 350;

/**
 * Draft-skip threshold while scrubbing — only skip the draft when the exact
 * is genuinely realtime-fast (can keep up with the edit rate); otherwise keep
 * drafting for continuous feedback.
 */
export const BURST_EXACT_SKIP_MS = 300;
export type WorkerMessage =
  | InitMessage
  | GenerateMessage
  | EstimateMessage
  | WarmMessage
  | GenerateBaseplateMessage
  | GenerateBaseplateMarginMessage
  | GenerateItemMessage
  | GenerateSplitPreviewMessage
  | GenerateSplitPreviewRangeMessage
  | CancelMessage
  | CleanupMessage
  | ExportMessage
  | ExportItemMessage
  | ExportBaseplateMessage
  | ExportBaseplateMarginMessage
  | ExportConnectorKeyMessage
  | ExportConnectorSampleMessage
  | ExportLabelPlatesMessage
  | ExportDividersMessage
  | ExportCombinedMessage
  | ExportSplitMessage
  | ExportSplitRangeMessage
  | ImportMeshMessage;

/**
 * Parse + normalize an uploaded STL into a compressed `MeshAsset` (mesh
 * imprint import). Runs on the raw manifold-3d module, so it works on any
 * kernel's worker without touching the active brepjs kernel.
 */
export interface ImportMeshMessage {
  readonly type: 'IMPORT_MESH';
  readonly payload: ImportMeshPayload;
}

export interface ImportMeshPayload {
  readonly requestId: string;
  /** Raw STL file contents (transferred, not copied). */
  readonly buffer: ArrayBuffer;
  readonly fileName: string;
  /** Per-axis rotation (degrees) applied after auto lay-flat. */
  readonly rotation?: MeshImportRotation;
}

export interface InitMessage {
  readonly type: 'INIT';
  readonly kernel?: KernelName;
}

export interface GenerateMessage {
  readonly type: 'GENERATE';
  readonly payload: GeneratePayload;
}

/**
 * Ask the worker to predict the cost of generating `params` from its cache
 * state + last observed stage timings — cheap (~ms), no geometry built.
 */
export interface EstimateMessage {
  readonly type: 'ESTIMATE';
  readonly payload: GeneratePayload;
}

/**
 * Speculative idle warm: build the export-quality (fused) shell so a subsequent
 * export skips the deferred socket↔body fuse. No mesh is returned.
 */
export interface WarmMessage {
  readonly type: 'WARM';
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
  readonly params: ResolvedBaseplateParams;
  readonly requestId: string;
}

/** Generate one detached margin rail (issue #2392). Params carry the full
 * plate context so the rail's over-tile pockets align with the body grid. */
export interface GenerateBaseplateMarginMessage {
  readonly type: 'GENERATE_BASEPLATE_MARGIN';
  readonly payload: GenerateBaseplateMarginPayload;
}

export interface GenerateBaseplateMarginPayload {
  readonly params: ResolvedBaseplateParams;
  readonly margin: MarginPiece;
  readonly requestId: string;
}

/**
 * Generic item generation. Carries a `GridfinityItem` (envelope + discriminated
 * structure); the worker resolves the generator by `structure.kind`. Adding a
 * future item type needs no new message — just a registered generator module.
 */
export interface GenerateItemMessage {
  readonly type: 'GENERATE_ITEM';
  readonly payload: GenerateItemPayload;
}

export interface GenerateItemPayload {
  readonly item: GridfinityItem;
  readonly requestId: string;
}

/** Generic item export. Reuses the BASEPLATE_EXPORT_RESULT response shape. */
export interface ExportItemMessage {
  readonly type: 'EXPORT_ITEM';
  readonly payload: ExportItemPayload;
}

export interface ExportItemPayload {
  readonly item: GridfinityItem;
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly tolerance?: number;
  readonly angularTolerance?: number;
}

export interface ExportBaseplateMessage {
  readonly type: 'EXPORT_BASEPLATE';
  readonly payload: ExportBaseplatePayload;
}

export interface ExportBaseplatePayload {
  readonly params: ResolvedBaseplateParams;
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly tolerance?: number;
  readonly angularTolerance?: number;
}

/**
 * Export the standalone dovetail key. Reuses the BASEPLATE_EXPORT_RESULT
 * response shape (data + format + fileName) since the payload is identical.
 */
export interface ExportConnectorKeyMessage {
  readonly type: 'EXPORT_CONNECTOR_KEY';
  readonly payload: ExportBaseplatePayload;
}

/**
 * Export one detached margin rail (issue #2392). Reuses the
 * BASEPLATE_EXPORT_RESULT response shape; the payload adds the rail to build.
 */
export interface ExportBaseplateMarginMessage {
  readonly type: 'EXPORT_BASEPLATE_MARGIN';
  readonly payload: ExportBaseplateMarginPayload;
}

export interface ExportBaseplateMarginPayload {
  readonly params: ResolvedBaseplateParams;
  readonly margin: MarginPiece;
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly tolerance?: number;
  readonly angularTolerance?: number;
}

/**
 * Export the connector fit-sample tray (a calibration card sweeping all three
 * connector styles across a fit-offset ladder). Reuses the BASEPLATE_EXPORT_RESULT
 * response shape (data + format + fileName) and the ExportBaseplatePayload.
 */
export interface ExportConnectorSampleMessage {
  readonly type: 'EXPORT_CONNECTOR_SAMPLE';
  readonly payload: ExportBaseplatePayload;
}

/** One swappable label plate to build (#2666): standard width + its text. */
export interface LabelPlateExportSpec {
  readonly widthU: 1 | 2 | 3;
  readonly text: string;
  /**
   * Plate center on the bed (mm). When absent the builder stacks plates in
   * a single centered column; the layout batch export passes packed sheet
   * positions instead.
   */
  readonly position?: readonly [number, number];
}

/**
 * Build options for label plates. `textDepthMm` arrives pre-snapped to a
 * whole layer-height multiple (the main thread owns print settings).
 */
export interface LabelPlateExportOptions {
  readonly textMode: 'emboss' | 'deboss';
  readonly textDepthMm: number;
  readonly textDefaults: TextStyleDefaults;
  readonly v1Channels: boolean;
}

/**
 * Export swappable label plates for a socket-mode design (#2666). Reuses the
 * BASEPLATE_EXPORT_RESULT response shape (data + format + fileName).
 */
export interface ExportLabelPlatesMessage {
  readonly type: 'EXPORT_LABEL_PLATES';
  readonly payload: ExportLabelPlatesPayload;
}

export interface ExportLabelPlatesPayload {
  readonly plates: readonly LabelPlateExportSpec[];
  readonly options: LabelPlateExportOptions;
  readonly requestId: string;
  readonly format: ExportFormat;
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
  | EstimateResultResponse
  | MeshResultResponse
  | SplitPreviewResultResponse
  | BaseplateExportResultResponse
  | ExportResultResponse
  | DividersExportResultResponse
  | CombinedExportResultResponse
  | SplitExportResultResponse
  | ImportMeshResultResponse
  | ImportMeshErrorResponse
  | CacheStatsResponse
  | KernelPerfStatsResponse
  | BooleanFallbackStatsResponse
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

/** Aggregated cache stats posted after each generation. */
export interface CacheStatsResponse {
  readonly type: 'CACHE_STATS';
  readonly requestId: string;
  readonly caches: readonly WorkerCacheStats[];
}

export interface CleanupDoneResponse {
  readonly type: 'CLEANUP_DONE';
}

export interface WarmDoneResponse {
  readonly type: 'WARM_DONE';
  readonly requestId: string;
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
  /** Seated snap-clip connector mesh — present only for split snap-clip plates. */
  readonly connectorKeyVertices?: Float32Array;
  readonly connectorKeyNormals?: Float32Array;
  readonly connectorKeyIndices?: Uint32Array;
  readonly connectorKeyTriangleCount?: number;
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
  /** Optional separate stack-grid baseplate mesh — the glue-on companion slab,
   *  present only when the lid uses `separateStackPlate`. */
  readonly stackPlateMesh?: StackPlateMeshData;
  /**
   * Optional seated snap-clip connector mesh — the exact relieved part the
   * baseplate ships, so the preview can render it instead of an approximation.
   * Present only for split snap-clip baseplates.
   */
  readonly connectorKeyMesh?: ConnectorKeyMeshData;
}

/**
 * Mesh data for the seated snap-clip connector (single accent-colored solid,
 * no edge lines or face groups). Built in the worker so the preview matches the
 * exported, socket-relieved part exactly.
 */
export interface ConnectorKeyMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
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

/**
 * Mesh data for the separate stack-grid baseplate (glue-on companion slab).
 * A single lid-colored zone — no face groups. Carries edge lines so the pocket
 * ring reads crisply in the preview.
 */
export interface StackPlateMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
}
