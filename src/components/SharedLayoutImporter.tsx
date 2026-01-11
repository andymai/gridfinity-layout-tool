import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../store/layout';
import { useUIStore } from '../store/ui';
import { useHistoryStore } from '../store/history';
import { useToastStore } from '../store/toast';
import {
  getSharedLayoutFromURL,
  clearSharedLayoutFromURL,
} from '../utils/storage';

// Check for shared layout once at module load time
const initialShareResult = getSharedLayoutFromURL();

/**
 * Component that detects shared layouts in URL and loads them for preview.
 * The layout is displayed immediately without saving to the library.
 * A banner in the header allows the user to save or discard.
 */
export function SharedLayoutImporter() {
  const hasProcessed = useRef(false);

  const importLayout = useLayoutStore((state) => state.importLayout);
  const setSharedLayoutPreview = useUIStore((state) => state.setSharedLayoutPreview);
  const setActiveLayer = useUIStore((state) => state.setActiveLayer);
  const setActiveCategory = useUIStore((state) => state.setActiveCategory);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const clearHistory = useHistoryStore((state) => state.clear);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    // Only process once
    if (hasProcessed.current) return;
    if (!initialShareResult) return;

    hasProcessed.current = true;

    const { layout, errors } = initialShareResult;

    if (errors.length > 0 || !layout) {
      // Clear the URL on error
      clearSharedLayoutFromURL();
      // Show error feedback to user
      const errorMessage = errors.length > 0 ? errors[0] : 'Invalid share link';
      addToast(`Failed to load shared layout: ${errorMessage}`, 'error');
      return;
    }

    // Load the shared layout directly into the view
    // Use a temporary ID since it's not saved yet
    importLayout(layout, '__shared_preview__');

    // Set the preview state so the banner knows to show
    setSharedLayoutPreview(layout, layout.name);

    // Reset UI state for the new layout
    clearSelection();
    if (layout.layers[0]) {
      setActiveLayer(layout.layers[0].id);
    }
    if (layout.categories[0]) {
      setActiveCategory(layout.categories[0].id);
    }

    // Clear undo history (can't undo into previous layout)
    clearHistory();

    // Clear the URL hash
    clearSharedLayoutFromURL();

    // Announce for accessibility
    announceToScreenReader(`Viewing shared layout: ${layout.name}`);
  }, [
    importLayout,
    setSharedLayoutPreview,
    setActiveLayer,
    setActiveCategory,
    clearSelection,
    clearHistory,
    announceToScreenReader,
    addToast,
  ]);

  // This component doesn't render anything - the banner is in Header
  return null;
}
