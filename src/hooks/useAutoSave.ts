import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useToastStore, useUIStore } from '../store';
import { saveLayoutById, saveLibrary, computeLayoutPreview } from '../utils/storage';

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_DISPLAY_MS = 2500;

export type SaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Auto-save hook for the multi-layout system.
 * Saves the active layout to its individual storage key and updates the library entry.
 * Returns the current save status for UI display.
 * 
 * Optimized to defer saves during active interactions (drag/resize) to avoid blocking main thread.
 */
export function useAutoSave(): SaveStatus {
  const { layout, activeLayoutId } = useLayoutStore(
    useShallow(state => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );

  // Check if there's an active interaction (drag/resize/draw)
  const interaction = useUIStore(state => state.interaction);

  const updateEntry = useLibraryStore(state => state.updateEntry);
  const addToast = useToastStore(state => state.addToast);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const timeoutRef = useRef<number | undefined>(undefined);
  const savedTimeoutRef = useRef<number | undefined>(undefined);
  const hasShownErrorRef = useRef(false);
  const failureCountRef = useRef(0);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear any pending "saved" timeout when new changes come in
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = undefined;
    }

    // Don't save if no active layout ID (shouldn't happen, but safety check)
    if (!activeLayoutId) return;

    // Don't save temporary shared preview layouts
    if (activeLayoutId === '__shared_preview__') return;

    // Mark that we have a pending save
    pendingSaveRef.current = true;

    // Defer save during active interactions for better INP
    if (interaction) {
      // Wait for interaction to complete before saving
      return;
    }

    // Schedule save (only if no active interaction)
    timeoutRef.current = window.setTimeout(() => {
      // Check again if there's an interaction just before saving
      if (useUIStore.getState().interaction) {
        pendingSaveRef.current = true;
        return;
      }

      // Reset to idle first (in case we were showing "saved"), then show "saving"
      setSaveStatus('saving');

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
        pendingSaveRef.current = false;

        // Show "saved" status
        setSaveStatus('saved');

        // Clear "saved" status after delay
        savedTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus('idle');
        }, SAVED_DISPLAY_MS);
      } catch (error) {
        failureCountRef.current++;
        setSaveStatus('idle');

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
  }, [layout, activeLayoutId, interaction, updateEntry, addToast]);

  // Effect to trigger save when interaction ends and there's a pending save
  useEffect(() => {
    if (!interaction && pendingSaveRef.current) {
      // Trigger save by updating a dependency (we can't call the save directly)
      // The main effect will handle the actual save
      pendingSaveRef.current = false;
    }
  }, [interaction]);

  // Cleanup saved timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  return saveStatus;
}
