import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  useLayoutStore,
  useLibraryStore,
  useUIStore,
  useToastStore,
  useHistoryStore,
} from '@/core/store';
import { loadLayoutAsync } from '@/core/storage';
import { validateLayoutIntegrity } from '@/shared/utils/validation';
import {
  parseLayoutFromURL,
  setLayoutURL,
  clearLayoutURL,
  getLayoutIdFromHistoryState,
  getCanonicalRedirect,
} from '@/utils/url';
import { useTranslation } from '@/i18n';
import {
  layoutId as toLayoutId,
  layerId as toLayerId,
  categoryId as toCategoryId,
} from '@/core/types';
import type { LayoutId } from '@/core/types';

const SHARED_PREVIEW_ID = '__shared_preview__';

/**
 * Hook that synchronizes the URL with the active layout.
 *
 * URL format: /l/{layoutId}/{slug}
 * Example: /l/abc123xyz789/my-workshop-layout
 *
 * Features:
 * - Bookmarkable URLs with human-readable slugs
 * - Slug redirects: wrong/missing slugs redirect to canonical URL
 * - Browser history: back/forward navigates between layouts
 * - Legacy support: handles old #local/{id} URLs
 *
 * Edge cases handled:
 * - Share links (#share=) take precedence over layout routing
 * - Invalid/missing layout IDs show friendly error
 * - Shared preview mode skips URL updates
 */
export function useLayoutRouting(options: { skip?: boolean } = {}) {
  const t = useTranslation();
  const hasInitialized = useRef(false);

  const { layout, activeLayoutId, importLayout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
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
   * Check if URL routing should be skipped.
   * Returns true when in shared preview mode, skip option is set,
   * or URL points to an unrecognized layout (possibly a cloud share being loaded).
   */
  const shouldSkipRouting = useCallback(
    (checkUrl = false): boolean => {
      if (options.skip || sharedLayoutPreview) return true;
      if (checkUrl) {
        const urlInfo = parseLayoutFromURL();
        if (urlInfo && !getEntry(toLayoutId(urlInfo.layoutId))) return true;
      }
      return false;
    },
    [options.skip, sharedLayoutPreview, getEntry]
  );

  /**
   * Check if layout ID is valid for URL operations.
   */
  const isValidLayoutId = (id: string | null): id is string => {
    return id !== null && id !== SHARED_PREVIEW_ID;
  };

  /**
   * Switch to a layout by ID (used for URL navigation).
   * Returns true if successful, false if layout not found.
   */
  const navigateToLayout = useCallback(
    async (rawId: string, addToHistory = false): Promise<boolean> => {
      const layoutId: LayoutId = toLayoutId(rawId);
      // Check if layout exists in library
      const entry = getEntry(layoutId);
      if (!entry) {
        return false;
      }

      // Load layout data from IndexedDB (with localStorage fallback)
      const loadedLayout = await loadLayoutAsync(layoutId);
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
      setActiveLayer(loadedLayout.layers[0]?.id ?? toLayerId(''));
      setActiveCategory(loadedLayout.categories[0]?.id ?? toCategoryId(''));

      // Clear undo history
      clearHistory();

      // Update URL with layout name for slug
      setLayoutURL(layoutId, loadedLayout.name, addToHistory);

      return true;
    },
    [
      getEntry,
      importLayout,
      setActiveLayoutId,
      clearSelection,
      setActiveLayer,
      setActiveCategory,
      clearHistory,
    ]
  );

  /**
   * Update URL to reflect current active layout, or clear if invalid.
   */
  const syncUrlToActiveLayout = useCallback(
    (replaceState = false) => {
      if (isValidLayoutId(activeLayoutId)) {
        const entry = getEntry(activeLayoutId);
        if (entry) {
          setLayoutURL(activeLayoutId, entry.name, replaceState);
          return;
        }
      }
      clearLayoutURL();
    },
    [activeLayoutId, getEntry]
  );

  // Handle initial URL on mount (after library is loaded)
  useEffect(() => {
    if (!isLoaded || hasInitialized.current) return;
    hasInitialized.current = true;

    if (shouldSkipRouting()) return;

    const urlInfo = parseLayoutFromURL();
    if (!urlInfo) {
      // No layout in URL - set URL to current active layout
      if (isValidLayoutId(activeLayoutId)) {
        syncUrlToActiveLayout(false);
      }
      return;
    }

    const layoutId = toLayoutId(urlInfo.layoutId);
    const localEntry = getEntry(layoutId);

    if (layoutId === activeLayoutId) {
      // Already on this layout - check if slug needs redirect
      if (localEntry) {
        const redirect = getCanonicalRedirect(layoutId, localEntry.name);
        if (redirect) {
          window.history.replaceState({ layoutId, slug: localEntry.name }, '', redirect);
        }
      }
      return;
    }

    if (!localEntry) {
      // Layout not found locally - it might be a cloud share from another user
      // Let SharedLayoutImporter handle it (don't redirect)
      return;
    }

    // Navigate asynchronously to the requested layout
    navigateToLayout(layoutId, false)
      .then((success) => {
        if (!success) {
          // Layout not found - silently redirect to current layout.
          // No toast needed: this commonly happens when users bookmark a layout
          // and later delete it. The URL redirect is sufficient feedback.
          syncUrlToActiveLayout(false);
        }
      })
      .catch(() => {
        // Handle unexpected navigation errors gracefully
        syncUrlToActiveLayout(false);
      });
  }, [
    isLoaded,
    activeLayoutId,
    navigateToLayout,
    getEntry,
    shouldSkipRouting,
    syncUrlToActiveLayout,
  ]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (shouldSkipRouting()) return;

      // Try to get layout ID from history state first, then fall back to URL
      let layoutId = getLayoutIdFromHistoryState(event.state);
      if (!layoutId) {
        const urlInfo = parseLayoutFromURL();
        layoutId = urlInfo?.layoutId ?? null;
      }

      if (!layoutId || layoutId === activeLayoutId) return;

      // Navigate asynchronously
      navigateToLayout(layoutId, false)
        .then((success) => {
          if (!success) {
            addToast(t('toast.layoutNotFound'), 'error');
            syncUrlToActiveLayout(false);
          }
        })
        .catch(() => {
          // Handle unexpected navigation errors on popstate
          addToast(t('toast.layoutNotFound'), 'error');
          syncUrlToActiveLayout(false);
        });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeLayoutId, shouldSkipRouting, navigateToLayout, addToast, syncUrlToActiveLayout, t]);

  // Update URL when active layout changes (from UI interactions)
  useEffect(() => {
    if (shouldSkipRouting(true)) return;
    if (!isValidLayoutId(activeLayoutId) || !isLoaded) return;

    const entry = getEntry(activeLayoutId);
    if (!entry) return;

    setLayoutURL(activeLayoutId, entry.name, false);
  }, [activeLayoutId, layout.name, isLoaded, getEntry, shouldSkipRouting]);

  // Handle layout name changes (update slug in URL)
  useEffect(() => {
    if (shouldSkipRouting(true)) return;
    if (!isValidLayoutId(activeLayoutId)) return;

    const entry = getEntry(activeLayoutId);
    if (!entry) return;

    const redirect = getCanonicalRedirect(activeLayoutId, entry.name);
    if (redirect) {
      window.history.replaceState({ layoutId: activeLayoutId }, '', redirect);
    }
  }, [activeLayoutId, getEntry, shouldSkipRouting]);

  return {
    navigateToLayout,
  };
}
