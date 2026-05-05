/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * The Emscripten-generated JS uses environment detection (window, importScripts)
 * to locate the .wasm file. In Vite's ES module workers, neither exists, so the
 * WASM path resolves incorrectly. We provide explicit locateFile overrides using
 * Vite's ?url imports to ensure the correct path in all environments.
 */

import { initFromOC, registerKernel, BrepkitAdapter } from 'brepjs';

import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';

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

  return { isThreaded: false, hardwareConcurrency };
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
