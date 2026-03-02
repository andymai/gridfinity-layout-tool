import { useEffect, useState, useCallback, useRef } from 'react';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useToastStore } from '@/core/store/toast';
import { useLibraryStore, computePreview } from '@/core/store/library';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import {
  getSharedLayoutFromURL,
  clearSharedLayoutFromURL,
  getCloudShareIdFromURL,
} from '@/core/storage';
import { fetchShare } from '@/core/api/share';
import { isOk, getUserMessage } from '@/core/result';
import type { Layout, SharePermission, LayoutPreview } from '@/core/types';
import { SHARED_PREVIEW_ID } from '@/core/constants';
import { useTranslation } from '@/i18n';
import { useLayoutActivation } from '@/hooks/useLayoutActivation';

// Check for shared layout once at module load time (URL-encoded shares)
const initialShareResult = getSharedLayoutFromURL();
// Check for cloud share ID at module load time
const initialCloudShareId = getCloudShareIdFromURL();

/**
 * Component that detects shared layouts in URL and loads them for preview.
 * The layout is displayed immediately without saving to the library.
 * A banner in the header allows the user to save or discard.
 *
 * Handles two share formats:
 * - URL-encoded (legacy): /#share={base64-encoded-layout}
 * - Cloud share: /l/{12-char-id} (only for layouts in "Shared with me" list)
 */
export function SharedLayoutImporter() {
  const t = useTranslation();
  // Loading state is only set to true when we confirm we need to cloud fetch
  // (not when there's just a URL ID - it might be a local layout)
  const [isLoading, setIsLoading] = useState(false);

  const { activateLayout } = useLayoutActivation();
  const setSharedLayoutPreview = useSharedPreviewStore((state) => state.setSharedLayoutPreview);
  const addToast = useToastStore((state) => state.addToast);

  // Library store
  const libraryIsLoaded = useLibraryStore((state) => state.isLoaded);
  const libraryEntries = useLibraryStore((state) => state.library.entries);

  // Shared with me store
  const sharedWithMeLoaded = useSharedWithMeStore((state) => state.isLoaded);
  const getSharedWithMeByShareId = useSharedWithMeStore((state) => state.getByShareId);
  const addSharedWithMe = useSharedWithMeStore((state) => state.add);
  const markShareAccessed = useSharedWithMeStore((state) => state.markAccessed);
  const updateSharedWithMe = useSharedWithMeStore((state) => state.update);

  // Check if we already loaded this share (to skip re-fetching)
  const sharedLayoutCloudShareId = useSharedPreviewStore(
    (state) => state.sharedPreview?.cloudShareId ?? null
  );

  /**
   * Check if a share ID belongs to the current user (i.e., they are the owner).
   * Owners shouldn't see their own layouts in "Shared with me".
   * Since share IDs equal layout UUIDs, we check entry.id directly.
   */
  const isOwnShare = useCallback(
    (shareId: string) => {
      return libraryEntries.some((entry) => entry.id === shareId);
    },
    [libraryEntries]
  );

  /**
   * Auto-track a cloud share in the "Shared with me" list.
   * Skips if the user is the owner of the share.
   */
  const trackSharedLayout = useCallback(
    (
      shareId: string,
      layout: Layout,
      authorName: string | undefined,
      permission: SharePermission,
      preview: LayoutPreview
    ) => {
      // Don't track if this is the owner's own share
      if (isOwnShare(shareId)) return;

      const existingEntry = getSharedWithMeByShareId(shareId);

      if (existingEntry) {
        // Update existing entry with latest info
        markShareAccessed(shareId);
        // Update permission and name if they've changed
        if (existingEntry.permission !== permission || existingEntry.name !== layout.name) {
          updateSharedWithMe(existingEntry.id, {
            permission,
            name: layout.name,
            authorName,
            preview,
          });
        }
      } else {
        // Add new entry
        addSharedWithMe({
          sourceShareId: shareId,
          name: layout.name,
          authorName,
          permission,
          preview,
        });
      }
    },
    [isOwnShare, getSharedWithMeByShareId, markShareAccessed, updateSharedWithMe, addSharedWithMe]
  );

  // Helper function to load a layout into preview
  const loadLayoutPreview = useCallback(
    (layout: Layout, authorName?: string, cloudShareId?: string, permission?: 'view' | 'edit') => {
      activateLayout(layout, SHARED_PREVIEW_ID, `Viewing shared layout: ${layout.name}`);
      setSharedLayoutPreview(layout, layout.name, authorName, cloudShareId, permission);
    },
    [activateLayout, setSharedLayoutPreview]
  );

  // Track whether we've processed the URL share (persists through Strict Mode remounts)
  const hasProcessedUrlShare = useRef(false);

  // Handle URL-encoded shares (legacy format)
  useEffect(() => {
    // Skip if we have a cloud share to process instead
    if (initialCloudShareId) return;
    if (!initialShareResult) return;
    // Only process once per session
    if (hasProcessedUrlShare.current) return;
    hasProcessedUrlShare.current = true;

    const { layout, errors } = initialShareResult;

    if (errors.length > 0 || !layout) {
      // Clear the URL on error
      clearSharedLayoutFromURL();
      // Show error feedback to user
      const errorMessage = errors.length > 0 ? errors[0] : 'Invalid share link';
      addToast(t('toast.sharedLayoutFailed', { error: errorMessage }), 'error');
      return;
    }

    loadLayoutPreview(layout);
    clearSharedLayoutFromURL();
  }, [loadLayoutPreview, addToast, t]);

  // Track whether we've started processing a cloud share (persists through Strict Mode remounts)
  const hasStartedCloudFetch = useRef(false);
  // Track mounted state across effect re-runs (not just a local variable that resets on cleanup)
  const isMountedRef = useRef(true);

  // Set mounted ref on mount/unmount (not on effect re-runs)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle cloud shares (only for layouts in "Shared with me" list)
  useEffect(() => {
    if (!initialCloudShareId) {
      return;
    }

    // Wait for library and shared-with-me list to load before checking
    if (!libraryIsLoaded || !sharedWithMeLoaded) {
      return;
    }

    // Check if this layout exists locally - if so, let useLayoutRouting handle it
    const isLocalLayout = libraryEntries.some(
      (entry) => entry.id === initialCloudShareId || entry.cloudShare?.id === initialCloudShareId
    );
    if (isLocalLayout) {
      return;
    }

    // Only cloud-fetch if this layout is in "Shared with me" list
    // This prevents incorrectly trying to cloud-fetch local-only layouts
    // that don't exist (e.g., bookmarked URL after clearing localStorage)
    const sharedWithMeEntry = getSharedWithMeByShareId(initialCloudShareId);
    if (!sharedWithMeEntry) {
      return;
    }

    // Check if we already loaded this share (prevents re-fetching on effect re-runs)
    if (sharedLayoutCloudShareId === initialCloudShareId) {
      return;
    }

    // Check if URL still has the share ID
    const currentShareId = getCloudShareIdFromURL();
    if (!currentShareId) {
      return;
    }

    // Prevent double-fetch in Strict Mode (first mount starts fetch, second mount should skip)
    if (hasStartedCloudFetch.current) {
      return;
    }
    hasStartedCloudFetch.current = true;

    const loadCloudShare = async () => {
      setIsLoading(true);

      const result = await fetchShare(initialCloudShareId);

      // Prevent state updates if component unmounted during fetch
      // Use ref instead of local variable so it survives effect re-runs
      if (!isMountedRef.current) {
        return;
      }

      // Don't clear URL - keep the share URL visible for better UX
      // The sharedLayoutCloudShareId check above prevents re-fetching

      setIsLoading(false);

      if (!isOk(result)) {
        const message = getUserMessage(result.error);
        addToast(t('toast.sharedLayoutFailed', { error: message }), 'error');
        return;
      }

      const { layout, metadata } = result.value;
      const permission = metadata.permission;

      // Auto-track this share in "Shared with me" (unless it's the owner's own)
      // Wrap in try-catch to ensure robust error handling
      try {
        const preview = computePreview(layout);
        trackSharedLayout(initialCloudShareId, layout, metadata.authorName, permission, preview);
      } catch (e) {
        console.error('Failed to track shared layout:', e);
      }

      loadLayoutPreview(layout, metadata.authorName, initialCloudShareId, permission);
    };

    void loadCloudShare();
    // No cleanup needed - isMountedRef is managed by the separate mount/unmount effect
  }, [
    loadLayoutPreview,
    addToast,
    trackSharedLayout,
    libraryIsLoaded,
    sharedWithMeLoaded,
    libraryEntries,
    sharedLayoutCloudShareId,
    getSharedWithMeByShareId,
    t,
  ]);

  // Show loading state for cloud shares
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-elevated rounded-lg p-6 flex items-center gap-3">
          <svg
            className="w-5 h-5 animate-spin motion-reduce:animate-none text-accent"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-content">{t('share.loadingShared')}</span>
        </div>
      </div>
    );
  }

  // The banner for URL shares is in Header
  return null;
}
