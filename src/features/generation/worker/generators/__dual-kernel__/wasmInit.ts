/**
 * Shared WASM initialization for bin/baseplate generation scenario tests.
 *
 * Loads brepjs with the chosen kernel once per worker thread and caches the
 * result. Set the `BREPJS_KERNEL` environment variable to select the backend:
 *
 *   - `'opencascade'` (default) — uses `initFromOC` with brepjs-opencascade
 *   - `'wasm'`                  — uses `initFromWasm` with brepjs-wasm
 *
 * Import `initBrepjs` in `beforeAll`, then use `getGenerateBin()`,
 * `getGenerateSplitPreview()`, or `getGenerateBaseplate()` inside tests.
 */
import type { BaseplateParams, BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Kernel selection ────────────────────────────────────────────────────────

type KernelName = 'opencascade' | 'brepkit';

type EnvKernelName = 'opencascade' | 'wasm' | 'brepkit';

const ENV_TO_KERNEL: Partial<Record<string, KernelName>> = {
  opencascade: 'opencascade',
  wasm: 'brepkit',
  brepkit: 'brepkit',
};

function resolveKernel(): KernelName {
  const env = process.env['BREPJS_KERNEL'];
  if (!env) return 'opencascade';
  const mapped = ENV_TO_KERNEL[env];
  if (mapped) return mapped;
  const valid: readonly EnvKernelName[] = ['opencascade', 'wasm', 'brepkit'];
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
  signal?: AbortSignal
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
let generateBaseplate: GenerateBaseplateFn | undefined;
let generateSplitPreview: GenerateSplitPreviewFn | undefined;

// ─── Kernel-specific init ────────────────────────────────────────────────────
// Delegates to shared kernelInit.ts to avoid duplicating WASM loading logic.

import {
  initOcctKernel as initOpenCascadeKernel,
  initBrepkitKernel as initWasmKernel,
} from './kernelInit';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise brepjs with the selected kernel and cache generator functions.
 * Safe to call multiple times — only the first call does real work.
 */
export async function initBrepjs(): Promise<void> {
  if (generateBin && generateSplitPreview && generateBaseplate) return;

  if (kernelName === 'brepkit') {
    await initWasmKernel();
  } else {
    await initOpenCascadeKernel();
  }

  const binMod = await import('@/features/generation/worker/generators/binGenerator');
  generateBin = binMod.generateBin as GenerateBinFn;
  generateSplitPreview = binMod.generateSplitPreview as GenerateSplitPreviewFn;

  const baseplateMod = await import('@/features/generation/worker/generators/baseplateGenerator');
  generateBaseplate = baseplateMod.generateBaseplate as GenerateBaseplateFn;
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
