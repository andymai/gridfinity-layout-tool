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
import { isStaleAssetError } from './wasmLoadError';

export function captureWasmLoadFailure(
  error: unknown,
  surface: 'bin_designer_preview' | 'baseplate_preview'
): void {
  captureException(error instanceof Error ? error : new Error(String(error)), {
    surface,
    kernel: getActiveKernel(),
    stale_asset: isStaleAssetError(error),
  });
}
