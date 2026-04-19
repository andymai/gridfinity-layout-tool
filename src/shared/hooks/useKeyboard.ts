/**
 * Hook for global keyboard shortcut handling in the layout editor.
 *
 * Dispatches keyboard events to focused handler functions in
 * `keyboard/handlers.ts`. Each handler is a pure function that receives
 * the event and a context object, returning `true` if it handled the event.
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
 *   useKeyboard();
 *   return <GridCanvas />;
 * }
 * ```
 */

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { batch } from '@/core/cqrs';
import {
  useLayoutStore,
  useHistoryStore,
  useToastStore,
  useSelectionStore,
  useInteractionStore,
  useViewStore,
  useHalfBinModeStore,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useGridNavigation } from '@/features/grid-editor';
import { useTranslation } from '@/i18n';
import type { KeyboardContext, KeyboardHandler } from './keyboard/types';

import {
  handleDelete,
  handleEscape,
  handleDuplicate,
  handleUndo,
  handleRedo,
  handleLayoutManager,
  handleRotate,
  handleZoom,
  handleLayerNavigation,
  handleToolSwitch,
  handleBinCycling,
  handleCategoryCycling,
  handleQuickLabel,
  handleHalfBinToggle,
  handleNudge,
} from './keyboard/handlers';

/**
 * Handler dispatch order. Handlers are tried in sequence; the first
 * one that returns `true` short-circuits the rest.
 */
const handlers: KeyboardHandler[] = [
  handleDelete,
  handleEscape,
  handleUndo,
  handleRedo,
  handleLayoutManager,
  handleDuplicate,
  handleRotate,
  handleZoom,
  handleLayerNavigation,
  handleToolSwitch,
  handleBinCycling,
  handleCategoryCycling,
  handleQuickLabel,
  handleHalfBinToggle,
  handleNudge,
];

export function useKeyboard() {
  const t = useTranslation();

  const {
    selectedBinIds,
    focusedBinId,
    setSelectedBins,
    activeLayerId,
    setActiveLayer,
    showQuickLabel,
    activeCategoryId,
    setActiveCategory,
  } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      focusedBinId: state.focusedBinId,
      setSelectedBins: state.setSelectedBins,
      activeLayerId: state.activeLayerId,
      setActiveLayer: state.setActiveLayer,
      showQuickLabel: state.showQuickLabel,
      activeCategoryId: state.activeCategoryId,
      setActiveCategory: state.setActiveCategory,
    }))
  );

  const { setInteraction, setPaintSize } = useInteractionStore(
    useShallow((state) => ({
      setInteraction: state.setInteraction,
      setPaintSize: state.setPaintSize,
    }))
  );

  const { zoomIn, zoomOut, setShowLayoutManager } = useViewStore(
    useShallow((state) => ({
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
      setShowLayoutManager: state.setShowLayoutManager,
    }))
  );

  const toggleHalfBinMode = useHalfBinModeStore((state) => state.toggleHalfBinMode);
  const addToast = useToastStore((state) => state.addToast);
  const { navigateToDesigner } = useDesignerRouting();
  const { handleNavigationKey } = useGridNavigation();
  const layout = useLayoutStore((state) => state.layout);
  const { deleteBin, duplicateBin, updateBin } = useMutations();

  const { undo, redo, canUndo, canRedo } = useHistoryStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    }))
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || e.target.tagName === 'SELECT')
      ) {
        return;
      }

      const ctx: KeyboardContext = {
        layout,
        selectedBinIds,
        focusedBinId,
        activeLayerId,
        activeCategoryId,
        canUndo,
        canRedo,
        undo,
        redo,
        setSelectedBins,
        setActiveLayer,
        setActiveCategory,
        showQuickLabel,
        setInteraction,
        setPaintSize,
        zoomIn,
        zoomOut,
        setShowLayoutManager,
        batch,
        deleteBin,
        duplicateBin,
        updateBin,
        toggleHalfBinMode,
        handleNavigationKey,
        navigateToDesigner,
        addToast,
        t,
      };

      for (const handler of handlers) {
        if (handler(e, ctx)) return;
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
      handleNavigationKey,
      activeLayerId,
      setActiveLayer,
      showQuickLabel,
      activeCategoryId,
      setActiveCategory,
      toggleHalfBinMode,
      setShowLayoutManager,
      addToast,
      navigateToDesigner,
      t,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
