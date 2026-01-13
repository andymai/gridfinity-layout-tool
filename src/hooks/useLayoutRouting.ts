import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useUIStore, useToastStore, useHistoryStore } from '../store';
import { loadLayoutById } from '../utils/storage';
import { validateLayoutIntegrity } from '../utils/validation';
import {
  parseLayoutIdFromHash,
  setLayoutHash,
  clearLayoutHash,
  getLayoutIdFromHistoryState,
  hasShareHash,
  isCollectionURL,
} from '../utils/url';

/**
 * Hook that synchronizes the URL hash with the active layout.
 *
 * Features:
 * - Bookmarkable URLs: #layout/{id} opens that layout
 * - Browser history: back/forward navigates between layouts
 * - Error handling: shows toast if bookmarked layout doesn't exist
 *
 * Edge cases handled:
 * - Share links (#share=) take precedence over layout routing
 * - Invalid/missing layout IDs show friendly error
 * - Shared preview mode skips URL updates
 */
export function useLayoutRouting() {
  const hasInitialized = useRef(false);

  const { activeLayoutId, importLayout } = useLayoutStore(
    useShallow((state) => ({
      activeLayoutId: state.activeLayoutId,
      importLayout: state.importLayout,
    }))
  );

  const { isLoaded, setActiveLayoutId, getEntry } = useLibraryStore(
    useShallow((state) => ({
      isLoaded: state.isLoaded,
      setActiveLayoutId: state.setActiveLayoutId,
      getEntry: state.getEntry,
    }))
  );

  const { sharedLayoutPreview, setActiveLayer, setActiveCategory, clearSelection } = useUIStore(
    useShallow((state) => ({
      sharedLayoutPreview: state.sharedLayoutPreview,
      setActiveLayer: state.setActiveLayer,
      setActiveCategory: state.setActiveCategory,
      clearSelection: state.clearSelection,
    }))
  );

  const clearHistory = useHistoryStore((state) => state.clear);
  const addToast = useToastStore((state) => state.addToast);

  /**
   * Switch to a layout by ID (used for URL navigation).
   * Returns true if successful, false if layout not found.
   */
  const navigateToLayout = useCallback((layoutId: string, addToHistory = false): boolean => {
    // Check if layout exists in library
    const entry = getEntry(layoutId);
    if (!entry) {
      return false;
    }

    // Load layout data
    const layout = loadLayoutById(layoutId);
    if (!layout) {
      return false;
    }

    // Validate layout integrity
    const validation = validateLayoutIntegrity(layout);
    if (!validation.valid) {
      return false;
    }

    // Switch to the layout
    importLayout(layout, layoutId);
    setActiveLayoutId(layoutId);

    // Reset UI state
    clearSelection();
    setActiveLayer(layout.layers[0]?.id ?? '');
    setActiveCategory(layout.categories[0]?.id ?? '');

    // Clear undo history
    clearHistory();

    // Update URL
    setLayoutHash(layoutId, addToHistory);

    return true;
  }, [
    getEntry,
    importLayout,
    setActiveLayoutId,
    clearSelection,
    setActiveLayer,
    setActiveCategory,
    clearHistory,
  ]);

  // Handle initial URL hash on mount (after library is loaded)
  useEffect(() => {
    if (!isLoaded || hasInitialized.current) return;
    hasInitialized.current = true;

    // Share links take precedence - let SharedLayoutImporter handle them
    if (hasShareHash()) return;

    // Collection URLs are handled by useCollectionRouting - don't interfere
    if (isCollectionURL()) return;

    const hashLayoutId = parseLayoutIdFromHash();
    if (!hashLayoutId) {
      // No layout in URL - set URL to current active layout
      if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
        setLayoutHash(activeLayoutId, false);
      }
      return;
    }

    // URL has a layout ID - try to navigate to it
    if (hashLayoutId === activeLayoutId) {
      // Already on this layout, just ensure URL is set
      setLayoutHash(hashLayoutId, false);
      return;
    }

    const success = navigateToLayout(hashLayoutId, false);
    if (!success) {
      // Layout not found - show friendly error
      addToast(
        'Layout not found. Use the Share button to share layouts with others.',
        'info',
        8000
      );
      // Update URL to current layout
      if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
        setLayoutHash(activeLayoutId, false);
      } else {
        clearLayoutHash();
      }
    }
  }, [
    isLoaded,
    activeLayoutId,
    navigateToLayout,
    addToast,
  ]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Don't handle during shared preview
      if (sharedLayoutPreview) return;

      // Collection navigation is handled by useCollectionRouting
      if (isCollectionURL()) return;

      // Try to get layout ID from history state first
      let layoutId = getLayoutIdFromHistoryState(event.state);

      // Fall back to parsing current hash
      if (!layoutId) {
        layoutId = parseLayoutIdFromHash();
      }

      if (!layoutId) {
        // No layout in URL - stay on current layout
        return;
      }

      // Already on this layout
      if (layoutId === activeLayoutId) return;

      const success = navigateToLayout(layoutId, false);
      if (!success) {
        addToast('Layout not found', 'error');
        // Restore URL to current layout
        if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
          setLayoutHash(activeLayoutId, false);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    activeLayoutId,
    sharedLayoutPreview,
    navigateToLayout,
    addToast,
  ]);

  // Update URL when active layout changes (from UI interactions)
  useEffect(() => {
    // Skip during shared preview
    if (sharedLayoutPreview) {
      clearLayoutHash();
      return;
    }

    // Skip if no active layout or it's a temp ID
    if (!activeLayoutId || activeLayoutId === '__shared_preview__') {
      return;
    }

    // Skip if library not loaded yet
    if (!isLoaded) return;

    // Collection URLs are handled by useCollectionRouting - don't add #local/ hash
    // Collection layouts are cloud-synced, not local-only
    if (isCollectionURL()) {
      // Clear any existing local hash (e.g., when switching from local to collection)
      if (parseLayoutIdFromHash()) {
        clearLayoutHash();
      }
      return;
    }

    // Update URL to match current layout (without adding to history)
    // History is only added during explicit layout switches
    const currentHashId = parseLayoutIdFromHash();
    if (currentHashId !== activeLayoutId) {
      setLayoutHash(activeLayoutId, false);
    }
  }, [activeLayoutId, sharedLayoutPreview, isLoaded]);

  return {
    navigateToLayout,
  };
}
