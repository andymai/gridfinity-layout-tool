import { useEffect, useCallback } from 'react';
import {
  useLayoutStore,
  useHistoryStore,
  useLibraryStore,
  useUndoableAction,
  useToastStore,
  useSelectionStore,
  useInteractionStore,
  useViewStore,
  useHalfBinModeStore,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { canPlaceBin } from '@/shared/utils/validation';
import { validateBinRotation } from '@/utils/binLocation';
import { validateHalfBinModeToggle } from '@/utils/halfBinConstraints';
import { SHORTCUTS, STAGING_ID, hasFractionalDimensions } from '@/core/constants';
import { useGridNavigation } from '@/features/grid-editor/hooks/useGridNavigation';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';

/**
 * Check if a key matches any shortcut in a readonly array.
 * This helper handles the type widening needed for `as const` tuple types.
 */
function isShortcut(key: string, shortcuts: readonly string[]): boolean {
  return shortcuts.includes(key);
}

/**
 * Hook for global keyboard shortcut handling in the layout editor.
 *
 * Handles all keyboard interactions except when focus is in input/textarea elements.
 * Automatically registers and cleans up event listeners.
 *
 * ## Supported Shortcuts
 *
 * **Selection & Editing:**
 * - Delete/Backspace: Delete selected bins
 * - Escape: Clear selection and exit paint mode
 * - Ctrl+D: Duplicate selected bins
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 *
 * **Navigation:**
 * - Arrow keys: Move selected bins (nudge) or navigate between bins (when focused)
 * - W/S: Navigate layers (up/down)
 * - A/D: Cycle through bins on current layer
 * - +/-: Zoom in/out
 *
 * **Bin Operations:**
 * - [/]: Cycle category of selected bins, or cycle active drawing category if no bin selected
 * - L: Open quick label popover for selected bin
 *
 * @example
 * ```tsx
 * function GridEditor() {
 *   // Register keyboard shortcuts globally
 *   useKeyboard();
 *
 *   return <GridCanvas />;
 * }
 * ```
 */
export function useKeyboard() {
  // Selection store
  const selectedBinIds = useSelectionStore((state) => state.selectedBinIds);
  const focusedBinId = useSelectionStore((state) => state.focusedBinId);
  const setSelectedBins = useSelectionStore((state) => state.setSelectedBins);
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);
  const setActiveLayer = useSelectionStore((state) => state.setActiveLayer);
  const showQuickLabel = useSelectionStore((state) => state.showQuickLabel);
  const activeCategoryId = useSelectionStore((state) => state.activeCategoryId);
  const setActiveCategory = useSelectionStore((state) => state.setActiveCategory);

  // Interaction store
  const setInteraction = useInteractionStore((state) => state.setInteraction);
  const setPaintSize = useInteractionStore((state) => state.setPaintSize);

  // View store
  const zoomIn = useViewStore((state) => state.zoomIn);
  const zoomOut = useViewStore((state) => state.zoomOut);

  // Half-bin mode store
  const toggleHalfBinMode = useHalfBinModeStore((state) => state.toggleHalfBinMode);

  const setShowLayoutManager = useLibraryStore((state) => state.setShowLayoutManager);
  const addToast = useToastStore((state) => state.addToast);

  // Grid navigation hook for spatial arrow key navigation
  const { handleNavigationKey } = useGridNavigation();

  const layout = useLayoutStore((state) => state.layout);
  const { deleteBin, duplicateBin, updateBin } = useMutations();

  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);

  const { execute } = useUndoableAction();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (isShortcut(key, SHORTCUTS.DELETE) && selectedBinIds.length > 0) {
        e.preventDefault();
        // Track deletion BEFORE executing (need bin data)
        const binsToDelete = selectedBinIds
          .map((id) => layout.bins.find((b) => b.id === id))
          .filter((b): b is (typeof layout.bins)[number] => b !== undefined);
        if (binsToDelete.length > 0) {
          mlTracking.trackDeletion(binsToDelete[0], 'key', binsToDelete.length);
          // Check for quick-correction (deleted shortly after creation)
          for (const bin of binsToDelete) {
            mlTracking.trackQuickCorrect('delete', bin.id, bin);
          }
        }
        execute(() => {
          for (const binId of selectedBinIds) {
            deleteBin(binId);
          }
        });
        setSelectedBins([]);
        return;
      }

      if (isShortcut(key, SHORTCUTS.ESCAPE)) {
        e.preventDefault();
        setInteraction(null);
        setSelectedBins([]);
        setPaintSize(null);
        return;
      }

      if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.UNDO && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      if (
        ctrlOrMeta &&
        (key.toLowerCase() === SHORTCUTS.REDO || (key === SHORTCUTS.REDO_ALT && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Open layout manager (Ctrl+O)
      if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.LAYOUT_MANAGER) {
        e.preventDefault();
        setShowLayoutManager(true);
        return;
      }

      // Duplicate all selected bins (Ctrl+D)
      if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.DUPLICATE && selectedBinIds.length > 0) {
        e.preventDefault();
        execute(() => {
          const newIds: string[] = [];
          for (const binId of selectedBinIds) {
            const result = duplicateBin(binId);
            if (isOk(result)) {
              newIds.push(result.value);
              // Track for ML telemetry
              const newBin = useLayoutStore
                .getState()
                .layout.bins.find((b) => b.id === result.value);
              if (newBin) {
                mlTracking.trackPlacement(newBin, 'duplicate');
              }
            }
          }
          // Select the duplicated bins
          if (newIds.length > 0) {
            setSelectedBins(newIds);
          }
        });
        return;
      }

      // Rotate selected bin (R) - swap width and depth (standalone key, no Ctrl/Cmd)
      if (key.toLowerCase() === SHORTCUTS.ROTATE && !ctrlOrMeta && selectedBinIds.length === 1) {
        e.preventDefault();
        const bin = layout.bins.find((b) => b.id === selectedBinIds[0]);
        if (!bin) return;

        const result = validateBinRotation(bin, layout);
        if (!result.valid) {
          addToast(result.message, 'error');
          return;
        }

        // Rotation is valid, perform it
        execute(() => {
          updateBin(bin.id, { width: bin.depth, depth: bin.width });
        });
        return;
      }

      // Zoom
      if (isShortcut(key, SHORTCUTS.ZOOM_IN)) {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (isShortcut(key, SHORTCUTS.ZOOM_OUT)) {
        e.preventDefault();
        zoomOut();
        return;
      }

      // Layer navigation (W/S)
      if (key.toLowerCase() === SHORTCUTS.LAYER_UP && !ctrlOrMeta) {
        e.preventDefault();
        const currentIndex = layout.layers.findIndex((l) => l.id === activeLayerId);
        if (currentIndex < layout.layers.length - 1) {
          setActiveLayer(layout.layers[currentIndex + 1].id);
        }
        return;
      }
      if (key.toLowerCase() === SHORTCUTS.LAYER_DOWN && !ctrlOrMeta) {
        e.preventDefault();
        const currentIndex = layout.layers.findIndex((l) => l.id === activeLayerId);
        if (currentIndex > 0) {
          setActiveLayer(layout.layers[currentIndex - 1].id);
        }
        return;
      }

      // Bin selection cycling (A/D) - cycles through bins on current layer
      if (key.toLowerCase() === SHORTCUTS.SELECT_PREV_BIN && !ctrlOrMeta) {
        e.preventDefault();
        const layerBins = layout.bins
          .filter((b) => b.layerId === activeLayerId && b.layerId !== STAGING_ID)
          .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y)); // Sort by row then column
        if (layerBins.length === 0) return;

        const currentId = selectedBinIds[0];
        const currentIndex = layerBins.findIndex((b) => b.id === currentId);
        const prevIndex = currentIndex <= 0 ? layerBins.length - 1 : currentIndex - 1;
        setSelectedBins([layerBins[prevIndex].id]);
        return;
      }
      if (key.toLowerCase() === SHORTCUTS.SELECT_NEXT_BIN && !ctrlOrMeta) {
        e.preventDefault();
        const layerBins = layout.bins
          .filter((b) => b.layerId === activeLayerId && b.layerId !== STAGING_ID)
          .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y)); // Sort by row then column
        if (layerBins.length === 0) return;

        const currentId = selectedBinIds[0];
        const currentIndex = layerBins.findIndex((b) => b.id === currentId);
        const nextIndex =
          currentIndex < 0 || currentIndex >= layerBins.length - 1 ? 0 : currentIndex + 1;
        setSelectedBins([layerBins[nextIndex].id]);
        return;
      }

      // Category cycling ([ / ]) - cycles category of selected bins, or active drawing category if none selected
      if (key === SHORTCUTS.CATEGORY_PREV || key === SHORTCUTS.CATEGORY_NEXT) {
        e.preventDefault();
        const categories = layout.categories;
        if (categories.length === 0) return;

        const direction = key === SHORTCUTS.CATEGORY_NEXT ? 1 : -1;

        if (selectedBinIds.length > 0) {
          // Change category of selected bins
          const firstBin = layout.bins.find((b) => b.id === selectedBinIds[0]);
          if (!firstBin) return;

          // Ring: [undefined, cat[0], cat[1], ..., cat[n-1]] — position 0 = no category
          const ringSize = categories.length + 1;
          const currentPos = firstBin.category
            ? categories.findIndex((c) => c.id === firstBin.category) + 1
            : 0;
          const nextPos = (currentPos + direction + ringSize) % ringSize;
          const newCategoryId = nextPos === 0 ? undefined : categories[nextPos - 1].id;

          // Filter to only bins that actually change
          const binsToUpdate = selectedBinIds
            .map((id) => layout.bins.find((b) => b.id === id))
            .filter(
              (bin): bin is (typeof layout.bins)[number] => !!bin && bin.category !== newCategoryId
            );
          if (binsToUpdate.length === 0) return;

          const batchSize = binsToUpdate.length;
          const newCategory = newCategoryId
            ? categories.find((c) => c.id === newCategoryId)
            : undefined;

          execute(() => {
            for (const bin of binsToUpdate) {
              updateBin(bin.id, { category: newCategoryId });
            }
          });

          // Track once per batch (not per bin)
          if (newCategory && binsToUpdate.length > 0) {
            mlTracking.trackCategory(binsToUpdate[0], newCategory.name, batchSize);
          }
        } else {
          // Cycle active drawing category (no "no category" option for drawing)
          const currentIndex = categories.findIndex((c) => c.id === activeCategoryId);
          const baseIndex =
            currentIndex === -1
              ? direction === 1
                ? 0
                : categories.length - 1
              : (currentIndex + direction + categories.length) % categories.length;
          setActiveCategory(categories[baseIndex].id);
        }
        return;
      }

      // L key - open quick label popover for selected bin
      if (
        key.toLowerCase() === SHORTCUTS.QUICK_LABEL &&
        !ctrlOrMeta &&
        selectedBinIds.length === 1
      ) {
        e.preventDefault();
        showQuickLabel(selectedBinIds[0]);
        return;
      }

      // H key - toggle half-bin mode (with validation)
      if (key.toLowerCase() === SHORTCUTS.HALF_BIN_TOGGLE && !ctrlOrMeta) {
        e.preventDefault();

        const result = toggleHalfBinMode();

        if (!result.success) {
          // Validation failed - show toast notification
          const validationResult = validateHalfBinModeToggle(layout, false);
          if (validationResult.violation) {
            addToast(
              `Cannot disable half-bin mode: ${validationResult.violation.count} bin${validationResult.violation.count !== 1 ? 's have' : ' has'} fractional dimensions. Move them to staging first.`,
              'error'
            );
          }
        }

        return;
      }

      // Arrow keys - spatial navigation OR nudge
      const arrowKeys: readonly string[] = [
        SHORTCUTS.NUDGE_UP,
        SHORTCUTS.NUDGE_DOWN,
        SHORTCUTS.NUDGE_LEFT,
        SHORTCUTS.NUDGE_RIGHT,
      ];
      if (arrowKeys.includes(key)) {
        e.preventDefault();

        // If there's a focused bin but no selection, use spatial navigation
        if (focusedBinId && selectedBinIds.length === 0) {
          handleNavigationKey(key);
          return;
        }

        // Otherwise, use existing nudge logic for selected bins
        if (selectedBinIds.length > 0) {
          // Check if any selected bins have fractional dimensions
          const selectedBins = selectedBinIds
            .map((id) => layout.bins.find((b) => b.id === id))
            .filter((b): b is (typeof layout.bins)[number] => b !== undefined);
          const increment = selectedBins.some((bin) => hasFractionalDimensions(bin)) ? 0.5 : 1;

          let dx = 0,
            dy = 0;
          if (key === SHORTCUTS.NUDGE_UP) dy = increment;
          if (key === SHORTCUTS.NUDGE_DOWN) dy = -increment;
          if (key === SHORTCUTS.NUDGE_LEFT) dx = -increment;
          if (key === SHORTCUTS.NUDGE_RIGHT) dx = increment;

          // Check if all bins can move
          const excludeIds = new Set(selectedBinIds);
          let allValid = true;

          for (const binId of selectedBinIds) {
            const bin = layout.bins.find((b) => b.id === binId);
            if (!bin || bin.layerId === STAGING_ID) {
              allValid = false;
              break;
            }

            const newX = bin.x + dx;
            const newY = bin.y + dy;

            const result = canPlaceBin(
              { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
              bin.layerId,
              layout,
              binId,
              excludeIds
            );

            if (!result.valid) {
              allValid = false;
              break;
            }
          }

          if (allValid) {
            // Track move BEFORE executing (capture old positions)
            const firstBin = selectedBins[0];
            if (firstBin) {
              const oldPosition = { x: firstBin.x, y: firstBin.y };
              // Track once per batch with representative data
              const newFirstBin = { ...firstBin, x: firstBin.x + dx, y: firstBin.y + dy };
              mlTracking.trackMove(newFirstBin, oldPosition, 'nudge', selectedBins.length);
            }

            execute(() => {
              for (const binId of selectedBinIds) {
                const bin = layout.bins.find((b) => b.id === binId);
                if (!bin) continue;
                updateBin(binId, { x: bin.x + dx, y: bin.y + dy });
              }
            });
          }
        }
        return;
      }
    },
    [
      selectedBinIds,
      focusedBinId,
      layout,
      canUndo,
      canRedo,
      undo,
      redo,
      zoomIn,
      zoomOut,
      deleteBin,
      duplicateBin,
      updateBin,
      setSelectedBins,
      setInteraction,
      setPaintSize,
      execute,
      handleNavigationKey,
      activeLayerId,
      setActiveLayer,
      showQuickLabel,
      activeCategoryId,
      setActiveCategory,
      toggleHalfBinMode,
      setShowLayoutManager,
      addToast,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
