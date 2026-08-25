/**
 * Report a geometry-kernel (WASM) load failure to error tracking.
 *
 * Both the bin-designer and baseplate preview paths drive the user-visible
 * "Failed to load 3D engine" state but historically swallowed the underlying
 * error, so these failures were invisible to error tracking and only showed in
 * session replay. This centralizes the capture with the kernel name and a
 * stale-asset flag so the self-healing cache class can be split from genuine
 * load regressions.
 */

import { captureException } from '@/shared/analytics/posthog';
import { getActiveKernel } from '@/shared/generation/bridge';
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';
import { isStaleAssetError } from './wasmLoadError';

type WasmLoadSurface = 'bin_designer_preview' | 'baseplate_preview';

export function captureWasmLoadFailure(error: unknown, surface: WasmLoadSurface): void {
  const staleAsset = isStaleAssetError(error);
  captureException(error instanceof Error ? error : new Error(String(error)), {
    surface,
    kernel: getActiveKernel(),
    stale_asset: staleAsset,
    // Stale-bundle failures self-heal (see handleWasmLoadFailure) and recur on
    // every deploy. Pin the whole self-healing class to one stable fingerprint
    // so a per-deploy hashed asset name — in the message or a stack frame — can't
    // splinter it into a fresh error-tracking issue each release. Genuine (non-
    // stale) load regressions keep their default per-message grouping.
    ...(staleAsset ? { $exception_fingerprint: 'wasm-load-stale-asset' } : {}),
  });
}

/**
 * Report a kernel load failure and, when it looks like a stale cached bundle,
 * self-heal: drop the stale caches + service worker and hard-reload to the
 * latest build (once per session). Use this from the preview load paths so a
 * returning user on an old bundle recovers on the spot instead of staring at a
 * dead "Failed to load 3D engine" state.
 */
export function handleWasmLoadFailure(error: unknown, surface: WasmLoadSurface): void {
  captureWasmLoadFailure(error, surface);
  if (isStaleAssetError(error)) {
    void recoverStaleBundle(`wasm_load_failure:${surface}`, { dropWasmCache: true });
  }
}
