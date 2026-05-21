/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * The Emscripten-generated JS uses environment detection (window, importScripts)
 * to locate the .wasm file. In Vite's ES module workers, neither exists, so the
 * WASM path resolves incorrectly. We provide explicit locateFile overrides using
 * Vite's ?url imports to ensure the correct path in all environments.
 */

import { initFromOC, registerKernel, BrepkitAdapter, loadFont } from 'brepjs';

import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';
import atkinsonFontUrl from './assets/fonts/AtkinsonHyperlegible-Regular.ttf?url';
import { isErr } from '@/core/result';

export interface WasmLoadResult {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
}

/** Get hardware concurrency with robust validation. */
function getHardwareConcurrency(): number {
  return typeof navigator !== 'undefined' &&
    Number.isFinite(navigator.hardwareConcurrency) &&
    navigator.hardwareConcurrency > 0
    ? navigator.hardwareConcurrency
    : 4;
}

/**
 * Load and initialize OpenCascade.
 *
 * Initialises the brepjs kernel with the loaded OpenCascade instance.
 */
export async function loadOpenCascade(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  const moduleConfig = {
    locateFile: (path: string) => (path.endsWith('.wasm') ? singleWasmUrl : path),
  };
  const OC = await (opencascadeSingleInit as (config: typeof moduleConfig) => Promise<unknown>)(
    moduleConfig
  );

  initFromOC(OC);
  await loadEmbeddedFonts();

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Loads the bundled engraved-text fonts into the brepjs font registry.
 * Failures are swallowed: the worker keeps running and text generation
 * downgrades to a no-op (label tabs without engraving), so a network
 * blip on the font asset never bricks the whole generation pipeline.
 *
 * Only called for OCCT-based kernels; brepkit-wasm doesn't currently
 * implement the topology operations textBuilder needs.
 */
async function loadEmbeddedFonts(): Promise<void> {
  try {
    const response = await fetch(atkinsonFontUrl);
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    const result = await loadFont(buffer, 'atkinson');
    if (isErr(result)) {
      console.warn('Failed to register Atkinson font:', result.error.message);
    }
  } catch (err) {
    console.warn('Failed to load embedded font asset:', err);
  }
}

/**
 * Load and initialize the brepkit (Rust-native) geometry kernel.
 *
 * Dynamically imports brepkit-wasm (which loads its own WASM binary),
 * wraps it with brepjs's `BrepkitAdapter`, and registers it as the active kernel.
 * Brepkit does not support threading, so `isThreaded` is always false.
 */
export async function loadBrepkit(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Dynamic import to keep the brepkit WASM out of the main chunk.
  // brepkit-wasm's entry JS handles its own WASM instantiation internally.
  const { BrepKernel } = await import('brepkit-wasm');
  const kernel = new BrepKernel();
  // BrepkitAdapter accepts KernelInstance (typed as `any` in brepjs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  const adapter = new BrepkitAdapter(kernel as any);
  registerKernel('brepkit', adapter);

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Load and initialize the occt-wasm geometry kernel.
 *
 * Uses occt-wasm 3.0's public `OcctKernel.init()` and the
 * `getRawModule()` / `getRawKernel()` accessors, which return types
 * structurally compatible with brepjs's `OcctWasmAdapter` constructor.
 * Registered under kernel id `'occt-wasm'` to coexist with `'occt'`
 * (brepjs-opencascade).
 */
export async function loadOcctWasm(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Dynamic imports keep occt-wasm out of the main worker chunk; Vite emits
  // a separate chunk + WASM asset that only fetches when the labs flag is on.
  const [{ OcctWasmAdapter }, { OcctKernel }, occtWasmUrlMod] = await Promise.all([
    import('brepjs'),
    import('occt-wasm'),
    import('occt-wasm/dist/occt-wasm.wasm?url'),
  ]);

  const kernel = await OcctKernel.init({ wasm: occtWasmUrlMod.default });
  // occt-wasm 3.0's exported `OcctWasmModule` still omits `VectorString` /
  // `getExceptionMessage`, and `OcctRawKernel` still omits IGES + XCAF
  // methods that brepjs's interface declares. Both surfaces exist at
  // runtime; the structural-type widening is incomplete on the occt-wasm
  // side. Filed upstream — keep the cast until exports match.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- see comment above
  const adapter = new OcctWasmAdapter(kernel.getRawModule() as any, kernel.getRawKernel() as any);
  registerKernel('occt-wasm', adapter);

  return { isThreaded: false, hardwareConcurrency };
}
