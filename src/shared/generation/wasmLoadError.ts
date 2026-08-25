/**
 * Classify geometry-kernel (WASM) load failures for telemetry.
 *
 * The dominant real-world failure is not a code bug: a stale service worker or
 * browser cache serves index.html for a hashed .wasm/chunk URL that no longer
 * exists after a redeploy, so the worker bootstrap or `fetchWasmBinary` aborts.
 * It self-heals on a hard reload. Flagging it lets dashboards separate that
 * self-healing cache class from genuine load regressions — without the flag the
 * two are indistinguishable, and the cache class is invisible because the
 * affected code paths historically swallowed the error.
 */

/**
 * Every phrasing a browser uses for "the asset did not arrive".
 *
 * Each engine words this differently and only Chrome's wording was listed, so a
 * Safari or Firefox user hit the same stale bundle, matched nothing, and was
 * left on a dead 3D engine instead of being reloaded onto the current build.
 * Matching is substring and case-sensitive, so the wording has to be exact.
 *
 * Breadth is safe here because {@link isStaleAssetError} is only ever asked
 * about an error that already failed to load the kernel: at that point a bare
 * `Load failed` can only be the asset, and a reload is the right answer whether
 * the cause was a stale hash or a dropped connection.
 */
const STALE_ASSET_SIGNATURES = [
  'not a WebAssembly binary',
  'stale cache or service worker',
  "doesn't start with",
  'script failed to load',
  'WASM fetch failed',
  // Dynamic import of the kernel's glue module. Chrome and Firefox disagree on
  // the verb; `Failed to fetch` alone also covers Chrome's bare fetch failure.
  'Failed to fetch',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'NetworkError when attempting to fetch resource',
  // Safari's fetch rejection, which carries no detail at all.
  'Load failed',
  // A truncated download: the module declares more bytes than arrived, so
  // compilation walks off the end. Re-fetching is exactly the fix.
  'extends past end of the module',
  // A cached old bundle running on a browser that can't compile an instruction
  // the old build used (e.g. relaxed-SIMD on some Safari/iOS WebKit). Current
  // builds no longer emit it, so seeing it means the client is on stale cached
  // code — recoverable by fetching the latest bundle.
  'relaxed simd instructions not supported',
] as const;

export function isStaleAssetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return STALE_ASSET_SIGNATURES.some((sig) => message.includes(sig));
}

/**
 * Reduce a bundler-hashed asset URL to a deploy-stable label.
 *
 * Vite emits content-hashed asset names (e.g. `occt-wasm-DVSq216o.wasm`) whose
 * hash rotates on every build. Embedding the raw URL in a thrown error message
 * makes error tracking's message-based grouping mint a brand-new issue on each
 * deploy for what is really one recurring stale-bundle 404. Collapsing the URL
 * to its hash-stripped basename (`occt-wasm-[hash].wasm`) keeps the useful
 * "which asset" context while grouping every deploy's failure into one issue.
 *
 * The hash segment is the last `-`/`.`-delimited run of ≥8 word chars before
 * the extension (Vite's default `[name]-[hash][ext]`); an unhashed name is
 * returned unchanged.
 */
export function stableAssetName(url: string): string {
  const path = url.split(/[?#]/)[0] ?? url;
  const basename = path.slice(path.lastIndexOf('/') + 1) || path;
  return basename.replace(/([-.])[A-Za-z0-9_]{8,}(\.[A-Za-z0-9]+)$/, '$1[hash]$2');
}
