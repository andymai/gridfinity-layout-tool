/**
 * Hook that handles collection URL routing.
 *
 * Collection URLs have the format:
 * - /c/{12-char-id} - Edit mode (full access)
 * - /c/{12-char-id}/view - View-only mode
 *
 * This hook:
 * - Detects collection URLs on mount and joins the collection
 * - Handles browser back/forward navigation
 * - Updates URL when leaving collection mode
 * - Restores the previously active layout when rejoining a collection
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useLayoutStore } from '../store/layout';
import { useToastStore } from '../store/toast';
import { useUIStore } from '../store/ui';
import {
  parseCollectionFromURL,
  setCollectionURL,
  clearCollectionURL,
  getCollectionFromHistoryState,
  isCollectionURL,
} from '../utils/url';
import { getCollectionErrorMessage, fetchLayout } from '../api/collection';
import type { Layout } from '../types';

export function useCollectionRouting() {
  const hasInitialized = useRef(false);
  const isRestoringLayoutRef = useRef(false);

  const {
    activeCollection,
    activeCollectionLayouts,
    joinCollection,
    leaveCollection,
    loadingState,
    setPendingInvite,
    getMembership,
    setMembershipActiveLayout,
  } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      activeCollectionLayouts: state.activeCollectionLayouts,
      joinCollection: state.joinCollection,
      leaveCollection: state.leaveCollection,
      loadingState: state.loadingState,
      setPendingInvite: state.setPendingInvite,
      getMembership: state.getMembership,
      setMembershipActiveLayout: state.setMembershipActiveLayout,
    }))
  );

  const importLayout = useLayoutStore((state) => state.importLayout);
  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);

  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  /**
   * Navigate to a collection by ID.
   */
  const navigateToCollection = useCallback(
    async (collectionId: string, viewOnly = false) => {
      const result = await joinCollection(collectionId);

      if (result.success) {
        setCollectionURL(collectionId, viewOnly, false);
        announceToScreenReader(
          `Joined collection: ${result.data.name}. ${result.data.layoutCount} layouts available.`
        );
        return true;
      } else {
        addToast(getCollectionErrorMessage(result.error), 'error');
        clearCollectionURL();
        return false;
      }
    },
    [joinCollection, addToast, announceToScreenReader]
  );

  /**
   * Leave the current collection.
   */
  const exitCollection = useCallback(() => {
    leaveCollection();
    clearCollectionURL();
    announceToScreenReader('Left collection mode');
  }, [leaveCollection, announceToScreenReader]);

  // Handle initial URL on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const collectionInfo = parseCollectionFromURL();
    if (collectionInfo) {
      // Check if user has already joined this collection
      const membership = getMembership(collectionInfo.collectionId);
      if (membership) {
        // User is already a member - auto-join
        navigateToCollection(collectionInfo.collectionId, collectionInfo.viewOnly);
      } else {
        // New collection - show invite prompt
        setPendingInvite(collectionInfo.collectionId, collectionInfo.viewOnly);
      }
    }
  }, [getMembership, navigateToCollection, setPendingInvite]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Check if we're navigating to/from a collection URL
      const stateInfo = getCollectionFromHistoryState(event.state);
      const urlInfo = parseCollectionFromURL();

      if (stateInfo || urlInfo) {
        const info = stateInfo || urlInfo;
        if (info && info.collectionId !== activeCollection?.id) {
          navigateToCollection(info.collectionId, info.viewOnly);
        }
      } else if (activeCollection) {
        // Navigating away from collection
        leaveCollection();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeCollection, navigateToCollection, leaveCollection]);

  // Sync URL when active collection changes
  useEffect(() => {
    if (activeCollection) {
      // Ensure URL matches active collection
      const urlInfo = parseCollectionFromURL();
      if (!urlInfo || urlInfo.collectionId !== activeCollection.id) {
        setCollectionURL(activeCollection.id, false, false);
      }
    } else if (isCollectionURL()) {
      // No active collection but URL shows one - clear it
      clearCollectionURL();
    }
  }, [activeCollection]);

  // Restore previously active layout when rejoining a collection
  useEffect(() => {
    // Skip if no active collection or layouts not yet loaded
    if (!activeCollection || activeCollectionLayouts.length === 0) return;
    // Prevent running multiple times during restoration
    if (isRestoringLayoutRef.current) return;

    const membership = getMembership(activeCollection.id);
    if (!membership) return;

    // Determine which layout to load
    let layoutIdToLoad = membership.activeLayoutId;

    // Verify the saved layout still exists in the collection
    if (layoutIdToLoad) {
      const layoutExists = activeCollectionLayouts.some((l) => l.id === layoutIdToLoad);
      if (!layoutExists) {
        // Saved layout was deleted, fall back to first layout
        layoutIdToLoad = activeCollectionLayouts[0].id;
      }
    } else {
      // No saved layout, use first layout in collection
      layoutIdToLoad = activeCollectionLayouts[0].id;
    }

    // Skip if no layout to load or already loaded
    if (!layoutIdToLoad || activeLayoutId === layoutIdToLoad) return;

    // Fetch and load the layout
    isRestoringLayoutRef.current = true;
    const targetLayoutId = layoutIdToLoad;

    const restoreLayout = async () => {
      try {
        const result = await fetchLayout(activeCollection.id, targetLayoutId);
        if (result.success) {
          importLayout(result.data.layout as Layout, targetLayoutId, 'init');
          // Update membership with the loaded layout ID
          setMembershipActiveLayout(activeCollection.id, targetLayoutId);
          const layoutRef = activeCollectionLayouts.find((l) => l.id === targetLayoutId);
          announceToScreenReader(`Loaded layout: ${layoutRef?.name || 'Untitled'}`);
        }
      } catch {
        // Silently fail - user can manually select a layout
      } finally {
        isRestoringLayoutRef.current = false;
      }
    };

    restoreLayout();
  }, [
    activeCollection,
    activeCollectionLayouts,
    activeLayoutId,
    getMembership,
    importLayout,
    setMembershipActiveLayout,
    announceToScreenReader,
  ]);

  return {
    navigateToCollection,
    exitCollection,
    isLoading: loadingState === 'loading',
    isSyncing: loadingState === 'syncing',
  };
}
