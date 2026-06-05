/**
 * Orchestrates geometry-kernel WASM loading for the generation worker — occt-wasm
 * (the default kernel) or brepkit-wasm (opt-in via Labs).
 *
 * Emscripten-generated JS locates its .wasm via environment detection (window,
 * importScripts); in Vite's ES module workers neither exists, so the path
 * resolves incorrectly. We pass an explicit URL from Vite's ?url import instead,
 * which resolves correctly in all environments.
 */

import { registerKernel, BrepkitAdapter, loadFont, initFromManifold, getKernel } from 'brepjs';

import atkinsonFontUrl from './assets/fonts/AtkinsonHyperlegible-Regular.ttf?url';
import jetbrainsMonoFontUrl from './assets/fonts/JetBrainsMono-Regular.ttf?url';
import allertaStencilFontUrl from './assets/fonts/AllertaStencil-Regular.ttf?url';
import { isErr } from '@/core/result';

export interface WasmLoadResult {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
}

/**
 * Fetch a kernel's WASM binary from its Vite-resolved `?url` and verify it is
 * actually WebAssembly before handing it to the kernel.
 *
 * A valid module starts with the 4-byte magic `\0asm`. When the requested asset
 * URL no longer exists — a stale service worker or browser cache holding an old
 * build's hashed asset path after a redeploy/dep-bump — the SPA server answers
 * `200 text/html` with `index.html` instead of `404`. Emscripten would then try
 * to compile that HTML and abort with an opaque
 * `CompileError: ... doesn't start with '\0asm'`. Validating here turns that into
 * an actionable error that names the URL and the real cause.
 */
async function fetchWasmBinary(url: string, label: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `${label} WASM fetch failed: ${response.status} ${response.statusText} (${url})`
    );
  }
  const buffer = await response.arrayBuffer();
  const header = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const isWasm =
    header[0] === 0x00 && header[1] === 0x61 && header[2] === 0x73 && header[3] === 0x6d;
  if (!isWasm) {
    const contentType = response.headers.get('content-type') ?? 'unknown';
    throw new Error(
      `${label} WASM asset returned ${contentType}, not a WebAssembly binary (${url}). ` +
        `A stale cache or service worker is likely serving a missing asset — hard-reload the page ` +
        `(or clear the service worker) to fetch the current build.`
    );
  }
  return buffer;
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
 * Loads the bundled engraved-text fonts into the brepjs font registry.
 * Failures are swallowed: the worker keeps running and text generation
 * downgrades to a no-op (label tabs without engraving), so a network
 * blip on the font asset never bricks the whole generation pipeline.
 *
 * Called from the occt-wasm loader (`loadOcctWasm`); brepkit-wasm skips
 * font loading because it doesn't implement the topology operations
 * `textBuilder` needs.
 */
const EMBEDDED_FONTS: readonly { readonly family: string; readonly url: string }[] = [
  { family: 'atkinson', url: atkinsonFontUrl },
  { family: 'jetbrains-mono', url: jetbrainsMonoFontUrl },
  { family: 'allerta-stencil', url: allertaStencilFontUrl },
];

async function loadEmbeddedFonts(): Promise<void> {
  await Promise.all(
    EMBEDDED_FONTS.map(async ({ family, url }) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        const result = await loadFont(buffer, family);
        if (isErr(result)) {
          console.warn(`Failed to register ${family} font:`, result.error.message);
        }
      } catch (err) {
        console.warn(`Failed to load ${family} font asset:`, err);
      }
    })
  );
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
 * Load and initialize the Manifold mesh-CSG geometry kernel for fast draft
 * previews. Registered under kernel id `'manifold'`.
 *
 * Manifold tessellates at build time (not extraction time), so we pin draft
 * quality on the adapter once here — every solid built in this worker uses the
 * coarse circular-segment setting. Like brepkit, Manifold doesn't implement the
 * topology ops `textBuilder` needs, so font loading is skipped (draft previews
 * omit engraved text). Exact geometry + text stay on the occt-wasm worker.
 */
export async function loadManifold(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Dynamic imports keep the manifold WASM out of the main worker chunk. The
  // Emscripten factory locates its .wasm by environment detection, which fails
  // in Vite ES module workers; fetch+validate the ?url-resolved binary ourselves
  // and hand it to the factory so a stale-asset HTML response fails loud here
  // rather than as an opaque WASM CompileError deep in Emscripten.
  const [{ default: ManifoldModule }, manifoldWasmUrlMod] = await Promise.all([
    import('manifold-3d'),
    import('manifold-3d/manifold.wasm?url'),
  ]);

  const wasmBinary = await fetchWasmBinary(manifoldWasmUrlMod.default, 'Manifold');
  // The published manifold-3d types only expose `locateFile`, but the Emscripten
  // runtime also honors `wasmBinary` (skips its own fetch entirely).
  const module = await ManifoldModule({ wasmBinary } as unknown as {
    locateFile: () => string;
  });
  module.setup();
  initFromManifold(module);
  getKernel('manifold').setQuality?.('draft');

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Load and initialize the occt-wasm geometry kernel.
 *
 * Registered under kernel id `'occt-wasm'` — the production default kernel.
 */
export async function loadOcctWasm(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Dynamic imports keep occt-wasm out of the main worker chunk; Vite emits a
  // separate chunk + WASM asset, fetched when geometry generation first runs.
  const [{ OcctWasmAdapter }, { OcctKernel }, occtWasmUrlMod] = await Promise.all([
    import('brepjs'),
    import('occt-wasm'),
    import('occt-wasm/dist/occt-wasm.wasm?url'),
  ]);

  // Fetch+validate the binary ourselves so a stale/missing asset (SPA serving
  // index.html for the hashed .wasm path) fails with an actionable error instead
  // of OcctKernel.init aborting with "module doesn't start with '\0asm'".
  const wasmBinary = await fetchWasmBinary(occtWasmUrlMod.default, 'OCCT');
  const kernel = await OcctKernel.init({ wasm: wasmBinary });
  // fromKernel retains the wrapper for the worker's lifetime, so no manual GC
  // pin is needed (worker.terminate() frees the whole WASM heap).
  registerKernel('occt-wasm', OcctWasmAdapter.fromKernel(kernel));

  // Engraved-text APIs are kernel-agnostic at brepjs's surface but use
  // OCCT primitives under the hood; occt-wasm satisfies them, so font
  // loading mirrors the default-kernel path. brepkit-wasm intentionally
  // skipped — it doesn't implement the topology ops textBuilder needs.
  await loadEmbeddedFonts();

  return { isThreaded: false, hardwareConcurrency };
}
