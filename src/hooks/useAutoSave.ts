import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useToastStore } from '../store';
import { saveLayoutById, saveLibrary, computeLayoutPreview } from '../utils/storage';

const SAVE_DEBOUNCE_MS = 1000;

/**
 * Auto-save hook for the multi-layout system.
 * Saves the active layout to its individual storage key and updates the library entry.
 */
export function useAutoSave() {
  const { layout, activeLayoutId } = useLayoutStore(
    useShallow(state => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );

  const updateEntry = useLibraryStore(state => state.updateEntry);
  const addToast = useToastStore(state => state.addToast);

  const timeoutRef = useRef<number | undefined>(undefined);
  const hasShownErrorRef = useRef(false);
  const failureCountRef = useRef(0);

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't save if no active layout ID (shouldn't happen, but safety check)
    if (!activeLayoutId) return;

    // Schedule save
    timeoutRef.current = window.setTimeout(() => {
      try {
        // Save layout to its individual key
        saveLayoutById(activeLayoutId, layout);

        // Update library entry with new preview and timestamp
        updateEntry(activeLayoutId, {
          modifiedAt: Date.now(),
          preview: computeLayoutPreview(layout),
          name: layout.name, // Keep library name in sync with layout name
        });

        // Save library index
        saveLibrary(useLibraryStore.getState().library);

        // Reset error flags on successful save
        hasShownErrorRef.current = false;
        failureCountRef.current = 0;
      } catch (error) {
        failureCountRef.current++;

        // Show warning after multiple failures
        if (failureCountRef.current >= 3 && !hasShownErrorRef.current) {
          hasShownErrorRef.current = true;
          const message = error instanceof Error ? error.message : 'Failed to save layout';
          addToast(message, 'error', 0); // Don't auto-dismiss
        } else if (!hasShownErrorRef.current && failureCountRef.current === 1) {
          // Show transient error on first failure
          const message = error instanceof Error ? error.message : 'Failed to save layout';
          addToast(message, 'error');
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [layout, activeLayoutId, updateEntry, addToast]);
}
