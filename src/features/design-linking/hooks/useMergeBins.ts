/**
 * Merge a group of layout bins into one divided bin design.
 *
 * Non-destructive: the layout is untouched. The merge writes a new saved
 * design and opens the designer on it, so labels, wall patterns, bed splitting
 * and every export format come along without this feature reimplementing any
 * of them.
 *
 * Scope follows the selection when there is one and the active layer
 * otherwise. Either way the bins are narrowed to a single layer first — bins on
 * different layers sit at different heights in the drawer, so `max(height)`
 * across them would be meaningless.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Bin } from '@/core/types';
import type { Result } from '@/core/result';
import { isOk } from '@/core/result';
import { useLayoutStore, useSelectionStore, useToastStore, useSelectedBins } from '@/core/store';
import { getLayerBins } from '@/shared/utils/bins';
import { useTranslation } from '@/i18n';
import { saveDesign } from '@/features/bin-designer';
import { dispatchSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';
import { planMergedBin } from '../domain/mergeBins';
import type { MergeBlockedReason, MergeOptions, MergePlan } from '../domain/mergeBins';

export interface UseMergeBins {
  /** Bins the merge would consume: the selection, else the active layer. */
  readonly mergeableBins: readonly Bin[];
  /** True when there is enough to merge for the action to be worth offering. */
  readonly canMerge: boolean;
  /** Dry run — drives the confirmation dialog's warnings without side effects. */
  readonly previewMerge: (options?: MergeOptions) => Result<MergePlan, MergeBlockedReason>;
  /** Persist the plan and navigate to the designer. */
  readonly commitMerge: (plan: MergePlan) => Promise<void>;
}

export function useMergeBins(): UseMergeBins {
  const t = useTranslation();
  const layout = useLayoutStore(useShallow((s) => s.layout));
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);
  const selectedBins = useSelectedBins();
  const addToast = useToastStore((s) => s.addToast);

  const mergeableBins = useMemo(() => {
    const scoped = selectedBins.length > 0 ? selectedBins : layout.bins;
    return getLayerBins([...scoped], activeLayerId);
  }, [selectedBins, layout.bins, activeLayerId]);

  const previewMerge = useCallback(
    (options: MergeOptions = {}) => planMergedBin(mergeableBins, layout, options),
    [mergeableBins, layout]
  );

  const commitMerge = useCallback(
    async (plan: MergePlan) => {
      const saved = await saveDesign({
        name: t('designLinking.merge.designName', { layout: layout.name }),
        params: plan.params,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      if (!isOk(saved)) {
        addToast({ message: t('designLinking.merge.toast.saveFailed'), type: 'error' });
        return;
      }

      window.history.pushState(null, '', `/designer?id=${encodeURIComponent(saved.value.id)}`);
      dispatchSyntheticPopstate();

      addToast({
        message: t('designLinking.merge.toast.created', {
          count: plan.compartmentCount,
        }),
        type: 'success',
        duration: 4000,
      });
    },
    [layout.name, addToast, t]
  );

  return {
    mergeableBins,
    canMerge: mergeableBins.length > 1,
    previewMerge,
    commitMerge,
  };
}
