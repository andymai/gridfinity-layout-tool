/**
 * Singleton accessor for the raw manifold-3d WASM module inside a generation
 * worker.
 *
 * Two consumers share this instance:
 *  - `wasmInstantiator.loadManifold()` registers it as the brepjs draft kernel
 *    (manifold draft-preview worker).
 *  - Mesh import / mesh imprint code uses the module directly for mesh CSG,
 *    independent of which brepjs kernel the worker runs — the occt exact
 *    worker lazy-loads manifold only when a design actually uses mesh
 *    cutouts, so the extra WASM never costs anything otherwise.
 *
 * Emscripten's own .wasm path detection fails in Vite ES module workers, so
 * the binary is fetched via the ?url-resolved asset and validated (`\0asm`
 * magic) before instantiation — a stale service-worker cache otherwise
 * surfaces as an opaque CompileError deep in Emscripten.
 */

import type { ManifoldToplevel } from 'manifold-3d';

let modulePromise: Promise<ManifoldToplevel> | null = null;
let loadedModule: ManifoldToplevel | null = null;

async function instantiate(): Promise<ManifoldToplevel> {
  const [{ default: ManifoldModule }, manifoldWasmUrlMod] = await Promise.all([
    import('manifold-3d'),
    import('manifold-3d/manifold.wasm?url'),
  ]);

  const url = manifoldWasmUrlMod.default;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Manifold WASM fetch failed: ${response.status} ${response.statusText} (${url})`
    );
  }
  const wasmBinary = await response.arrayBuffer();
  const header = new Uint8Array(wasmBinary, 0, Math.min(4, wasmBinary.byteLength));
  const isWasm =
    header[0] === 0x00 && header[1] === 0x61 && header[2] === 0x73 && header[3] === 0x6d;
  if (!isWasm) {
    const contentType = response.headers.get('content-type') ?? 'unknown';
    throw new Error(
      `Manifold WASM asset returned ${contentType}, not a WebAssembly binary (${url}). ` +
        `A stale cache or service worker is likely serving a missing asset — hard-reload the page ` +
        `(or clear the service worker) to fetch the current build.`
    );
  }

  // The published manifold-3d types only expose `locateFile`, but the
  // Emscripten runtime also honors `wasmBinary` (skips its own fetch).
  const module = await ManifoldModule({ wasmBinary } as unknown as {
    locateFile: () => string;
  });
  module.setup();
  return module;
}

/** Load (once) and return the raw manifold-3d module for this worker. */
export function getManifoldModule(): Promise<ManifoldToplevel> {
  modulePromise ??= instantiate()
    .then((module) => {
      loadedModule = module;
      return module;
    })
    .catch((error: unknown) => {
      modulePromise = null;
      throw error;
    });
  return modulePromise;
}

/**
 * Synchronous accessor for the already-loaded module, for callers inside the
 * synchronous generation pipeline. Returns null until `getManifoldModule()`
 * has resolved (an async pre-pass awaits it before generation starts).
 */
export function getLoadedManifoldModule(): ManifoldToplevel | null {
  return loadedModule;
}

/** Test hook: inject an fs-instantiated module (node has no fetch loader). */
export function setManifoldModuleForTests(module: ManifoldToplevel): void {
  loadedModule = module;
  modulePromise = Promise.resolve(module);
}
