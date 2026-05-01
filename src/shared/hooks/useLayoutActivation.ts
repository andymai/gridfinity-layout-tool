/**
 * Shared hook for the "activate a layout" orchestration pattern.
 *
 * Four call-sites (SharedLayoutImporter, useSharedWithMe, useLayoutSwitcher)
 * independently duplicated the same 5-step sequence:
 *   importLayout → clearSelection → setActiveLayer → setActiveCategory → clearHistory
 *
 * This hook centralises that sequence so callers only need one function call.
 */

import { useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useInteractionStore } from '@/core/store/interaction';
import { useShallow } from 'zustand/react/shallow';
import type { Layout, LayoutId } from '@/core/types';

/**
 * Load a layout into the editor and reset all dependent UI state.
 *
 * @returns `activateLayout` — call with a layout, its ID, and an optional
 *   accessibility announcement string.
 */
export function useLayoutActivation() {
  const importLayout = useLayoutStore((s) => s.importLayout);

  const { clearSelection, setActiveLayer, setActiveCategory } = useSelectionStore(
    useShallow((s) => ({
      clearSelection: s.clearSelection,
      setActiveLayer: s.setActiveLayer,
      setActiveCategory: s.setActiveCategory,
    }))
  );

  const clearHistory = useHistoryStore((s) => s.clear);
  const announceToScreenReader = useInteractionStore((s) => s.announceToScreenReader);

  const activateLayout = useCallback(
    (layout: Layout, layoutId: LayoutId, announcement?: string) => {
      importLayout(layout, layoutId, 'init');

      clearSelection();
      if (layout.layers[0]) {
        setActiveLayer(layout.layers[0].id);
      }
      if (layout.categories[0]) {
        setActiveCategory(layout.categories[0].id);
      }

      clearHistory();

      if (announcement) {
        announceToScreenReader(announcement);
      }
    },
    [
      importLayout,
      clearSelection,
      setActiveLayer,
      setActiveCategory,
      clearHistory,
      announceToScreenReader,
    ]
  );

  return { activateLayout };
}
