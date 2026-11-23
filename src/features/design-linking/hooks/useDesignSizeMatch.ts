import { useCallback, useMemo } from 'react';
import { batch } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts';
import { getBinLocationContext, isBinLocked } from '@/shared/utils/binLocation';
import type { CustomBinRef } from '@/features/bin-designer';
import type { SyncableDimensions } from '../types';
import { checkSyncEligibility, createBinSyncUpdate, differsFromDesign } from '../domain';

export interface DesignSizeMatch {
  readonly binSize: string;
  readonly designSize: string;
  /** The design's size fits where the bin stands. */
  readonly canResize: boolean;
  readonly resize: () => void;
}

/** Heights keep four decimals, so a one-decimal size can hide the difference. */
function formatSize({ width, depth, height }: SyncableDimensions): string {
  return `${[width, depth, height].map((v) => String(Number(v.toFixed(4)))).join('×')}u`;
}

/**
 * The design's size in the bin's own orientation first: a turned bin matches
 * its design turned, so resizing it upright would move cells it never needed.
 */
function resizeTargets(bin: Bin, design: SyncableDimensions): SyncableDimensions[] {
  if (design.width === design.depth) return [design];
  const turned = { width: design.depth, depth: design.width, height: design.height };
  const binWide = bin.width > bin.depth;
  const designWide = design.width > design.depth;
  return bin.width !== bin.depth && binWide !== designWide ? [turned, design] : [design, turned];
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
    const targets = resizeTargets(bin, size);
    // A stashed bin takes any size: the stash has no cells to share.
    if (!getBinLocationContext(bin).requiresPlacementValidation) {
      return { size: targets[0], canResize: true };
    }
    const fitting = targets.find(
      (target) => checkSyncEligibility(bin, target, layout, layout.bins).canSync
    );
    return { size: fitting ?? targets[0], canResize: fitting !== undefined };
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
    binSize: formatSize({ width: bin.width, depth: bin.depth, height: bin.height }),
    designSize: formatSize(mismatch.size),
    canResize: mismatch.canResize,
    resize,
  };
}
