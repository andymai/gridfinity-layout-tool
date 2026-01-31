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
  | ExportDividersMessage;

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

/** Export file formats supported by the BREP worker */
export type ExportFormat = 'stl' | 'step';

// ─── Worker → Main Responses ─────────────────────────────────────────────────

export type WorkerResponse =
  | InitReadyResponse
  | ProgressResponse
  | MeshResultResponse
  | ExportResultResponse
  | DividersExportResultResponse
  | ErrorResponse;

export interface InitReadyResponse {
  readonly type: 'INIT_READY';
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
  readonly triangleCount: number;
  readonly timingMs: number;
}

export interface ExportResultResponse {
  readonly type: 'EXPORT_RESULT';
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

export interface ErrorResponse {
  readonly type: 'ERROR';
  readonly requestId: string;
  readonly error: string;
}

// ─── Shared Types ────────────────────────────────────────────────────────────

/** Stages of geometry generation for progress reporting */
export type GenerationStage = 'base' | 'shell' | 'features' | 'merge';

/** Result of mesh generation (used by generators and bridge) */
export interface MeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly triangleCount: number;
}
