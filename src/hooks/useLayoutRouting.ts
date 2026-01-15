import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useUIStore, useToastStore, useHistoryStore } from '../store';
import { loadLayoutByIdAsync } from '../storage';
import { validateLayoutIntegrity } from '../utils/validation';
import {
  parseLayoutFromURL,
  setLayoutURL,
  clearLayoutURL,
  getLayoutIdFromHistoryState,
  getCanonicalRedirect,
} from '../utils/url';

/**
 * Hook that synchronizes the URL with the active layout.
 *
 * URL format: /{layoutId}/{slug}
 * Example: /abc123xyz789/my-workshop-layout
 *
 * Features:
 * - Bookmarkable URLs with human-readable slugs
 * - Slug redirects: wrong/missing slugs redirect to canonical URL
 * - Browser history: back/forward navigates between layouts
 * - Legacy support: handles old #local/{id} and /s/{shareId} URLs
 *
 * Edge cases handled:
 * - Share links (#share=) take precedence over layout routing
 * - Invalid/missing layout IDs show friendly error
 * - Shared preview mode skips URL updates
 */
export function useLayoutRouting() {
  const hasInitialized = useRef(false);

  const { layout, activeLayoutId, importLayout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
      importLayout: state.importLayout,
    }))
  );

  const { isLoaded, setActiveLayoutId, getEntry, libraryEntries } = useLibraryStore(
    useShallow((state) => ({
      isLoaded: state.isLoaded,
      setActiveLayoutId: state.setActiveLayoutId,
      getEntry: state.getEntry,
      libraryEntries: state.library.entries,
    }))
  );

  /**
   * Find a library entry by cloud share ID.
   * Used when owner visits their own share URL (e.g., /l/{shareId}/slug).
   */
  const getEntryByCloudShareId = useCallback((shareId: string) => {
    return libraryEntries.find(entry => entry.cloudShare?.id === shareId);
  }, [libraryEntries]);

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
  const navigateToLayout = useCallback(async (layoutId: string, addToHistory = false): Promise<boolean> => {
    // Check if layout exists in library
    const entry = getEntry(layoutId);
    if (!entry) {
      return false;
    }

    // Load layout data from IndexedDB (with localStorage fallback)
    const loadedLayout = await loadLayoutByIdAsync(layoutId);
    if (!loadedLayout) {
      return false;
    }

    // Validate layout integrity
    const validation = validateLayoutIntegrity(loadedLayout);
    if (!validation.valid) {
      return false;
    }

    // Switch to the layout
    importLayout(loadedLayout, layoutId, 'init');
    setActiveLayoutId(layoutId);

    // Reset UI state
    clearSelection();
    setActiveLayer(loadedLayout.layers[0]?.id ?? '');
    setActiveCategory(loadedLayout.categories[0]?.id ?? '');

    // Clear undo history
    clearHistory();

    // Update URL with layout name for slug
    setLayoutURL(layoutId, loadedLayout.name, addToHistory);

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

  // Handle initial URL on mount (after library is loaded)
  useEffect(() => {
    if (!isLoaded || hasInitialized.current) return;
    hasInitialized.current = true;

    // Check for share URL pattern /s/{id} - let SharedLayoutImporter handle it
    if (/^\/s\/[a-zA-Z0-9]{12}$/.test(window.location.pathname)) {
      return;
    }

    const urlInfo = parseLayoutFromURL();
    if (!urlInfo) {
      // No layout in URL - set URL to current active layout
      if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
        const entry = getEntry(activeLayoutId);
        if (entry) {
          setLayoutURL(activeLayoutId, entry.name, false);
        }
      }
      return;
    }

    const { layoutId } = urlInfo;

    // URL has a layout ID - try to navigate to it
    // First check by direct ID, then by cloud share ID (for owner visiting their share URL)
    let localEntry = getEntry(layoutId);
    let targetLayoutId = layoutId;

    if (!localEntry) {
      // Check if this is the owner visiting their own share URL
      const ownerEntry = getEntryByCloudShareId(layoutId);
      if (ownerEntry) {
        localEntry = ownerEntry;
        targetLayoutId = ownerEntry.id;
      }
    }

    if (targetLayoutId === activeLayoutId) {
      // Already on this layout - check if slug needs redirect
      if (localEntry) {
        const redirect = getCanonicalRedirect(targetLayoutId, localEntry.name);
        if (redirect) {
          window.history.replaceState({ layoutId: targetLayoutId, slug: localEntry.name }, '', redirect);
        }
      }
      return;
    }

    if (!localEntry) {
      // Layout not found locally - it might be a cloud share
      // Let SharedLayoutImporter handle it (don't redirect)
      return;
    }

    // Navigate asynchronously to the requested layout
    navigateToLayout(targetLayoutId, false)
      .then((success) => {
        if (!success) {
          // Layout not found - silently redirect to current layout.
          // No toast needed: this commonly happens when users bookmark a layout
          // and later delete it. The URL redirect is sufficient feedback.
          if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
            const entry = getEntry(activeLayoutId);
            if (entry) {
              setLayoutURL(activeLayoutId, entry.name, false);
            }
          } else {
            clearLayoutURL();
          }
        }
      })
      .catch((error) => {
        console.error('[LayoutRouting] Navigation failed:', error);
      });
  }, [
    isLoaded,
    activeLayoutId,
    navigateToLayout,
    getEntry,
    getEntryByCloudShareId,
  ]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Don't handle during shared preview
      if (sharedLayoutPreview) return;

      // Try to get layout ID from history state first
      let layoutId = getLayoutIdFromHistoryState(event.state);

      // Fall back to parsing current URL
      if (!layoutId) {
        const urlInfo = parseLayoutFromURL();
        layoutId = urlInfo?.layoutId ?? null;
      }

      if (!layoutId) {
        // No layout in URL - stay on current layout
        return;
      }

      // Already on this layout
      if (layoutId === activeLayoutId) return;

      // Navigate asynchronously
      navigateToLayout(layoutId, false)
        .then((success) => {
          if (!success) {
            addToast('Layout not found', 'error');
            // Restore URL to current layout
            if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
              const entry = getEntry(activeLayoutId);
              if (entry) {
                setLayoutURL(activeLayoutId, entry.name, false);
              }
            }
          }
        })
        .catch((error) => {
          console.error('[LayoutRouting] Popstate navigation failed:', error);
        });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    activeLayoutId,
    sharedLayoutPreview,
    navigateToLayout,
    addToast,
    getEntry,
  ]);

  // Update URL when active layout changes (from UI interactions)
  useEffect(() => {
    // Skip during shared preview
    if (sharedLayoutPreview) {
      clearLayoutURL();
      return;
    }

    // Check for share URL pattern /s/{id} - let SharedLayoutImporter handle it
    if (/^\/s\/[a-zA-Z0-9]{12}$/.test(window.location.pathname)) {
      return;
    }

    // Skip if URL has a layout ID that's not a local layout (might be a cloud share being loaded)
    const urlInfo = parseLayoutFromURL();
    if (urlInfo && !getEntry(urlInfo.layoutId) && !getEntryByCloudShareId(urlInfo.layoutId)) {
      // URL has a layout ID that doesn't exist locally (neither by ID nor cloud share)
      // Let SharedLayoutImporter handle it
      return;
    }

    // Skip if no active layout or it's a temp ID
    if (!activeLayoutId || activeLayoutId === '__shared_preview__') {
      return;
    }

    // Skip if library not loaded yet
    if (!isLoaded) return;

    // Get entry for current layout name
    const entry = getEntry(activeLayoutId);
    if (!entry) return;

    // Update URL with layout ID and slug
    setLayoutURL(activeLayoutId, entry.name, false);
  }, [activeLayoutId, layout.name, sharedLayoutPreview, isLoaded, getEntry, getEntryByCloudShareId]);

  // Handle layout name changes (update slug in URL)
  useEffect(() => {
    if (sharedLayoutPreview || !activeLayoutId || activeLayoutId === '__shared_preview__') {
      return;
    }

    // Skip if URL has a layout ID that's not a local layout (might be a cloud share being loaded)
    const urlInfo = parseLayoutFromURL();
    if (urlInfo && !getEntry(urlInfo.layoutId) && !getEntryByCloudShareId(urlInfo.layoutId)) {
      return;
    }

    const entry = getEntry(activeLayoutId);
    if (!entry) return;

    // Check if slug needs update
    const redirect = getCanonicalRedirect(activeLayoutId, entry.name);
    if (redirect) {
      window.history.replaceState({ layoutId: activeLayoutId }, '', redirect);
    }
  }, [activeLayoutId, sharedLayoutPreview, getEntry, getEntryByCloudShareId]);

  return {
    navigateToLayout,
  };
}
