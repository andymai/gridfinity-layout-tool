import { useEffect, useRef, useState, useCallback } from 'react';
import { useLayoutStore } from '../store/layout';
import { useUIStore } from '../store/ui';
import { useHistoryStore } from '../store/history';
import { useToastStore } from '../store/toast';
import {
  getSharedLayoutFromURL,
  clearSharedLayoutFromURL,
  getCloudShareIdFromURL,
  clearCloudShareFromURL,
} from '../utils/storage';
import { fetchShare, getErrorMessage } from '../api/share';
import type { Layout } from '../types';

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
 * - URL-encoded: /#share={base64-encoded-layout}
 * - Cloud share: /s/{12-char-id}
 */
export function SharedLayoutImporter() {
  const hasProcessed = useRef(false);
  const [isLoading, setIsLoading] = useState(!!initialCloudShareId);

  const importLayout = useLayoutStore((state) => state.importLayout);
  const setSharedLayoutPreview = useUIStore((state) => state.setSharedLayoutPreview);
  const setActiveLayer = useUIStore((state) => state.setActiveLayer);
  const setActiveCategory = useUIStore((state) => state.setActiveCategory);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const clearHistory = useHistoryStore((state) => state.clear);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const addToast = useToastStore((state) => state.addToast);

  // Helper function to load a layout into preview
  const loadLayoutPreview = useCallback((layout: Layout, authorName?: string) => {
    // Load the shared layout directly into the view
    // Use a temporary ID since it's not saved yet
    importLayout(layout, '__shared_preview__');

    // Set the preview state so the banner knows to show
    setSharedLayoutPreview(layout, layout.name, authorName);

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

    // Announce for accessibility
    announceToScreenReader(`Viewing shared layout: ${layout.name}`);
  }, [
    importLayout,
    setSharedLayoutPreview,
    clearSelection,
    setActiveLayer,
    setActiveCategory,
    clearHistory,
    announceToScreenReader,
  ]);

  // Handle URL-encoded shares (legacy format)
  useEffect(() => {
    // Only process once, and skip if we have a cloud share to process
    if (hasProcessed.current) return;
    if (initialCloudShareId) return; // Cloud share takes priority
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

    loadLayoutPreview(layout);
    clearSharedLayoutFromURL();
  }, [loadLayoutPreview, addToast]);

  // Handle cloud shares
  useEffect(() => {
    if (hasProcessed.current) return;
    if (!initialCloudShareId) return;

    hasProcessed.current = true;

    const loadCloudShare = async () => {
      setIsLoading(true);

      const result = await fetchShare(initialCloudShareId);

      setIsLoading(false);

      if (!result.success) {
        clearCloudShareFromURL();
        const message = getErrorMessage(result.error);
        addToast(`Failed to load shared layout: ${message}`, 'error');
        return;
      }

      loadLayoutPreview(result.data.layout, result.data.metadata.authorName);
      clearCloudShareFromURL();
    };

    loadCloudShare();
  }, [loadLayoutPreview, addToast]);

  // Show loading state for cloud shares
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-elevated rounded-lg p-6 flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
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
          <span className="text-content">Loading shared layout...</span>
        </div>
      </div>
    );
  }

  // The banner for URL shares is in Header
  return null;
}
