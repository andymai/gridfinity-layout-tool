/**
 * Worker request message protocol types.
 *
 * The discriminated union sent from the main thread (GenerationBridge) to the
 * Web Worker (generation.worker.ts), plus every request payload it carries.
 */

import type {
  BinParams,
  ResolvedBaseplateParams,
  SplitConnectorConfig,
  MarginPiece,
  TextStyleDefaults,
  SlideConfig,
} from '@/shared/types/bin';
import type { GridfinityItem } from '@/shared/types/item';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import type { MeshImportRotation } from '@/shared/generation/meshAsset';

/** Geometry kernel backend for BREP operations */
export type KernelName = 'brepkit' | 'occt-wasm' | 'manifold';
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
  | ExportLabelFitSampleMessage
  | ExportSlideFitSampleMessage
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
  /**
   * Opt in to swappable label-plate preview meshes. Off by default because
   * `GENERATE` also serves the layout planner's linked-design meshes and
   * background thumbnail regeneration, neither of which renders plates — and
   * the former persists whatever it receives into the cross-session mesh cache.
   */
  readonly withLabelPlates?: boolean;
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
  /** Hardware icon rendered beside the text. */
  readonly icon?: LabelPlateIconId;
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

/**
 * Export the label-socket fit-calibration card (#2666): 1U-socket coupons
 * across a fit-offset ladder plus one nominal reference plate. The card is
 * fully standard-defined, so the payload carries nothing beyond the format.
 * Reuses the BASEPLATE_EXPORT_RESULT response shape.
 */
/**
 * Export the sliding-tray fit-calibration card: a clearance ladder of rail
 * stubs plus one tray stub that runs in all of them. The card's own sizes are
 * standard-defined, but the rail PROFILE follows the design's slide config, so
 * the coupon tests the same shelf the bin would carry.
 * Reuses the BASEPLATE_EXPORT_RESULT response shape.
 */
export interface ExportSlideFitSampleMessage {
  readonly type: 'EXPORT_SLIDE_FIT_SAMPLE';
  readonly payload: ExportSlideFitSamplePayload;
}

export interface ExportSlideFitSamplePayload {
  readonly requestId: string;
  readonly format: ExportFormat;
  readonly slide: SlideConfig;
}

export interface ExportLabelFitSampleMessage {
  readonly type: 'EXPORT_LABEL_FIT_SAMPLE';
  readonly payload: ExportLabelFitSamplePayload;
}

export interface ExportLabelFitSamplePayload {
  readonly requestId: string;
  readonly format: ExportFormat;
  /** Live print nozzle (mm) so coupons scale like the sockets they calibrate. */
  readonly nozzleSizeMm?: number;
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
