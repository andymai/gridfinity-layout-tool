/**
 * Worker message protocol types.
 *
 * Defines the discriminated union messages exchanged between the main thread
 * (GenerationBridge) and the Web Worker (generation.worker.ts).
 */

import type { BinParams } from '@/shared/types/bin';

// ─── Main → Worker Messages ──────────────────────────────────────────────────

export type WorkerMessage =
  | InitMessage
  | GenerateMessage
  | CancelMessage
  | ExportMessage
  | ExportDividersMessage
  | ExportSplitMessage;

export interface InitMessage {
  readonly type: 'INIT';
}

export interface GenerateMessage {
  readonly type: 'GENERATE';
  readonly payload: GeneratePayload;
}

export interface CancelMessage {
  readonly type: 'CANCEL';
  readonly requestId: string;
}

export interface GeneratePayload {
  readonly params: BinParams;
  readonly requestId: string;
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
}

/** Export file formats supported by the BREP worker */
export type ExportFormat = 'stl' | 'step';

/** Per-face-group feature tag for provenance-based coloring. */
export interface FaceGroupData {
  /** Starting index offset into the triangles/indices array. */
  readonly start: number;
  /** Number of indices in this group. */
  readonly count: number;
  /** FeatureTag identifying the modeling step that created these faces. */
  readonly tag: number;
}

// ─── Worker → Main Responses ─────────────────────────────────────────────────

export type WorkerResponse =
  | InitReadyResponse
  | ProgressResponse
  | MeshResultResponse
  | ExportResultResponse
  | DividersExportResultResponse
  | SplitExportResultResponse
  | ErrorResponse;

export interface InitReadyResponse {
  readonly type: 'INIT_READY';
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
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

export interface DividersExportResultResponse {
  readonly type: 'DIVIDERS_EXPORT_RESULT';
  readonly requestId: string;
  readonly data: ArrayBuffer;
  readonly fileName: string;
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

export interface ErrorResponse {
  readonly type: 'ERROR';
  readonly requestId: string;
  readonly error: string;
}

// ─── Shared Types ────────────────────────────────────────────────────────────

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
}
