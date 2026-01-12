import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useToastStore } from '../store';
import { saveLayoutById, saveLibrary, computeLayoutPreview } from '../utils/storage';
import { scheduleIdleCallback, cancelIdleCallback } from '../utils/idle';

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_DISPLAY_MS = 2500;
// Maximum time to wait for idle before forcing save (ensures data isn't lost)
const IDLE_TIMEOUT_MS = 2000;

export type SaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Auto-save hook for the multi-layout system.
 * Saves the active layout to its individual storage key and updates the library entry.
 * Returns the current save status for UI display.
 */
export function useAutoSave(): SaveStatus {
  const { layout, activeLayoutId } = useLayoutStore(
    useShallow(state => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );

  const updateEntry = useLibraryStore(state => state.updateEntry);
  const addToast = useToastStore(state => state.addToast);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const timeoutRef = useRef<number | undefined>(undefined);
  const idleCallbackRef = useRef<number | undefined>(undefined);
  const savedTimeoutRef = useRef<number | undefined>(undefined);
  const hasShownErrorRef = useRef(false);
  const failureCountRef = useRef(0);

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear any pending idle callback
    if (idleCallbackRef.current) {
      cancelIdleCallback(idleCallbackRef.current);
      idleCallbackRef.current = undefined;
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

    // Schedule save after debounce period
    timeoutRef.current = window.setTimeout(() => {
      // Show "saving" status immediately to give user feedback
      setSaveStatus('saving');

      // Schedule the actual storage operations during browser idle time
      // This improves INP by not blocking the main thread during user interactions
      idleCallbackRef.current = scheduleIdleCallback(
        () => {
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
        },
        { timeout: IDLE_TIMEOUT_MS }
      );
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
      }
    };
  }, [layout, activeLayoutId, updateEntry, addToast]);

  // Cleanup timeouts and idle callback on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
      }
    };
  }, []);

  return saveStatus;
}
