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

type KernelName = 'opencascade' | 'wasm';

const VALID_KERNELS: readonly KernelName[] = ['opencascade', 'wasm'];

function resolveKernel(): KernelName {
  const env = process.env['BREPJS_KERNEL'];
  if (!env) return 'opencascade';
  if (VALID_KERNELS.includes(env as KernelName)) return env as KernelName;
  throw new Error(`Invalid BREPJS_KERNEL="${env}". Must be one of: ${VALID_KERNELS.join(', ')}`);
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

async function initOpenCascadeKernel(): Promise<void> {
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
}

async function initWasmKernel(): Promise<void> {
  // initFromWasm is provided by a future brepjs version (with brepjs-wasm kernel).
  // Use a dynamic cast since the type doesn't exist in the current brepjs package.
  const brepjs = (await import('brepjs')) as Record<string, unknown>;
  const initFromWasm = brepjs['initFromWasm'] as ((wasm: Buffer) => Promise<void>) | undefined;
  if (!initFromWasm) {
    throw new Error(
      'initFromWasm not found in brepjs — upgrade brepjs to a version that supports the wasm kernel'
    );
  }
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-wasm/brepjs_wasm_bg.wasm');
  const wasmBinary = readFileSync(wasmPath);
  await initFromWasm(wasmBinary);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise brepjs with the selected kernel and cache generator functions.
 * Safe to call multiple times — only the first call does real work.
 */
export async function initBrepjs(): Promise<void> {
  if (generateBin && generateSplitPreview && generateBaseplate) return;

  if (kernelName === 'wasm') {
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
