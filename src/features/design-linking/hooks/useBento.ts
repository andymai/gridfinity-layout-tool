/**
 * Turn a group of layout bins into one divided bento and open it in the
 * designer.
 *
 * The merge writes a new saved design and navigates to the designer, so labels,
 * wall patterns, bed splitting and every export format come along without this
 * feature reimplementing any of them.
 *
 * Scope is chosen by the CALLER, not inferred. A global "selection, else layer"
 * rule let an incidental selection hijack the whole-layer entry point: with one
 * bin selected, "make this drawer a bento" quietly became "make that one bin".
 *
 * Either scope narrows to a single layer first. Bins on different layers sit at
 * different heights in the drawer, so `max(height)` across them is meaningless.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Bin } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import type { Result } from '@/core/result';
import { isOk } from '@/core/result';
import { useLayoutStore, useSelectionStore, useToastStore, useSelectedBins } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { batch } from '@/core/cqrs';
import { getLayerBins } from '@/shared/utils/bins';
import { useTranslation } from '@/i18n';
import { saveDesign } from '@/features/bin-designer';
import { dispatchSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';
import { planMergedBin } from '../domain/mergeBins';
import type { MergeBlockedReason, MergeOptions, MergePlan } from '../domain/mergeBins';

/** Which bins an entry point means. Never inferred from app state. */
export type BentoScope = 'selection' | 'layer';

export interface CommitBentoInput {
  readonly plan: MergePlan;
  readonly name: string;
  /**
   * Swap the source bins for one bin covering the bento's footprint, linked to
   * the new design. Off leaves the layout untouched.
   */
  readonly replaceBins: boolean;
}

export interface UseBento {
  /** Bins the bento would consume, per the requested scope. */
  readonly mergeableBins: readonly Bin[];
  /** True when there is enough to merge for the action to be worth offering. */
  readonly canMerge: boolean;
  /** Dry run — drives the confirmation UI's warnings without side effects. */
  readonly previewBento: (options?: MergeOptions) => Result<MergePlan, MergeBlockedReason>;
  /** Default design name, derived from the layout. */
  readonly defaultName: string;
  /**
   * Persist the design and navigate to the designer. Resolves `false` when the
   * save failed, so the caller can keep its UI open rather than dismissing it
   * and leaving a transient toast as the only trace.
   */
  readonly commitBento: (input: CommitBentoInput) => Promise<boolean>;
}

export function useBento(scope: BentoScope): UseBento {
  const t = useTranslation();
  const layout = useLayoutStore(useShallow((s) => s.layout));
  const activeLayerId = useSelectionStore((s) => s.activeLayerId);
  const selectedBins = useSelectedBins();
  const addToast = useToastStore((s) => s.addToast);
  const { addBin, deleteBins } = useMutations();

  const mergeableBins = useMemo(() => {
    const scoped = scope === 'selection' ? selectedBins : layout.bins;
    return getLayerBins([...scoped], activeLayerId);
  }, [scope, selectedBins, layout.bins, activeLayerId]);

  const previewBento = useCallback(
    (options: MergeOptions = {}) => planMergedBin(mergeableBins, layout, options),
    [mergeableBins, layout]
  );

  const defaultName = t('designLinking.bento.designName', { layout: layout.name });

  const commitBento = useCallback(
    async ({ plan, name, replaceBins }: CommitBentoInput) => {
      // Resolved once: the design and the bin that links to it have to carry the
      // same name, or clearing the field leaves an unlabelled bin pointing at a
      // design called something else.
      const resolvedName =
        name.trim() || t('designLinking.bento.designName', { layout: layout.name });
      const saved = await saveDesign({
        name: resolvedName,
        params: plan.params,
        thumbnail: null,
        exportFileNameConfig: null,
      });

      if (!isOk(saved)) {
        addToast({ message: t('designLinking.bento.toast.saveFailed'), type: 'error' });
        return false;
      }

      let replaceFailed = false;
      if (replaceBins) {
        const sources = mergeableBins;
        const minX = Math.min(...sources.map((b) => b.x));
        const minY = Math.min(...sources.map((b) => b.y));
        // Built field by field rather than spread from a source bin: the bento
        // is one new part, so per-bin metadata (clearance, custom properties,
        // overhang, lock) describes bins that no longer exist and carrying an
        // arbitrary one of them forward would be a coin toss.
        const replacement: Omit<Bin, 'id'> = {
          layerId: sources[0].layerId,
          x: gridUnits(minX),
          y: gridUnits(minY),
          width: gridUnits(plan.params.width),
          depth: gridUnits(plan.params.depth),
          height: heightUnits(plan.params.height),
          category: sources[0].category,
          label: resolvedName,
          notes: '',
          linkedDesignId: saved.value.id,
        };
        // One history entry for the whole swap. `batch` groups the undo entry;
        // it does NOT roll back on failure, so the placement result has to be
        // checked here. The bento's footprint always overlaps the bins it
        // replaces, so they must be deleted before it can be placed — which
        // means the only guard against `addBin` being rejected (a cross-layer
        // blocked zone, drawer height) is putting the originals back.
        const placed = batch(() => {
          deleteBins(sources.map((b) => b.id));
          if (isOk(addBin(replacement))) return true;
          for (const source of sources) {
            const { id: _id, ...withoutId } = source;
            addBin(withoutId);
          }
          return false;
        });

        replaceFailed = !placed;
      }

      window.history.pushState(null, '', `/designer?id=${encodeURIComponent(saved.value.id)}`);
      dispatchSyntheticPopstate();

      // One message, not two: the bento is saved either way, so a success
      // toast alongside a failure toast would leave the user guessing which
      // half happened.
      addToast(
        replaceFailed
          ? { message: t('designLinking.bento.toast.replaceFailed'), type: 'error', duration: 6000 }
          : {
              message: t('designLinking.bento.toast.created', { count: plan.compartmentCount }),
              type: 'success',
              duration: 4000,
            }
      );
      return true;
    },
    [layout.name, addToast, t, mergeableBins, addBin, deleteBins]
  );

  return {
    mergeableBins,
    canMerge: mergeableBins.length > 1,
    previewBento,
    defaultName,
    commitBento,
  };
}
