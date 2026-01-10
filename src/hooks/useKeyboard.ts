import { useEffect, useCallback } from 'react';
import { useUIStore, useLayoutStore, useHistoryStore, useUndoableAction } from '../store';
import { canPlaceBin } from '../utils/validation';
import { SHORTCUTS, STAGING_ID } from '../constants';
import { useGridNavigation } from './useGridNavigation';

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
  const selectedBinIds = useUIStore(state => state.selectedBinIds);
  const focusedBinId = useUIStore(state => state.focusedBinId);
  const setSelectedBins = useUIStore(state => state.setSelectedBins);
  const setInteraction = useUIStore(state => state.setInteraction);
  const setPaintSize = useUIStore(state => state.setPaintSize);
  const zoomIn = useUIStore(state => state.zoomIn);
  const zoomOut = useUIStore(state => state.zoomOut);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const setActiveLayer = useUIStore(state => state.setActiveLayer);
  const showQuickLabel = useUIStore(state => state.showQuickLabel);
  const activeCategoryId = useUIStore(state => state.activeCategoryId);
  const setActiveCategory = useUIStore(state => state.setActiveCategory);

  // Grid navigation hook for spatial arrow key navigation
  const { handleNavigationKey } = useGridNavigation();

  const layout = useLayoutStore(state => state.layout);
  const deleteBin = useLayoutStore(state => state.deleteBin);
  const duplicateBin = useLayoutStore(state => state.duplicateBin);
  const updateBin = useLayoutStore(state => state.updateBin);

  const undo = useHistoryStore(state => state.undo);
  const redo = useHistoryStore(state => state.redo);
  const canUndo = useHistoryStore(state => state.canUndo);
  const canRedo = useHistoryStore(state => state.canRedo);

  const { execute } = useUndoableAction();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Delete all selected bins
    if (isShortcut(key, SHORTCUTS.DELETE) && selectedBinIds.length > 0) {
      e.preventDefault();
      execute(() => {
        for (const binId of selectedBinIds) {
          deleteBin(binId);
        }
      });
      setSelectedBins([]);
      return;
    }

    // Escape - clear selection and exit paint mode
    if (isShortcut(key, SHORTCUTS.ESCAPE)) {
      e.preventDefault();
      setInteraction(null);
      setSelectedBins([]);
      setPaintSize(null);
      return;
    }

    // Undo
    if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.UNDO && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) undo();
      return;
    }

    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if (ctrlOrMeta && (key.toLowerCase() === SHORTCUTS.REDO || (key === SHORTCUTS.REDO_ALT && e.shiftKey))) {
      e.preventDefault();
      if (canRedo) redo();
      return;
    }

    // Duplicate all selected bins (Ctrl+D)
    if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.DUPLICATE && selectedBinIds.length > 0) {
      e.preventDefault();
      execute(() => {
        const newIds: string[] = [];
        for (const binId of selectedBinIds) {
          const newId = duplicateBin(binId);
          if (newId) {
            newIds.push(newId);
          }
        }
        // Select the duplicated bins
        if (newIds.length > 0) {
          setSelectedBins(newIds);
        }
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
      const currentIndex = layout.layers.findIndex(l => l.id === activeLayerId);
      if (currentIndex < layout.layers.length - 1) {
        setActiveLayer(layout.layers[currentIndex + 1].id);
      }
      return;
    }
    if (key.toLowerCase() === SHORTCUTS.LAYER_DOWN && !ctrlOrMeta) {
      e.preventDefault();
      const currentIndex = layout.layers.findIndex(l => l.id === activeLayerId);
      if (currentIndex > 0) {
        setActiveLayer(layout.layers[currentIndex - 1].id);
      }
      return;
    }

    // Bin selection cycling (A/D) - cycles through bins on current layer
    if (key.toLowerCase() === SHORTCUTS.SELECT_PREV_BIN && !ctrlOrMeta) {
      e.preventDefault();
      const layerBins = layout.bins
        .filter(b => b.layerId === activeLayerId && b.layerId !== STAGING_ID)
        .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y); // Sort by row then column
      if (layerBins.length === 0) return;

      const currentId = selectedBinIds[0];
      const currentIndex = layerBins.findIndex(b => b.id === currentId);
      const prevIndex = currentIndex <= 0 ? layerBins.length - 1 : currentIndex - 1;
      setSelectedBins([layerBins[prevIndex].id]);
      return;
    }
    if (key.toLowerCase() === SHORTCUTS.SELECT_NEXT_BIN && !ctrlOrMeta) {
      e.preventDefault();
      const layerBins = layout.bins
        .filter(b => b.layerId === activeLayerId && b.layerId !== STAGING_ID)
        .sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y); // Sort by row then column
      if (layerBins.length === 0) return;

      const currentId = selectedBinIds[0];
      const currentIndex = layerBins.findIndex(b => b.id === currentId);
      const nextIndex = currentIndex < 0 || currentIndex >= layerBins.length - 1 ? 0 : currentIndex + 1;
      setSelectedBins([layerBins[nextIndex].id]);
      return;
    }

    // Category cycling ([ / ]) - cycles category of selected bins, or active drawing category if none selected
    if (key === SHORTCUTS.CATEGORY_PREV) {
      e.preventDefault();
      const categories = layout.categories;
      if (categories.length === 0) return;

      if (selectedBinIds.length > 0) {
        // Change category of selected bins
        const firstBin = layout.bins.find(b => b.id === selectedBinIds[0]);
        if (!firstBin) return;

        const currentIndex = firstBin.category
          ? categories.findIndex(c => c.id === firstBin.category)
          : -1;

        let newCategoryId: string | undefined;
        if (currentIndex <= 0) {
          newCategoryId = currentIndex === 0 ? undefined : categories[categories.length - 1].id;
        } else {
          newCategoryId = categories[currentIndex - 1].id;
        }

        execute(() => {
          for (const binId of selectedBinIds) {
            updateBin(binId, { category: newCategoryId });
          }
        });
      } else {
        // Cycle active drawing category (no "no category" option for drawing)
        const currentIndex = categories.findIndex(c => c.id === activeCategoryId);
        const prevIndex = currentIndex <= 0 ? categories.length - 1 : currentIndex - 1;
        setActiveCategory(categories[prevIndex].id);
      }
      return;
    }
    if (key === SHORTCUTS.CATEGORY_NEXT) {
      e.preventDefault();
      const categories = layout.categories;
      if (categories.length === 0) return;

      if (selectedBinIds.length > 0) {
        // Change category of selected bins
        const firstBin = layout.bins.find(b => b.id === selectedBinIds[0]);
        if (!firstBin) return;

        const currentIndex = firstBin.category
          ? categories.findIndex(c => c.id === firstBin.category)
          : -1;

        let newCategoryId: string | undefined;
        if (currentIndex === -1) {
          newCategoryId = categories[0].id;
        } else if (currentIndex >= categories.length - 1) {
          newCategoryId = undefined;
        } else {
          newCategoryId = categories[currentIndex + 1].id;
        }

        execute(() => {
          for (const binId of selectedBinIds) {
            updateBin(binId, { category: newCategoryId });
          }
        });
      } else {
        // Cycle active drawing category (no "no category" option for drawing)
        const currentIndex = categories.findIndex(c => c.id === activeCategoryId);
        const nextIndex = currentIndex >= categories.length - 1 ? 0 : currentIndex + 1;
        setActiveCategory(categories[nextIndex].id);
      }
      return;
    }

    // L key - open quick label popover for selected bin
    if (key.toLowerCase() === SHORTCUTS.QUICK_LABEL && !ctrlOrMeta && selectedBinIds.length === 1) {
      e.preventDefault();
      showQuickLabel(selectedBinIds[0]);
      return;
    }

    // Arrow keys - spatial navigation OR nudge
    const arrowKeys: readonly string[] = [SHORTCUTS.NUDGE_UP, SHORTCUTS.NUDGE_DOWN, SHORTCUTS.NUDGE_LEFT, SHORTCUTS.NUDGE_RIGHT];
    if (arrowKeys.includes(key)) {
      e.preventDefault();

      // If there's a focused bin but no selection, use spatial navigation
      if (focusedBinId && selectedBinIds.length === 0) {
        handleNavigationKey(key);
        return;
      }

      // Otherwise, use existing nudge logic for selected bins
      if (selectedBinIds.length > 0) {
        let dx = 0, dy = 0;
        if (key === SHORTCUTS.NUDGE_UP) dy = 1;
        if (key === SHORTCUTS.NUDGE_DOWN) dy = -1;
        if (key === SHORTCUTS.NUDGE_LEFT) dx = -1;
        if (key === SHORTCUTS.NUDGE_RIGHT) dx = 1;

        // Check if all bins can move
        const excludeIds = new Set(selectedBinIds);
        let allValid = true;

        for (const binId of selectedBinIds) {
          const bin = layout.bins.find(b => b.id === binId);
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
          execute(() => {
            for (const binId of selectedBinIds) {
              const bin = layout.bins.find(b => b.id === binId);
              if (!bin) continue;
              updateBin(binId, { x: bin.x + dx, y: bin.y + dy });
            }
          });
        }
      }
      return;
    }
  }, [selectedBinIds, focusedBinId, layout, canUndo, canRedo, undo, redo, zoomIn, zoomOut, deleteBin, duplicateBin, updateBin, setSelectedBins, setInteraction, setPaintSize, execute, handleNavigationKey, activeLayerId, setActiveLayer, showQuickLabel, activeCategoryId, setActiveCategory]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
