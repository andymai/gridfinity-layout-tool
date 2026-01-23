/**
 * Worker message protocol types.
 *
 * Defines the discriminated union messages exchanged between the main thread
 * (GenerationBridge) and the Web Worker (generation.worker.ts).
 */

import type { BinParams } from '@/features/bin-designer/types';

// ─── Main → Worker Messages ──────────────────────────────────────────────────

export type WorkerMessage = InitMessage | GenerateMessage | CancelMessage;

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

// ─── Worker → Main Responses ─────────────────────────────────────────────────

export type WorkerResponse =
  | InitReadyResponse
  | ProgressResponse
  | MeshResultResponse
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
