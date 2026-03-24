import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { computeAlignedPositions } from '@/shared/utils/alignBins';
import type { AlignEdge } from '@/shared/utils/alignBins';
import { batch } from '@/core/cqrs';

/**
 * Hook for aligning selected bins to a common edge.
 *
 * Returns `alignBins(edge)` to execute the operation and `canAlign`
 * which is true when 2+ bins are selected (the minimum for alignment).
 */
export function useAlignBins() {
  const t = useTranslation();
  const { bins, layout, updateBin } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      layout: s.layout,
      updateBin: s.updateBin,
    }))
  );
  const selectedBinIds = useSelectionStore((s) => s.selectedBinIds);
  const addToast = useToastStore((s) => s.addToast);

  const canAlign = selectedBinIds.length >= 2;

  const alignBins = useCallback(
    (edge: AlignEdge) => {
      const results = computeAlignedPositions(bins, selectedBinIds, edge, layout);
      if (results.length === 0) return;

      const binMap = new Map(bins.map((b) => [b.id, b]));
      const movable = results.filter((r) => {
        if (r.skipped) return false;
        const bin = binMap.get(r.binId);
        return bin !== undefined && (r.newX !== bin.x || r.newY !== bin.y);
      });
      const skipped = results.filter((r) => r.skipped).length;
      const total = results.length;

      if (movable.length === 0 && skipped === 0) return; // all already at target

      if (movable.length > 0) {
        batch(() => {
          for (const r of movable) {
            updateBin(r.binId, { x: r.newX, y: r.newY });
          }
        });
      }

      const aligned = total - skipped;
      if (skipped > 0) {
        addToast({
          message: t('toast.alignSkipped', { aligned, total, skipped }),
          type: 'info',
          duration: 3000,
        });
      } else {
        addToast({
          message: t('toast.alignComplete', { aligned, total }),
          type: 'success',
          duration: 2000,
        });
      }
    },
    [bins, selectedBinIds, layout, updateBin, addToast, t]
  );

  return { alignBins, canAlign };
}
