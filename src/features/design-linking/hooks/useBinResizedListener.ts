/**
 * Listener for bin-resized events -- cascades dimension changes to linked designs and sibling bins.
 *
 * When a layout bin with a linked design is resized, this hook:
 * 1. Checks if the design has complex geometry (inserts, cutouts, custom compartments)
 *    -- if so, shows a BlockedResizeDialog and skips the design update
 * 2. Updates the design dimensions in IndexedDB + registry
 * 3. Cascades the new dimensions to all other bins linked to the same design
 *    -- if some can't fit, shows the SyncDimensionsDialog
 *
 * Mount once at app level (in DesignLinkingDialogs).
 */

import { useEffect, useRef } from 'react';
import { useUndoableAction, useToastStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useLatestRef, useLayoutRef } from '@/shared/hooks';
import {
  useCustomBins,
  useDesignerStore,
  loadDesign,
  updateDesignParams,
  upsertRegistryEntry,
} from '@/features/bin-designer';
import { isErr } from '@/core/result';
import { useTranslation } from '@/i18n';
import { onSyncEvent } from '../events';
import type { BinResizedEvent } from '../events';
import { useLinkingStore } from '../store';
import {
  hasComplexGeometry,
  getComplexityReasons,
  getBinsLinkedToDesign,
  dimensionsMatch,
  compareDimensions,
  extractBinDimensions,
  checkBatchSyncEligibility,
  createBinSyncUpdate,
} from '../domain';

export function useBinResizedListener(): void {
  const t = useTranslation();
  const { updateBin } = useMutations();
  const { execute } = useUndoableAction();
  const addToast = useToastStore((s) => s.addToast);
  const showSyncDialog = useLinkingStore((s) => s.showSyncDialog);
  const showBlockedResizeDialog = useLinkingStore((s) => s.showBlockedResizeDialog);
  const showDesignerUpdatedDialog = useLinkingStore((s) => s.showDesignerUpdatedDialog);
  const registry = useCustomBins();

  const layoutRef = useLayoutRef();
  const tRef = useLatestRef(t);
  const updateBinRef = useLatestRef(updateBin);
  const executeRef = useLatestRef(execute);
  const addToastRef = useLatestRef(addToast);
  const showSyncDialogRef = useLatestRef(showSyncDialog);
  const showBlockedResizeDialogRef = useLatestRef(showBlockedResizeDialog);
  const showDesignerUpdatedDialogRef = useLatestRef(showDesignerUpdatedDialog);
  const registryRef = useLatestRef(registry);

  // Guard against concurrent processing of the same design
  const inFlightDesigns = useRef(new Set<string>());

  useEffect(() => {
    return onSyncEvent<BinResizedEvent>('bin-resized', (event) => {
      void handleBinResized(event);
    });

    async function handleBinResized(event: BinResizedEvent): Promise<void> {
      const { binId, linkedDesignId, newDimensions } = event;

      // Skip if already processing this design (prevents concurrent IDB writes)
      if (inFlightDesigns.current.has(linkedDesignId)) return;

      // If the designer is currently open for this design, push dimensions
      // directly into the designer store. This triggers auto-save naturally,
      // which persists to IDB and emits `design-saved` for sibling cascade.
      if (useDesignerStore.getState().currentDesignId === linkedDesignId) {
        const designerSetParams = useDesignerStore.getState().setParams;
        designerSetParams({
          width: newDimensions.width,
          depth: newDimensions.depth,
          height: newDimensions.height,
        });

        const designName =
          registryRef.current.find((r) => r.id === linkedDesignId)?.name ?? linkedDesignId;
        showDesignerUpdatedDialogRef.current(linkedDesignId, designName);
        return;
      }

      inFlightDesigns.current.add(linkedDesignId);

      try {
        // Load the full design from IndexedDB
        const designResult = await loadDesign(linkedDesignId);
        if (isErr(designResult)) {
          addToastRef.current({
            message: tRef.current('designLinking.toast.failedToLoad'),
            type: 'error',
            duration: 3000,
          });
          return;
        }

        const design = designResult.value;
        const designName =
          registryRef.current.find((r) => r.id === linkedDesignId)?.name ?? design.name;

        // Check for complex geometry -- block if present
        if (hasComplexGeometry(design.params)) {
          const reasons = getComplexityReasons(design.params);
          showBlockedResizeDialogRef.current(binId, linkedDesignId, designName, reasons);
          return;
        }

        // Update design dimensions in IndexedDB.
        // Writes directly to IDB, bypassing the designer store,
        // so useAutoSave won't fire and we avoid a reentrancy loop.
        const newParams = {
          ...design.params,
          width: newDimensions.width,
          depth: newDimensions.depth,
          height: newDimensions.height,
        };

        const updateResult = await updateDesignParams(linkedDesignId, newParams);
        if (isErr(updateResult)) {
          addToastRef.current({
            message: tRef.current('designLinking.toast.designUpdateFailed'),
            type: 'error',
            duration: 3000,
          });
          return;
        }

        // Update the lightweight registry
        upsertRegistryEntry({
          id: updateResult.value.id,
          name: updateResult.value.name,
          width: newDimensions.width,
          depth: newDimensions.depth,
          height: newDimensions.height,
          updatedAt: updateResult.value.updatedAt,
        });

        // Cascade to sibling bins (other bins linked to the same design)
        const layout = layoutRef.current;
        const allSiblings = getBinsLinkedToDesign(layout.bins, linkedDesignId).filter(
          (b) => b.id !== binId
        );

        // Only cascade to siblings whose dimensions actually differ
        const siblingBins = allSiblings.filter(
          (b) => !dimensionsMatch(extractBinDimensions(b), newDimensions)
        );

        if (siblingBins.length === 0) {
          addToastRef.current({
            message: tRef.current('designLinking.toast.designUpdated', { name: designName }),
            type: 'success',
            duration: 2000,
          });
          return;
        }

        // Check eligibility for sibling bins that need syncing
        const eligibility = checkBatchSyncEligibility(siblingBins, newDimensions, layout);
        const allEligible = eligibility.every((e) => e.canSync);

        if (allEligible) {
          const syncUpdate = createBinSyncUpdate(newDimensions);
          executeRef.current(() => {
            for (const bin of siblingBins) {
              updateBinRef.current(bin.id, syncUpdate);
            }
          });

          addToastRef.current({
            message: tRef.current('designLinking.toast.cascadedResize', {
              count: siblingBins.length,
            }),
            type: 'success',
            duration: 2000,
          });
        } else {
          // Some siblings can't fit -- show sync dialog
          const comparison = compareDimensions(newDimensions, extractBinDimensions(siblingBins[0]));
          const siblingIds = siblingBins.map((b) => b.id);

          showSyncDialogRef.current(
            siblingIds,
            linkedDesignId,
            designName,
            comparison,
            eligibility,
            false
          );
        }
      } finally {
        inFlightDesigns.current.delete(linkedDesignId);
      }
    }
  }, [
    layoutRef,
    tRef,
    updateBinRef,
    executeRef,
    addToastRef,
    showSyncDialogRef,
    showBlockedResizeDialogRef,
    showDesignerUpdatedDialogRef,
    registryRef,
  ]);
}
