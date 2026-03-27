import type { TFunction } from '@/i18n';

/** Resolve the overlay status message, avoiding a nested ternary in JSX. */
export function overlayStatusText(
  isWasmLoading: boolean,
  splitProgress: { current: number; total: number } | null,
  dedupStats: { uniqueCount: number; duplicatesSkipped: number } | null,
  t: TFunction
): string {
  if (isWasmLoading) return t('baseplate.initializingEngine');
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
  return t('baseplate.generating');
}
