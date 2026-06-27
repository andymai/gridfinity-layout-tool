/**
 * Action-handler map for every Command Palette command.
 *
 * Returns a `Record<commandId, () => void | null>`. `null` means the command
 * is unavailable in the current state (no selection, nothing to redo, etc.) —
 * the palette renders these as disabled rows.
 *
 * Most commands wrap a single store mutation; the few branchy ones live as
 * named local helpers (`cycleBinInLayer`, `cycleCategory`, `selectByCategory`,
 * `rotateBin`) so the bulk of the function reads as a flat record literal.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import {
  useLayoutStore,
  useSelectionStore,
  useViewStore,
  useHalfGridModeStore,
  useInteractionStore,
  useToastStore,
  useSharePopoverStore,
} from '@/core/store';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { batch } from '@/core/cqrs';
import { useMutations } from '@/shared/contexts';
import { useLayoutSwitcher } from '@/shared/hooks';
import { getStagingBins, getLayerBins } from '@/shared/utils';
import { findBinById } from '@/shared/utils/entity';
import { useAlignBins } from '@/shared/hooks/useAlignBins';
import { useSelectionActions } from '@/shared/hooks/useSelectionActions';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { isOk, isErr } from '@/core/result';
import type { BinId } from '@/core/types';
import { binId } from '@/core/types';

export type ActionHandler = (() => void) | null;

/**
 * Dispatch a CustomEvent on window — used to bridge to host shells. An optional
 * `detail` payload is passed through; without it the event's `detail` is `null`,
 * so listeners must read it defensively (e.g. `e.detail?.foo`).
 */
export function dispatchWindowEvent(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));
}

/**
 * Build the action-handler map. Memoized so command-palette re-renders
 * don't churn the dependency graph; the dep list captures every store
 * slice and mutation read inside.
 */
export function useActionHandlers(): Record<string, ActionHandler> {
  const t = useTranslation();

  // Gate designer-only commands (bin defaults) to the /designer route.
  const { isDesignerRoute } = useDesignerRouting();

  const layout = useLayoutStore((s) => s.layout);
  const { undo, redo, canUndo, canRedo } = useHistoryStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
    }))
  );
  const {
    selectedBinIds,
    setSelectedBins,
    activeLayerId,
    setActiveLayer,
    showQuickLabel,
    activeCategoryId,
    setActiveCategory,
  } = useSelectionStore(
    useShallow((s) => ({
      selectedBinIds: s.selectedBinIds,
      setSelectedBins: s.setSelectedBins,
      activeLayerId: s.activeLayerId,
      setActiveLayer: s.setActiveLayer,
      showQuickLabel: s.showQuickLabel,
      activeCategoryId: s.activeCategoryId,
      setActiveCategory: s.setActiveCategory,
    }))
  );
  const {
    zoomIn,
    zoomOut,
    toggleShowOtherLayers,
    setPrintModalOpen,
    setShowLayoutManager,
    showIsometricPreview,
    toggleIsometricPreview,
    togglePreviewExpanded,
  } = useViewStore(
    useShallow((s) => ({
      zoomIn: s.zoomIn,
      zoomOut: s.zoomOut,
      toggleShowOtherLayers: s.toggleShowOtherLayers,
      setPrintModalOpen: s.setPrintModalOpen,
      setShowLayoutManager: s.setShowLayoutManager,
      showIsometricPreview: s.showIsometricPreview,
      toggleIsometricPreview: s.toggleIsometricPreview,
      togglePreviewExpanded: s.togglePreviewExpanded,
    }))
  );
  const { toggleHalfGridMode, halfGridMode } = useHalfGridModeStore(
    useShallow((s) => ({
      toggleHalfGridMode: s.toggleHalfGridMode,
      halfGridMode: s.halfGridMode,
    }))
  );
  const setInteraction = useInteractionStore((s) => s.setInteraction);
  const paintSize = useInteractionStore((s) => s.paintSize);
  const setPaintSize = useInteractionStore((s) => s.setPaintSize);
  const addToast = useToastStore((s) => s.addToast);
  const { fillLayerGaps, fillLayer } = useLayoutStore(
    useShallow((s) => ({
      fillLayerGaps: s.fillLayerGaps,
      fillLayer: s.fillLayer,
    }))
  );
  const { deleteBin, duplicateBin, updateBin, moveBinToStaging, addLayer } = useMutations();
  const { createNewLayout, duplicateLayout, activeLayoutId } = useLayoutSwitcher();
  const { alignBins } = useAlignBins();
  const { rotateAll, matchHeight } = useSelectionActions();

  return useMemo(() => {
    const hasBinsSelected = selectedBinIds.length > 0;
    const hasSingleBin = selectedBinIds.length === 1;
    const hasMultipleBins = selectedBinIds.length >= 2;
    const layerBins = getLayerBins(layout.bins, activeLayerId);
    const stagingBins = getStagingBins(layout.bins);
    const categories = layout.categories;

    function clearSelection(): void {
      setSelectedBins([]);
      setInteraction(null);
    }

    function cycleBinInLayer(direction: 1 | -1): ActionHandler {
      // Copy before sort: Array.prototype.sort is in-place; mutating the
      // shared `layerBins` reference would persist across the two cycle
      // calls (-1 and 1) and confuse any other consumer inside this useMemo.
      const sorted = [...layerBins].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
      if (sorted.length === 0) return null;
      const currentId = selectedBinIds[0];
      const currentIndex = sorted.findIndex((b) => b.id === currentId);
      const nextIndex =
        currentIndex < 0 ? 0 : (currentIndex + direction + sorted.length) % sorted.length;
      return () => setSelectedBins([sorted[nextIndex].id]);
    }

    function cycleCategory(direction: 1 | -1): ActionHandler {
      if (categories.length === 0) return null;

      if (hasBinsSelected) {
        const firstBin = findBinById(layout, selectedBinIds[0]);
        if (!firstBin) return null;

        return () => {
          const currentPos = categories.findIndex((c) => c.id === firstBin.category);
          const nextPos = (currentPos + direction + categories.length) % categories.length;
          const newCategoryId = categories[nextPos].id;

          batch(() => {
            for (const id of selectedBinIds) {
              const result = updateBin(id, { category: newCategoryId });
              if (isErr(result)) break;
            }
          });
          addToast(
            t('toast.categoryChanged', {
              count: selectedBinIds.length,
              name: categories[nextPos].name,
            }),
            'success'
          );
        };
      }

      // No selection: cycle active drawing category
      return () => {
        const currentIndex = categories.findIndex((c) => c.id === activeCategoryId);
        let nextIndex: number;
        if (currentIndex === -1) {
          nextIndex = direction === 1 ? 0 : categories.length - 1;
        } else {
          nextIndex = (currentIndex + direction + categories.length) % categories.length;
        }
        setActiveCategory(categories[nextIndex].id);
      };
    }

    const navigation: Record<string, ActionHandler> = {
      'open-layout-manager': () => setShowLayoutManager(true),
      'open-settings': () => dispatchWindowEvent('open-settings-modal'),
      'open-help': () => dispatchWindowEvent('open-help-modal'),
      'open-print': () => setPrintModalOpen(true),
      'send-feedback': () =>
        // noopener,noreferrer prevents reverse-tabnabbing — matches the
        // convention used elsewhere in the codebase for external links.
        window.open(
          'https://github.com/andymai/gridfinity-layout-tool/issues',
          '_blank',
          'noopener,noreferrer'
        ),
      'switch-to-designer': () => dispatchWindowEvent('switch-to-designer'),
      'open-bin-examples': () => {
        useBinExampleGalleryStore.getState().open();
      },
      'new-layout': () => {
        void createNewLayout();
      },
      'duplicate-layout': activeLayoutId
        ? () => {
            void duplicateLayout(activeLayoutId);
          }
        : null,
    };

    const rotateBin = (): ActionHandler => {
      if (!hasSingleBin) return null;
      const bin = findBinById(layout, selectedBinIds[0]);
      if (!bin) return null;
      return () => {
        batch(() => {
          const result = updateBin(bin.id, { width: bin.depth, depth: bin.width });
          if (isErr(result)) return;
        });
      };
    };

    const edit: Record<string, ActionHandler> = {
      undo: canUndo ? () => undo() : null,
      redo: canRedo ? () => redo() : null,
      'delete-selected': hasBinsSelected
        ? () => {
            batch(() => {
              for (const id of selectedBinIds) {
                const result = deleteBin(id);
                if (isErr(result)) break;
              }
            });
            // Selection cleanup handled by CQRS selectionPruning subscriber
          }
        : null,
      'duplicate-selected': hasBinsSelected
        ? () => {
            batch(() => {
              const newIds: BinId[] = [];
              for (const id of selectedBinIds) {
                const result = duplicateBin(id);
                if (isOk(result)) {
                  newIds.push(binId(result.value));
                }
              }
              if (newIds.length > 0) {
                setSelectedBins(newIds);
              }
            });
          }
        : null,
      'rotate-bin': rotateBin(),
      'quick-label': hasSingleBin ? () => showQuickLabel(selectedBinIds[0]) : null,
      'clear-selection': () => clearSelection(),
      'align-left': hasMultipleBins ? () => alignBins('left') : null,
      'align-right': hasMultipleBins ? () => alignBins('right') : null,
      'align-top': hasMultipleBins ? () => alignBins('top') : null,
      'align-bottom': hasMultipleBins ? () => alignBins('bottom') : null,
      'rotate-all': hasMultipleBins ? () => rotateAll() : null,
      'match-height': hasMultipleBins ? () => matchHeight() : null,
    };

    const invertedIds = (() => {
      if (layerBins.length === 0) return [];
      const currentSet = new Set(selectedBinIds);
      return layerBins.filter((b) => !currentSet.has(b.id)).map((b) => b.id);
    })();

    const selectByCategory = (): ActionHandler => {
      if (!hasBinsSelected) return null;
      const firstBin = findBinById(layout, selectedBinIds[0]);
      if (!firstBin) return null;
      const sameCategoryBins = layout.bins
        .filter((b) => b.layerId === activeLayerId && b.category === firstBin.category)
        .map((b) => b.id);
      const category = categories.find((c) => c.id === firstBin.category);
      return () => {
        setSelectedBins(sameCategoryBins);
        addToast(
          t('toast.selectedByCategory', {
            count: sameCategoryBins.length,
            name: category?.name || 'category',
          }),
          'info'
        );
      };
    };

    const selection: Record<string, ActionHandler> = {
      'select-all':
        layerBins.length > 0
          ? () => {
              setSelectedBins(layerBins.map((b) => b.id));
              addToast(t('toast.selectedAll', { count: layerBins.length }), 'info');
            }
          : null,
      'select-none': hasBinsSelected ? () => clearSelection() : null,
      'invert-selection':
        layerBins.length > 0 && invertedIds.length > 0
          ? () => {
              setSelectedBins(invertedIds);
              addToast(t('toast.selectionInverted', { count: invertedIds.length }), 'info');
            }
          : null,
      'select-by-category': selectByCategory(),
    };

    const currentLayerIndex = layout.layers.findIndex((l) => l.id === activeLayerId);

    const layers: Record<string, ActionHandler> = {
      'add-layer': () => {
        const result = addLayer();
        if (isOk(result)) {
          setActiveLayer(result.value);
        } else {
          addToast(t('layers.maxLayersReached', { max: 10 }), 'error');
        }
      },
      'layer-up':
        currentLayerIndex < layout.layers.length - 1
          ? () => setActiveLayer(layout.layers[currentLayerIndex + 1].id)
          : null,
      'layer-down':
        currentLayerIndex > 0
          ? () => setActiveLayer(layout.layers[currentLayerIndex - 1].id)
          : null,
      'clear-layer': () => {
        if (layerBins.length === 0) return;
        batch(() => {
          for (const b of layerBins) {
            const result = deleteBin(b.id);
            if (isErr(result)) break;
          }
        });
      },
    };

    const view: Record<string, ActionHandler> = {
      'zoom-in': () => zoomIn(),
      'zoom-out': () => zoomOut(),
      'fit-to-screen': () => dispatchWindowEvent('fit-to-screen'),
      'toggle-other-layers': () => toggleShowOtherLayers(),
    };

    const preview: Record<string, ActionHandler> = {
      'toggle-preview': () => toggleIsometricPreview(),
      'expand-preview': showIsometricPreview ? () => togglePreviewExpanded() : null,
    };

    const bins: Record<string, ActionHandler> = {
      'prev-bin': cycleBinInLayer(-1),
      'next-bin': cycleBinInLayer(1),
      'prev-category': cycleCategory(-1),
      'next-category': cycleCategory(1),
      // Bin-designer defaults. "Current settings" only exists in the designer,
      // so these are unavailable elsewhere. The action map can't import the
      // bin-designer feature (cross-feature boundary), so it bridges via a
      // window event that `DesignerPage` listens for.
      'set-bin-default': isDesignerRoute
        ? () => dispatchWindowEvent('bin-designer:set-default')
        : null,
      'reset-bin-default': isDesignerRoute
        ? () => dispatchWindowEvent('bin-designer:reset-default')
        : null,
      'move-to-stash': hasBinsSelected
        ? () => {
            batch(() => {
              for (const id of selectedBinIds) {
                if (isErr(moveBinToStaging(id))) break;
              }
            });
            addToast(t('toast.movedToStash', { count: selectedBinIds.length }), 'info');
            // Selection cleanup handled by CQRS selectionPruning subscriber
          }
        : null,
      'clear-staging':
        stagingBins.length > 0
          ? () => {
              batch(() => {
                for (const bin of stagingBins) {
                  const result = deleteBin(bin.id);
                  if (isErr(result)) break;
                }
              });
              addToast(t('toast.stagingCleared', { count: stagingBins.length }), 'success');
            }
          : null,
      'restore-from-staging':
        stagingBins.length > 0
          ? () => {
              batch(() => {
                for (const bin of stagingBins) {
                  const result = updateBin(bin.id, { layerId: activeLayerId });
                  if (isErr(result)) break;
                }
              });
              addToast(t('toast.restoredFromStaging', { count: stagingBins.length }), 'success');
            }
          : null,
    };

    const tools: Record<string, ActionHandler> = {
      'toggle-half-bin': () => {
        const result = toggleHalfGridMode();
        if (!isOk(result)) {
          addToast(t('halfBinBlocked.title'), 'error');
        }
      },
      'fill-gaps': () => fillLayerGaps(activeLayerId, activeCategoryId, halfGridMode),
      'toggle-paint-mode': () => {
        if (paintSize) {
          setPaintSize(null);
        } else {
          setPaintSize({ width: 1, depth: 1 });
          addToast(t('toast.paintModeEnabled'), 'info');
        }
      },
      'fill-layer': () => {
        const count = fillLayer(activeLayerId, 1, 1, activeCategoryId, halfGridMode);
        if (count > 0) {
          addToast(t('toast.layerFilled'), 'success');
        }
      },
    };

    const exportActions: Record<string, ActionHandler> = {
      'download-layout': () => dispatchWindowEvent('download-layout'),
      'copy-share-link': () => {
        useSharePopoverStore.getState().open();
      },
    };

    return {
      ...navigation,
      ...edit,
      ...selection,
      ...layers,
      ...view,
      ...preview,
      ...bins,
      ...tools,
      ...exportActions,
    };
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    selectedBinIds,
    layout,
    activeLayerId,
    activeCategoryId,
    activeLayoutId,
    showIsometricPreview,
    halfGridMode,
    paintSize,
    deleteBin,
    duplicateBin,
    updateBin,
    moveBinToStaging,
    addLayer,
    fillLayerGaps,
    fillLayer,
    createNewLayout,
    duplicateLayout,
    setPaintSize,
    setSelectedBins,
    setActiveLayer,
    setActiveCategory,
    setInteraction,
    setShowLayoutManager,
    setPrintModalOpen,
    toggleIsometricPreview,
    togglePreviewExpanded,
    toggleShowOtherLayers,
    showQuickLabel,
    toggleHalfGridMode,
    zoomIn,
    zoomOut,
    alignBins,
    rotateAll,
    matchHeight,
    addToast,
    t,
    isDesignerRoute,
  ]);
}
