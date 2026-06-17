/// <reference types="node" />
/**
 * Shared WASM initialization for bin/baseplate generation scenario tests.
 *
 * Loads brepjs with the chosen kernel once per worker thread and caches the
 * result. Set the `BREPJS_KERNEL` environment variable to select the backend:
 *
 *   - `'occt-wasm'` (default) — the production OCCT kernel
 *   - `'brepkit'` / `'wasm'`  — the alternative Rust-native kernel
 *
 * Import `initBrepjs` in `beforeAll`, then use `getGenerateBin()`,
 * `getGenerateSplitPreview()`, or `getGenerateBaseplate()` inside tests.
 *
 * The triple-slash node reference is intentional: this file uses `process.env`
 * and gets imported by app-config-included scenario files. Without it, tsc
 * fails the app build because tsconfig.app.json doesn't include node types.
 */
import type { BaseplateParams, BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Kernel selection ────────────────────────────────────────────────────────

type KernelName = 'brepkit' | 'occt-wasm' | 'manifold';

type EnvKernelName = 'wasm' | 'brepkit' | 'occt-wasm' | 'manifold';

const ENV_TO_KERNEL: Partial<Record<string, KernelName>> = {
  wasm: 'brepkit',
  brepkit: 'brepkit',
  'occt-wasm': 'occt-wasm',
  manifold: 'manifold',
};

function resolveKernel(): KernelName {
  const env = process.env['BREPJS_KERNEL'];
  if (!env) return 'occt-wasm';
  const mapped = ENV_TO_KERNEL[env];
  if (mapped) return mapped;
  const valid: readonly EnvKernelName[] = ['wasm', 'brepkit', 'occt-wasm', 'manifold'];
  throw new Error(`Invalid BREPJS_KERNEL="${env}". Must be one of: ${valid.join(', ')}`);
}

const kernelName: KernelName = resolveKernel();

/** Returns the active kernel name (useful for baseline labeling). */
export function getKernelName(): KernelName {
  return kernelName;
}

// ─── Bin generation ──────────────────────────────────────────────────────────

export type GenerateBinFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

// ─── Baseplate generation ────────────────────────────────────────────────────

export type GenerateBaseplateFn = (
  params: BaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean,
  signal?: AbortSignal,
  draft?: boolean
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

// ─── Split export ───────────────────────────────────────────────────────────

// Re-use the canonical type from binGenerator
import type { SplitExportResult } from '@/features/generation/worker/generators/binGenerator';
export type { SplitExportResult };

export type ExportSplitBinFn = (
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  tolerance?: number,
  angularTolerance?: number,
  splitConnectorConfig?: SplitConnectorConfig
) => Promise<SplitExportResult>;

// ─── Cached instances ────────────────────────────────────────────────────────

let generateBin: GenerateBinFn | undefined;
let generateBaseplate: GenerateBaseplateFn | undefined;
let generateSplitPreview: GenerateSplitPreviewFn | undefined;
let exportSplitBinFn: ExportSplitBinFn | undefined;

// ─── Kernel-specific init ────────────────────────────────────────────────────
// Delegates to shared kernelInit.ts to avoid duplicating WASM loading logic.

import {
  initBrepkitKernel as initWasmKernel,
  initOcctWasmKernel,
  initManifoldKernel,
} from './kernelInit';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise brepjs with the selected kernel and cache generator functions.
 * Safe to call multiple times — only the first call does real work.
 */
export async function initBrepjs(): Promise<void> {
  if (generateBin && generateSplitPreview && generateBaseplate && exportSplitBinFn) return;

  if (kernelName === 'brepkit') {
    await initWasmKernel();
  } else if (kernelName === 'manifold') {
    await initManifoldKernel();
  } else {
    await initOcctWasmKernel();
  }

  const binMod = await import('@/features/generation/worker/generators/binGenerator');
  const baseplateMod = await import('@/features/generation/worker/generators/baseplateGenerator');

  // Only one kernel is registered per worker, so it becomes the brepjs default
  // (registerKernel sets the first-registered id as default). Generator calls
  // route to it without any `withKernel` wrapping — which is required here
  // anyway, since `exportSplitBin` is async and `withKernel` is synchronous-only.
  generateBin = binMod.generateBin;
  generateSplitPreview = binMod.generateSplitPreview;
  exportSplitBinFn = binMod.exportSplitBin;
  generateBaseplate = baseplateMod.generateBaseplate;
}

/** Returns the cached `generateBin` function. Throws if `initBrepjs()` was not called. */
export function getGenerateBin(): GenerateBinFn {
  if (!generateBin) throw new Error('Call initBrepjs() in beforeAll first');
  return generateBin;
}

/** Returns the cached `generateBaseplate` function. Throws if `initBrepjs()` was not called. */
export function getGenerateBaseplate(): GenerateBaseplateFn {
  if (!generateBaseplate) throw new Error('Call initBrepjs() in beforeAll first');
  return generateBaseplate;
}

/** Returns the cached `generateSplitPreview` function. Throws if `initBrepjs()` was not called. */
export function getGenerateSplitPreview(): GenerateSplitPreviewFn {
  if (!generateSplitPreview) throw new Error('Call initBrepjs() in beforeAll first');
  return generateSplitPreview;
}

/** Returns the cached `exportSplitBin` function. Throws if `initBrepjs()` was not called. */
export function getExportSplitBin(): ExportSplitBinFn {
  if (!exportSplitBinFn) throw new Error('Call initBrepjs() in beforeAll first');
  return exportSplitBinFn;
}
