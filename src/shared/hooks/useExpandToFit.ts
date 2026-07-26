import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import type { ExpandBlockedReason } from '@/shared/utils/expandToFit';
import type { BinId } from '@/core/types';

/** Exhaustive by construction — a new reason won't compile until it has a message. */
const BLOCKED_MESSAGE_KEY: Record<ExpandBlockedReason, string> = {
  ragged: 'toast.expandToFitRagged',
  'no-slack': 'toast.expandToFitNoSlack',
  'slack-exceeds-overhang': 'toast.expandToFitTooMuchSlack',
  'no-grid-alignment': 'toast.expandToFitNoGridAlignment',
};

/**
 * Grow bins until they fill the space around them.
 *
 * Unlike the other selection actions this dispatches a single command instead
 * of a `batch()` of per-bin updates — expansion shifts footprints, and the
 * intermediate states are invalid (see `bin.expandToFit`).
 *
 * `expandBins` takes explicit ids for the context menus, which can act on a
 * long-pressed bin that isn't the current selection; `expandToFit` is the
 * selection-bound form the toolbar and command palette use. They're separate
 * functions rather than one optional-argument function so that passing the
 * selection-bound one straight to an `onClick` can't smuggle in an event
 * object as the id list.
 */
export function useExpandToFit() {
  const t = useTranslation();
  const bins = useLayoutStore((s) => s.layout.bins);
  const { selectedBinIds } = useSelectionStore(
    useShallow((s) => ({ selectedBinIds: s.selectedBinIds }))
  );
  const addToast = useToastStore((s) => s.addToast);
  const { expandBinsToFit } = useMutations();

  // Staged bins have no grid position to expand from.
  const canExpand = bins.some((b) => selectedBinIds.includes(b.id) && b.layerId !== STAGING_ID);

  const expandBins = useCallback(
    (targetIds: readonly BinId[]) => {
      const ids = bins
        .filter((b) => targetIds.includes(b.id) && b.layerId !== STAGING_ID)
        .map((b) => b.id);
      // Nothing placed on the grid — same advice as a ragged selection.
      if (ids.length === 0) {
        addToast({ message: t('toast.expandToFitRagged'), type: 'info', duration: 3000 });
        return;
      }

      const result = expandBinsToFit(ids);
      if (isOk(result)) {
        addToast({
          message: t('toast.expandToFitComplete', { count: result.value }),
          type: 'success',
          duration: 2000,
        });
        return;
      }

      const reason =
        result.error.code === 'LAYOUT_INVALID_OPERATION' ? result.error.reason : undefined;
      const key =
        reason !== undefined && reason in BLOCKED_MESSAGE_KEY
          ? BLOCKED_MESSAGE_KEY[reason as ExpandBlockedReason]
          : 'toast.expandToFitRagged';
      addToast({ message: t(key), type: 'info', duration: 3000 });
    },
    [bins, expandBinsToFit, addToast, t]
  );

  const expandToFit = useCallback(() => {
    expandBins(selectedBinIds);
  }, [expandBins, selectedBinIds]);

  return { expandToFit, expandBins, canExpand };
}
