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

import { DRAFT_MIN_CIRCULAR_ANGLE_DEG } from '@/shared/constants/tessellation';
import { getManifoldModule } from './manifoldRuntime';
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
/**
 * Minimal shape of brepkit-wasm's module surface used for kernel creation and
 * panic capture, cached so {@link recoverBrepkitKernel} can recreate the kernel
 * without re-importing.
 */
interface BrepkitModule {
  BrepKernel: new () => unknown;
  /** Root panic text captured by brepkit's panic hook (`crates/wasm/src/panics.rs`). */
  lastPanicMessage?: () => string | undefined;
  clearLastPanicMessage?: () => void;
}

/** Set once brepkit is loaded; drives in-place kernel recovery. */
let brepkitModule: BrepkitModule | null = null;

export async function loadBrepkit(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Dynamic import to keep the brepkit WASM out of the main chunk.
  // brepkit-wasm's entry JS handles its own WASM instantiation internally.
  const bkw = (await import('brepkit-wasm')) as unknown as BrepkitModule;
  brepkitModule = bkw;
  const kernel = new bkw.BrepKernel();
  // BrepkitAdapter accepts KernelInstance (typed as `any` in brepjs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  const adapter = new BrepkitAdapter(kernel as any);
  registerKernel('brepkit', adapter);
  bkw.clearLastPanicMessage?.();

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Recreate the brepkit kernel after a borrow-flag POISON.
 *
 * The brepkit WASM kernel is a per-worker singleton whose wasm-bindgen borrow
 * flag can be permanently stranded (brepkit task #14): a `raw_vec` capacity-
 * overflow Rust panic (wasm is `panic=abort`, so the trap never releases the
 * `&mut self` borrow), or a JS exception unwinding through a `&mut self` method
 * that leaves the `BorrowMut` guard undropped. Once stranded, EVERY later call
 * throws "recursive use of an object detected ... unsafe aliasing", and no Rust
 * code can reset the flag — the only recovery is a NEW `BrepKernel`.
 *
 * A fresh kernel re-registered as the default reroutes all subsequent brepjs ops
 * (they resolve `getKernel()` per call). The CALLER must first drop cache
 * handles that index the now-dead arena (socket/lip/box/shell/lastSolid,
 * baseplate, mesh-imprint) — brepkit's `dispose` is a no-op, so that is safe even
 * while poisoned. Returns `false` (no-op) if brepkit was never loaded.
 */
export function recoverBrepkitKernel(): boolean {
  if (!brepkitModule) return false;
  const kernel = new brepkitModule.BrepKernel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  registerKernel('brepkit', new BrepkitAdapter(kernel as any));
  brepkitModule.clearLastPanicMessage?.();
  return true;
}

/**
 * Root panic text captured by brepkit's panic hook if the last op trapped, else
 * `undefined`. Used to detect a panic-abort poison that left no catchable JS
 * error on the poisoning request itself.
 */
export function getLastBrepkitPanic(): string | undefined {
  return brepkitModule?.lastPanicMessage?.();
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

  // The raw module lives in manifoldRuntime so mesh import/imprint code can
  // share the same instance (and the occt worker can lazy-load it without
  // registering a kernel).
  const module = await getManifoldModule();
  initFromManifold(module);
  const manifoldKernel = getKernel('manifold');
  manifoldKernel.setQuality?.('draft');
  // setQuality('draft') sets a 30° min circular angle (~12-gon circles). Tighten
  // it for rounder curve rims, staying below CREASE_ANGLE_DEG so the worker's
  // crease extractor doesn't emit longitudinal facet lines. The raw manifold
  // module is exposed as `.oc`.
  const manifoldModule = (
    manifoldKernel as { oc?: { setMinCircularAngle?: (deg: number) => void } }
  ).oc;
  manifoldModule?.setMinCircularAngle?.(DRAFT_MIN_CIRCULAR_ANGLE_DEG);

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
