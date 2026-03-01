/**
 * Hook for managing "Shared with me" layouts.
 * Provides access to shared layouts and operations to open/remove them.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { computePreview } from '@/core/store/library';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useHistoryStore } from '@/core/store/history';
import { useToastStore } from '@/core/store/toast';
import type { SharedWithMeEntry } from '@/core/types';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import { fetchShare } from '@/core/api/share';
import { isOk, getUserMessage } from '@/core/result';

export type SharedWithMeStatus = 'idle' | 'loading' | 'error';

interface SharedWithMeState {
  sharedWithMe: SharedWithMeEntry[];
  isLoaded: boolean;
  status: SharedWithMeStatus;
  error: string | null;
}

interface SharedWithMeActions {
  openSharedLayout: (entry: SharedWithMeEntry) => Promise<boolean>;
  removeSharedLayout: (id: string) => void;
}

/**
 * Hook for accessing and managing "Shared with me" layouts.
 */
export function useSharedWithMe(): SharedWithMeState & SharedWithMeActions {
  const [status, setStatus] = useState<SharedWithMeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Track mount state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Shared with me store
  const {
    sharedWithMe,
    isLoaded,
    update: updateSharedWithMe,
    remove: removeSharedWithMe,
  } = useSharedWithMeStore(
    useShallow((state) => ({
      sharedWithMe: state.entries,
      isLoaded: state.isLoaded,
      update: state.update,
      remove: state.remove,
    }))
  );

  // Layout store
  const importLayout = useLayoutStore((state) => state.importLayout);

  // Selection store
  const { setActiveLayer, setActiveCategory, clearSelection } = useSelectionStore(
    useShallow((state) => ({
      setActiveLayer: state.setActiveLayer,
      setActiveCategory: state.setActiveCategory,
      clearSelection: state.clearSelection,
    }))
  );

  // Interaction store
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  // Shared preview store
  const setSharedLayoutPreview = useSharedPreviewStore((state) => state.setSharedLayoutPreview);

  // History store
  const clearHistory = useHistoryStore((state) => state.clear);

  // Toast store
  const addToast = useToastStore((state) => state.addToast);

  /**
   * Open a shared layout by fetching from the server and loading into preview.
   */
  const openSharedLayout = useCallback(
    async (entry: SharedWithMeEntry): Promise<boolean> => {
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to open shared layouts.");
        setStatus('error');
        return false;
      }

      setStatus('loading');
      setError(null);

      const result = await fetchShare(entry.sourceShareId);

      // Prevent state updates if component unmounted during async operation
      if (!mountedRef.current) return false;

      if (!isOk(result)) {
        const message = getUserMessage(result.error);

        // If not found, mark entry as deleted
        if (result.error.code === 'API_NOT_FOUND') {
          updateSharedWithMe(entry.id, { status: 'deleted' });
          setError('This shared layout has been deleted by its owner.');
        } else {
          setError(message);
        }

        setStatus('error');
        addToast(`Failed to open shared layout: ${message}`, 'error');
        return false;
      }

      const { layout, metadata } = result.value;
      const permission = metadata.permission;

      // Update the entry with latest info
      const preview = computePreview(layout);
      updateSharedWithMe(entry.id, {
        name: layout.name,
        authorName: metadata.authorName,
        permission,
        preview,
        lastAccessedAt: Date.now(),
        status: 'available',
      });

      // Load the layout into preview mode
      importLayout(layout, SHARED_PREVIEW_ID, 'init');

      // Set preview state so the banner shows
      setSharedLayoutPreview(
        layout,
        layout.name,
        metadata.authorName,
        entry.sourceShareId,
        permission
      );

      // Reset UI state
      clearSelection();
      if (layout.layers[0]) {
        setActiveLayer(layout.layers[0].id);
      }
      if (layout.categories[0]) {
        setActiveCategory(layout.categories[0].id);
      }

      // Clear undo history
      clearHistory();

      // Announce for accessibility
      announceToScreenReader(`Opened shared layout: ${layout.name}`);

      setStatus('idle');
      return true;
    },
    [
      updateSharedWithMe,
      importLayout,
      setSharedLayoutPreview,
      clearSelection,
      setActiveLayer,
      setActiveCategory,
      clearHistory,
      announceToScreenReader,
      addToast,
    ]
  );

  /**
   * Remove a shared layout from the list.
   */
  const removeLayout = useCallback(
    (id: string) => {
      removeSharedWithMe(id);
      announceToScreenReader('Removed shared layout from list.');
    },
    [removeSharedWithMe, announceToScreenReader]
  );

  return {
    sharedWithMe,
    isLoaded,
    status,
    error,
    openSharedLayout,
    removeSharedLayout: removeLayout,
  };
}
