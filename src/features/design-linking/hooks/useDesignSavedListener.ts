/**
 * Listener for design-saved events -- auto-syncs design dimensions to linked bins.
 *
 * When a design is saved (via useAutoSave in bin-designer) with changed dimensions,
 * this hook automatically propagates those dimensions to all linked layout bins.
 * If some bins can't fit the new dimensions (out of bounds or collision),
 * the existing SyncDimensionsDialog is shown for user confirmation.
 *
 * Mount once at app level (in DesignLinkingDialogs).
 *
 * On mount, performs a one-time reconciliation: checks all linked bins against the
 * CustomBinRegistry to catch design changes that occurred while the listener was
 * unmounted (e.g. during navigation to the bin designer route).
 */

import { useEffect } from 'react';
import { useUndoableAction, useToastStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useLatestRef, useLayoutRef } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { useCustomBins } from '@/features/bin-designer/hooks/useCustomBins';
import { onSyncEvent } from '../events';
import type { DesignSavedEvent } from '../events';
import { useLinkingStore } from '../store';
import {
  getLinkedDesignIds,
  getBinsLinkedToDesign,
  dimensionsMatch,
  extractBinDimensions,
  compareDimensions,
  checkBatchSyncEligibility,
  createBinSyncUpdate,
} from '../domain';

export function useDesignSavedListener(): void {
  const t = useTranslation();
  const { updateBin } = useMutations();
  const { execute } = useUndoableAction();
  const addToast = useToastStore((s) => s.addToast);
  const showSyncDialog = useLinkingStore((s) => s.showSyncDialog);
  const registry = useCustomBins();

  const layoutRef = useLayoutRef();
  const tRef = useLatestRef(t);
  const updateBinRef = useLatestRef(updateBin);
  const executeRef = useLatestRef(execute);
  const addToastRef = useLatestRef(addToast);
  const showSyncDialogRef = useLatestRef(showSyncDialog);
  const registryRef = useLatestRef(registry);

  useEffect(() => {
    function handleDesignSaved(event: Pick<DesignSavedEvent, 'designId' | 'dimensions'>): void {
      const layout = layoutRef.current;
      const linkedBins = getBinsLinkedToDesign(layout.bins, event.designId);
      if (linkedBins.length === 0) return;

      const binsNeedingSync = linkedBins.filter(
        (bin) => !dimensionsMatch(extractBinDimensions(bin), event.dimensions)
      );
      if (binsNeedingSync.length === 0) return;

      const eligibility = checkBatchSyncEligibility(binsNeedingSync, event.dimensions, layout);
      const allEligible = eligibility.every((e) => e.canSync);

      if (allEligible) {
        const syncUpdate = createBinSyncUpdate(event.dimensions);
        executeRef.current(() => {
          for (const bin of binsNeedingSync) {
            updateBinRef.current(bin.id, syncUpdate);
          }
        });

        addToastRef.current({
          message: tRef.current('designLinking.toast.autoSynced', {
            count: binsNeedingSync.length,
          }),
          type: 'success',
          duration: 2000,
        });
        return;
      }

      // Some bins can't fit -- show the sync dialog
      const comparison = compareDimensions(
        event.dimensions,
        extractBinDimensions(binsNeedingSync[0])
      );
      const binIds = linkedBins.map((b) => b.id);

      const binsHaveVaryingDimensions =
        linkedBins.length > 1 &&
        linkedBins.some((bin) => {
          const dims = extractBinDimensions(bin);
          const first = extractBinDimensions(linkedBins[0]);
          return (
            dims.width !== first.width || dims.depth !== first.depth || dims.height !== first.height
          );
        });

      const designName =
        registryRef.current.find((r) => r.id === event.designId)?.name ?? event.designId;

      showSyncDialogRef.current(
        binIds,
        event.designId,
        designName,
        comparison,
        // Re-check all linked bins (not just those needing sync) for the dialog
        checkBatchSyncEligibility(linkedBins, event.dimensions, layout),
        binsHaveVaryingDimensions
      );
    }

    // Subscribe first so no events are dropped during reconciliation
    const unsubscribe = onSyncEvent<DesignSavedEvent>('design-saved', handleDesignSaved);

    // Reconcile on mount: catch design changes that happened while the listener was unmounted.
    // Safe to run after subscribing because handleDesignSaved is idempotent (dimensionsMatch guard).
    const layout = layoutRef.current;
    const designIds = getLinkedDesignIds(layout.bins);
    for (const designId of designIds) {
      const ref = registryRef.current.find((r) => r.id === designId);
      if (ref) {
        handleDesignSaved({
          designId,
          dimensions: { width: ref.width, depth: ref.depth, height: ref.height },
        });
      }
    }

    return unsubscribe;
  }, [layoutRef, tRef, updateBinRef, executeRef, addToastRef, showSyncDialogRef, registryRef]);
}
