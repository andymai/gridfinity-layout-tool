/**
 * Shared WASM initialization for bin generation scenario tests.
 *
 * Loads brepjs + OpenCASCADE once per worker thread and caches the result.
 * Import `initBrepjs` in `beforeAll`, then use `getGenerateBin()` or
 * `getGenerateSplitPreview()` inside tests.
 */
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Bin generation ──────────────────────────────────────────────────────────

export type GenerateBinFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

// ─── Split preview ───────────────────────────────────────────────────────────

export interface SplitPreviewPiece {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly label: string;
  readonly col: number;
  readonly row: number;
  readonly widthUnits: number;
  readonly depthUnits: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface SplitPreviewResult {
  readonly pieces: readonly SplitPreviewPiece[];
}

export type GenerateSplitPreviewFn = (
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
) => SplitPreviewResult;

// ─── Cached instances ────────────────────────────────────────────────────────

let generateBin: GenerateBinFn | undefined;
let generateSplitPreview: GenerateSplitPreviewFn | undefined;

/**
 * Initialise brepjs/OpenCASCADE and cache the `generateBin` function.
 * Safe to call multiple times — only the first call does real work.
 */
export async function initBrepjs(): Promise<void> {
  if (generateBin && generateSplitPreview) return;

  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await (opencascade as (opts?: Record<string, unknown>) => Promise<unknown>)({
    wasmBinary,
  });
  initFromOC(OC);

  const mod = await import('@/features/generation/worker/generators/binGenerator');
  generateBin = mod.generateBin as GenerateBinFn;
  generateSplitPreview = mod.generateSplitPreview as GenerateSplitPreviewFn;
}

/** Returns the cached `generateBin` function. Throws if `initBrepjs()` was not called. */
export function getGenerateBin(): GenerateBinFn {
  if (!generateBin) throw new Error('Call initBrepjs() in beforeAll first');
  return generateBin;
}

/** Returns the cached `generateSplitPreview` function. Throws if `initBrepjs()` was not called. */
export function getGenerateSplitPreview(): GenerateSplitPreviewFn {
  if (!generateSplitPreview) throw new Error('Call initBrepjs() in beforeAll first');
  return generateSplitPreview;
}
