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

const STALE_ASSET_SIGNATURES = [
  'not a WebAssembly binary',
  'stale cache or service worker',
  "doesn't start with",
  'script failed to load',
  'Failed to fetch dynamically imported module',
  'WASM fetch failed',
] as const;

export function isStaleAssetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return STALE_ASSET_SIGNATURES.some((sig) => message.includes(sig));
}
