import { useCallback, useMemo } from 'react';
import { batch } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts';
import { isBinLocked } from '@/shared/utils/binLocation';
import type { CustomBinRef } from '@/features/bin-designer';
import {
  checkSyncEligibility,
  createBinSyncUpdate,
  differsFromDesign,
  formatDimensions,
} from '../domain';

export interface DesignSizeMatch {
  readonly binSize: string;
  readonly designSize: string;
  /** The design's size fits where the bin stands. */
  readonly canResize: boolean;
  readonly resize: () => void;
}

/**
 * A linked bin that stands at a size other than its design's: a size-locked
 * bin the design sync skipped, or a bin whose sync prompt was cancelled.
 * Null when the bin matches its design.
 */
export function useDesignSizeMatch(bin: Bin, design: CustomBinRef | null): DesignSizeMatch | null {
  const t = useTranslation();
  const { updateBin } = useMutations();
  const addToast = useToastStore((s) => s.addToast);
  const layout = useLayoutStore((s) => s.layout);

  const mismatch = useMemo(() => {
    if (design === null) return null;
    const size = { width: design.width, depth: design.depth, height: design.height };
    if (!differsFromDesign(bin, size)) return null;
    return { size, canResize: checkSyncEligibility(bin, size, layout, layout.bins).canSync };
  }, [bin, design, layout]);

  const resize = useCallback(() => {
    if (mismatch === null) return;
    // The lock stays: it guards the bin against accidental resizes, and this
    // resize is the user's own choice.
    const locked = isBinLocked(bin);
    const resized = batch(() => {
      const result = updateBin(bin.id, {
        ...createBinSyncUpdate(mismatch.size),
        ...(locked ? { locked: false } : {}),
      });
      if (isOk(result) && locked) updateBin(bin.id, { locked: true });
      return result;
    });
    if (!isOk(resized)) {
      addToast({ message: t('designLinking.toast.refusedNoRoom', { count: 1 }), type: 'info' });
    }
  }, [mismatch, bin, updateBin, addToast, t]);

  if (mismatch === null) return null;
  return {
    binSize: `${formatDimensions({ width: bin.width, depth: bin.depth, height: bin.height })}u`,
    designSize: `${formatDimensions(mismatch.size)}u`,
    canResize: mismatch.canResize,
    resize,
  };
}
