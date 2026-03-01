/**
 * Orchestrates cache-first WASM loading for OpenCascade.
 *
 * Replaces direct Emscripten factory calls in the worker with a pipeline:
 * 1. Check for a pre-compiled module (passed from main thread)
 * 2. Check IndexedDB cache
 * 3. Compile from network (compileStreaming with fallback)
 * 4. Cache the compiled module for next visit
 * 5. Instantiate via Emscripten's `instantiateWasm` override
 */

import { initFromOC } from 'brepjs';
import { getCachedModule, cacheModule } from './wasmModuleCache';
import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';

// Single-threaded WASM (always available)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import opencascadeSingleWasm from 'brepjs-opencascade/src/brepjs_single.wasm?url';

// Multi-threaded WASM (conditionally loaded)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';
import opencascadeThreadedWasm from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import opencascadeThreadedWorker from 'brepjs-opencascade/src/brepjs_threaded.worker.js?url';
import opencascadeThreadedJs from 'brepjs-opencascade/src/brepjs_threaded.js?url';

export interface WasmLoadResult {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
  /** The compiled module, for sharing with pool workers */
  readonly wasmModule: WebAssembly.Module;
}

interface LoadOptions {
  /** Pre-compiled module from main thread (skips cache + compile) */
  cachedModule?: WebAssembly.Module;
}

/**
 * Detect if multi-threaded WASM is supported in this worker context.
 * Disabled in development mode due to Vite dev server limitations with pthread workers.
 */
function detectThreadingSupport(): boolean {
  if (import.meta.env.DEV) {
    return false;
  }
  return detectWasmCapabilities().supportsThreads;
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
 * Obtain a compiled WebAssembly.Module, using cache hierarchy:
 * 1. Provided cachedModule (from main thread transfer)
 * 2. IndexedDB cache
 * 3. Network compile (compileStreaming with fallback)
 */
async function obtainModule(
  wasmUrl: string,
  cachedModule?: WebAssembly.Module
): Promise<WebAssembly.Module> {
  if (cachedModule) {
    return cachedModule;
  }

  // Try IndexedDB cache
  const cached = await getCachedModule(wasmUrl);
  if (cached) {
    return cached;
  }

  // Compile from network
  const module = await compileFromNetwork(wasmUrl);

  // Fire-and-forget cache write
  void cacheModule(wasmUrl, module);

  return module;
}

/** Compile WASM from URL, with fallback for browsers that don't support compileStreaming. */
async function compileFromNetwork(wasmUrl: string): Promise<WebAssembly.Module> {
  try {
    return await WebAssembly.compileStreaming(fetch(wasmUrl));
  } catch {
    // Fallback: fetch + compile (e.g., wrong MIME type)
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return WebAssembly.compile(buffer);
  }
}

/**
 * Load and initialize OpenCascade with cache-first WASM loading.
 *
 * Uses `instantiateWasm` Emscripten override to provide a pre-compiled
 * Module, skipping the compilation step entirely.
 */
export async function loadOpenCascade(options?: LoadOptions): Promise<WasmLoadResult> {
  const isThreaded = detectThreadingSupport();
  const hardwareConcurrency = getHardwareConcurrency();

  const wasmUrl = isThreaded ? opencascadeThreadedWasm : opencascadeSingleWasm;
  const wasmModule = await obtainModule(wasmUrl, options?.cachedModule);

  // Build Emscripten config with instantiateWasm override.
  // If instantiation fails (e.g., corrupted cached module), we reject a
  // shared promise so the outer factory call doesn't hang forever.
  let rejectFactory: ((error: Error) => void) | null = null;
  const instantiationGuard = new Promise<never>((_resolve, reject) => {
    rejectFactory = reject;
  });

  const instantiateWasm = (
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance) => void
  ): Record<string, unknown> => {
    WebAssembly.instantiate(wasmModule, imports)
      .then((instance) => {
        receiveInstance(instance);
      })
      .catch((e: unknown) => {
        // Evict corrupted cache entry
        void cacheModule(wasmUrl, wasmModule).catch(() => {});
        rejectFactory?.(
          new Error(`WASM instantiation failed: ${e instanceof Error ? e.message : String(e)}`)
        );
      });
    return {}; // Emscripten expects synchronous return of exports (filled async)
  };

  // Race the factory against the instantiation guard to avoid hanging on corrupt modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emscripten WASM factory returns untyped module
  let factoryPromise: Promise<any>;
  if (isThreaded) {
    // The threaded Emscripten config type lacks instantiateWasm, but the runtime supports it
    const threadedConfig = {
      mainScriptUrlOrBlob: opencascadeThreadedJs,
      instantiateWasm,
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) {
          return opencascadeThreadedWasm;
        }
        if (fileName.endsWith('.worker.js')) {
          return opencascadeThreadedWorker;
        }
        return fileName;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Emscripten config extended with instantiateWasm
    factoryPromise = opencascadeThreadedInit(threadedConfig as any);
  } else {
    factoryPromise = opencascadeSingleInit({
      instantiateWasm,
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) {
          return opencascadeSingleWasm;
        }
        return fileName;
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Emscripten WASM factory returns untyped module
  const OC = await Promise.race([factoryPromise, instantiationGuard]);

  initFromOC(OC);

  return { isThreaded, hardwareConcurrency, wasmModule };
}
