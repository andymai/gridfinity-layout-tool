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
  captureException(error instanceof Error ? error : new Error(String(error)), {
    surface,
    kernel: getActiveKernel(),
    stale_asset: isStaleAssetError(error),
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
    void recoverStaleBundle(`wasm_load_failure:${surface}`);
  }
}
