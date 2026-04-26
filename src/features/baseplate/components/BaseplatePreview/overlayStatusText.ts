import type { TFunction } from '@/i18n';

/**
 * Resolve the overlay status message based on the active phase.
 *
 * Priority (highest first):
 *   1. Split BREP in progress — shows piece-by-piece progress (with dedup count if applicable)
 *   2. WASM still loading — "Loading 3D engine..."
 *   3. Direct-mesh preview visible while BREP runs — "Computing high-fidelity geometry..."
 *   4. Otherwise — generic "Generating..." (transitional state, rarely visible)
 *
 * `hasDirectPreview` lets us tell the user "we're upgrading what you see"
 * instead of "we're still loading", since the canvas is no longer blank.
 */
export function overlayStatusText(
  isWasmLoading: boolean,
  splitProgress: { current: number; total: number } | null,
  dedupStats: { uniqueCount: number; duplicatesSkipped: number } | null,
  hasDirectPreview: boolean,
  t: TFunction
): string {
  if (splitProgress) {
    if (dedupStats && dedupStats.duplicatesSkipped > 0) {
      return t('baseplate.generation.dedupProgress', {
        unique: dedupStats.uniqueCount,
        skipped: dedupStats.duplicatesSkipped,
      });
    }
    return t('baseplate.generatingSplit', {
      current: splitProgress.current,
      total: splitProgress.total,
    });
  }
  if (isWasmLoading) return t('baseplate.loadingEngine');
  if (hasDirectPreview) return t('baseplate.computingGeometry');
  return t('baseplate.generating');
}
