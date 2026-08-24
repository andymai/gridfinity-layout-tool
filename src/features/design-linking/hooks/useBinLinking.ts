/**
 * Main hook for bin-design linking operations.
 *
 * Provides all linking actions: link, unlink, sync, navigate to designer, create design.
 * Uses undoable actions for reversible operations.
 */

import { useCallback } from 'react';
import { useLayoutStore, useToastStore } from '@/core/store';
import { batch } from '@/core/cqrs';
import { useMutations } from '@/shared/contexts';
import { useShallow } from 'zustand/react/shallow';
import {
  useCustomBins,
  loadDesign,
  deleteDesign,
  removeRegistryEntry,
  updateDesignParams,
  upsertRegistryEntry,
  registryEdgeFields,
  registryHeightFields,
  registryOverhangFields,
} from '@/features/bin-designer';
import { computeMatchedEdges, edgeForPosition } from '@/shared/utils/fractionalEdge';
import { isFractional } from '@/core/constants';
import { useLinkingStore } from '../store';
import {
  compareDimensions,
  extractBinDimensions,
  extractDesignDimensions,
  checkBatchSyncEligibility,
  createBinSyncUpdate,
  generateDefaultDesignName,
} from '../domain';
import type { BinId, DesignId, SyncResult } from '../types';
import { isErr, isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { dispatchSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';

interface UseBinLinkingReturn {
  /** Link a bin to a design (undoable) */
  linkBin: (binId: BinId, designId: DesignId) => void;

  /** Unlink a bin from its design (undoable) */
  unlinkBin: (binId: BinId) => void;

  /** Unlink multiple bins (undoable) */
  unlinkBins: (binIds: BinId[]) => void;

  /** Delete a design and unlink the bin */
  deleteLinkedDesign: (binId: BinId, designId: DesignId, designName: string) => Promise<boolean>;

  /** Navigate to designer to edit a linked design */
  editLinkedDesign: (designId: DesignId) => void;

  /** Show create design dialog for a bin */
  showCreateDesignDialog: (binId: BinId) => void;

  /** Check if dimensions differ and show sync prompt if needed */
  promptSyncIfNeeded: (binIds: BinId[], designId: DesignId) => Promise<void>;

  /** Execute sync from design to bins (undoable). Returns result summary. */
  executeSyncFromDesign: (binIds: BinId[], designId: DesignId) => Promise<SyncResult>;

  /** Navigate to designer to create new design with given dimensions and auto-link bin */
  navigateToCreateDesign: (
    binId: BinId,
    name: string,
    width: number,
    depth: number,
    height: number
  ) => void;

  /** Realign a linked design's fractional edge to where `binId` sits. */
  matchDesignEdgesToDrawer: (designId: DesignId, binId: BinId) => Promise<void>;
}

/**
 * Hook providing all bin-design linking operations.
 */
export function useBinLinking(): UseBinLinkingReturn {
  const t = useTranslation();
  const layout = useLayoutStore(useShallow((state) => state.layout));
  const { updateBin } = useMutations();
  const addToast = useToastStore((s) => s.addToast);
  const registry = useCustomBins();
  const {
    showSyncDialog,
    showCreateDesignDialog: showCreateDialog,
    hideCreateDesignDialog,
  } = useLinkingStore(
    useShallow((s) => ({
      showSyncDialog: s.showSyncDialog,
      showCreateDesignDialog: s.showCreateDesignDialog,
      hideCreateDesignDialog: s.hideCreateDesignDialog,
    }))
  );

  // Link a bin to a design
  const linkBin = useCallback(
    (binId: BinId, designId: DesignId) => {
      const bin = layout.bins.find((b) => b.id === binId);
      if (!bin) return;

      batch(() => {
        updateBin(binId, { linkedDesignId: designId });
      });

      const design = registry.find((r) => r.id === designId);
      if (design) {
        addToast({
          message: t('designLinking.toast.linked', { name: design.name }),
          type: 'success',
          duration: 2000,
        });
      }
    },
    [layout.bins, updateBin, registry, addToast, t]
  );

  // Unlink a bin from its design
  const unlinkBin = useCallback(
    (binId: BinId) => {
      const bin = layout.bins.find((b) => b.id === binId);
      if (!bin || !bin.linkedDesignId) return;

      batch(() => {
        updateBin(binId, { linkedDesignId: null });
      });

      addToast({
        message: t('designLinking.toast.unlinked'),
        type: 'info',
        duration: 2000,
      });
    },
    [layout.bins, updateBin, addToast, t]
  );

  // Unlink multiple bins
  const unlinkBins = useCallback(
    (binIds: BinId[]) => {
      batch(() => {
        for (const binId of binIds) {
          updateBin(binId, { linkedDesignId: null });
        }
      });
    },
    [updateBin]
  );

  // Navigate to designer to edit a design
  const editLinkedDesign = useCallback((designId: DesignId) => {
    window.history.pushState({ designId }, '', `/designer?id=${encodeURIComponent(designId)}`);
    dispatchSyntheticPopstate();
  }, []);

  // Show create design dialog for a bin
  const showCreateDesignDialog = useCallback(
    (binId: BinId) => {
      const bin = layout.bins.find((b) => b.id === binId);
      if (!bin) return;

      const dimensions = extractBinDimensions(bin);
      const defaultName = generateDefaultDesignName(dimensions);

      showCreateDialog(binId, defaultName, dimensions, bin.label || undefined);
    },
    [layout.bins, showCreateDialog]
  );

  // Check if sync is needed and show dialog if dimensions differ
  const promptSyncIfNeeded = useCallback(
    async (binIds: BinId[], designId: DesignId) => {
      const bins = layout.bins.filter((b) => binIds.includes(b.id));
      if (bins.length === 0) return;

      // Load design from IndexedDB
      const designResult = await loadDesign(designId);
      if (isErr(designResult)) {
        addToast({
          message: t('designLinking.toast.failedToLoad'),
          type: 'error',
          duration: 3000,
        });
        return;
      }

      const designName =
        registry.find((r) => r.id === designId)?.name ?? t('designLinking.toast.unknownDesign');
      if (!designResult.value.params) return;
      const designDims = extractDesignDimensions(designResult.value.params);
      const binDims = extractBinDimensions(bins[0]);
      const comparison = compareDimensions(designDims, binDims);

      // Check if bins have varying dimensions (for display in dialog)
      let binsHaveVaryingDimensions = false;
      if (bins.length > 1) {
        const firstDims = binDims;
        binsHaveVaryingDimensions = bins.some((bin) => {
          const dims = extractBinDimensions(bin);
          return (
            dims.width !== firstDims.width ||
            dims.depth !== firstDims.depth ||
            dims.height !== firstDims.height
          );
        });
      }

      if (comparison.matched && !binsHaveVaryingDimensions) {
        addToast({
          message: t('designLinking.toast.dimensionsMatch'),
          type: 'info',
          duration: 2000,
        });
        return;
      }

      // Check eligibility for each bin
      const eligibility = checkBatchSyncEligibility(bins, designDims, layout);

      showSyncDialog(
        binIds,
        designId,
        designName,
        comparison,
        eligibility,
        binsHaveVaryingDimensions
      );
    },
    [layout, registry, addToast, showSyncDialog, t]
  );

  // Execute sync from design to bins
  const executeSyncFromDesign = useCallback(
    async (binIds: BinId[], designId: DesignId): Promise<SyncResult> => {
      const bins = layout.bins.filter((b) => binIds.includes(b.id));
      const totalLinked = bins.length;

      const designResult = await loadDesign(designId);
      if (isErr(designResult)) {
        return { synced: [], unlinked: [], totalLinked };
      }

      if (!designResult.value.params) {
        return { synced: [], unlinked: [], totalLinked };
      }
      const designDims = extractDesignDimensions(designResult.value.params);
      const eligibility = checkBatchSyncEligibility(bins, designDims, layout);

      const synced: BinId[] = [];
      const unlinked: BinId[] = [];

      batch(() => {
        for (const elig of eligibility) {
          if (elig.canSync) {
            // Sync dimensions
            const syncUpdate = createBinSyncUpdate(designDims);
            updateBin(elig.binId, syncUpdate);
            synced.push(elig.binId);
          } else {
            // Unlink bin that can't sync
            updateBin(elig.binId, { linkedDesignId: null });
            unlinked.push(elig.binId);
          }
        }
      });

      // Show result toast
      if (synced.length > 0 && unlinked.length === 0) {
        addToast({
          message: t('designLinking.toast.synced', { count: synced.length }),
          type: 'success',
          duration: 2000,
        });
      } else if (synced.length > 0 && unlinked.length > 0) {
        addToast({
          message: t('designLinking.toast.syncedWithUnlink', {
            synced: synced.length,
            unlinked: unlinked.length,
          }),
          type: 'info',
          duration: 3000,
        });
      } else if (unlinked.length > 0) {
        addToast({
          message: t('designLinking.toast.unlinkedDidntFit', { count: unlinked.length }),
          type: 'info',
          duration: 3000,
        });
      }

      return { synced, unlinked, totalLinked };
    },
    [layout, updateBin, addToast, t]
  );

  // Navigate to designer to create new design and auto-link
  const navigateToCreateDesign = useCallback(
    (binId: BinId, name: string, width: number, depth: number, height: number) => {
      hideCreateDesignDialog();

      // Build URL with params for designer to create and link
      const params = new URLSearchParams({
        createFrom: 'bin',
        linkBin: binId,
        name,
        width: String(width),
        depth: String(depth),
        height: String(height),
      });

      // Carry the edge the bin's half cell actually lands on, so the new design
      // opens oriented the way the layout draws it. Derived from
      // the bin's position rather than the drawer's own fractional slot — those
      // differ whenever the drawer's size on that axis is a whole number.
      const bin = layout.bins.find((b) => b.id === binId);
      if (bin) {
        if (isFractional(width)) {
          params.set(
            'fractionalEdgeX',
            edgeForPosition(bin.x, layout.drawer.width, layout.drawer.fractionalEdgeX)
          );
        }
        if (isFractional(depth)) {
          params.set(
            'fractionalEdgeY',
            edgeForPosition(bin.y, layout.drawer.depth, layout.drawer.fractionalEdgeY)
          );
        }
      }

      window.history.pushState(null, '', `/designer?${params.toString()}`);
      dispatchSyntheticPopstate();
    },
    [hideCreateDesignDialog, layout.drawer, layout.bins]
  );

  // Realign a linked design's fractional edge to where its bin sits
  const matchDesignEdgesToDrawer = useCallback(
    async (designId: DesignId, binId: BinId): Promise<void> => {
      const designResult = await loadDesign(designId);
      if (isErr(designResult) || !designResult.value.params) {
        addToast({
          message: t('designLinking.toast.failedToLoad'),
          type: 'error',
          duration: 3000,
        });
        return;
      }

      // Read placements AFTER the load, and from the live store rather than the
      // render-time snapshot: bins can be moved, re-linked or unlinked while
      // IndexedDB is being read, and matching against where things used to be
      // would leave the design mismatched the moment the success toast appears.
      const live = useLayoutStore.getState().layout;
      // The originating bin must still be linked to this design — otherwise the
      // user unlinked or re-pointed it mid-read and we would be editing a
      // design on the strength of a placement that no longer belongs to it.
      if (!live.bins.some((b) => b.id === binId && b.linkedDesignId === designId)) return;

      // Every placement, not just the originating bin: `computeMatchedEdges`
      // resolves each axis across all of them and patches nothing when they
      // disagree, so a design shared by bins wanting opposite edges is left
      // alone rather than flipped toward whichever one was clicked.
      const placements = live.bins
        .filter((b) => b.linkedDesignId === designId)
        .map((b) => ({ x: b.x, y: b.y }));

      const params = designResult.value.params;
      const newParams = { ...params, ...computeMatchedEdges(params, live.drawer, placements) };

      const updateResult = await updateDesignParams(designId, newParams);
      if (isErr(updateResult)) {
        addToast({
          message: t('designLinking.toast.designUpdateFailed'),
          type: 'error',
          duration: 3000,
        });
        return;
      }

      upsertRegistryEntry({
        id: updateResult.value.id,
        name: updateResult.value.name,
        width: newParams.width,
        depth: newParams.depth,
        height: newParams.height,
        ...registryEdgeFields(newParams),
        ...registryHeightFields(newParams),
        ...registryOverhangFields(newParams),
        updatedAt: updateResult.value.updatedAt,
      });

      addToast({
        message: t('designLinking.toast.edgeMatched'),
        type: 'success',
        duration: 2000,
      });
    },
    [addToast, t]
  );

  // Delete a design and unlink the bin
  const deleteLinkedDesign = useCallback(
    async (binId: BinId, designId: DesignId, designName: string): Promise<boolean> => {
      // First unlink the bin
      batch(() => {
        updateBin(binId, { linkedDesignId: null });
      });

      // Then delete the design from storage
      const result = await deleteDesign(designId);
      if (isOk(result)) {
        removeRegistryEntry(designId);
        addToast({
          message: t('designLinking.toast.deleted', { name: designName }),
          type: 'success',
          duration: 3000,
        });
        return true;
      } else {
        addToast({
          message: t('designLinking.toast.deleteFailed'),
          type: 'error',
          duration: 4000,
        });
        return false;
      }
    },
    [updateBin, addToast, t]
  );

  return {
    linkBin,
    unlinkBin,
    unlinkBins,
    deleteLinkedDesign,
    editLinkedDesign,
    showCreateDesignDialog,
    promptSyncIfNeeded,
    executeSyncFromDesign,
    navigateToCreateDesign,
    matchDesignEdgesToDrawer,
  };
}
