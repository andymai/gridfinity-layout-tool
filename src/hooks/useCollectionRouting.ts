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
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useToastStore } from '../store/toast';
import { useUIStore } from '../store/ui';
import {
  parseCollectionFromURL,
  setCollectionURL,
  clearCollectionURL,
  getCollectionFromHistoryState,
  isCollectionURL,
} from '../utils/url';
import { getCollectionErrorMessage } from '../api/collection';

export function useCollectionRouting() {
  const hasInitialized = useRef(false);

  const {
    activeCollection,
    joinCollection,
    leaveCollection,
    loadingState,
    setPendingInvite,
    getMembership,
  } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      joinCollection: state.joinCollection,
      leaveCollection: state.leaveCollection,
      loadingState: state.loadingState,
      setPendingInvite: state.setPendingInvite,
      getMembership: state.getMembership,
    }))
  );

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

  return {
    navigateToCollection,
    exitCollection,
    isLoading: loadingState === 'loading',
    isSyncing: loadingState === 'syncing',
  };
}
