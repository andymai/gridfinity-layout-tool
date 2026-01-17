import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useToastStore } from '../core/store';
import { saveLayoutWithMetadata } from '../core/storage';
import { scheduleIdleCallback, cancelIdleCallback } from '../utils/idle';
import { isErr, getUserMessage, isRetryable } from '../core/result';
import type { StorageError } from '../core/result';

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

  const { library, setLibrary } = useLibraryStore(
    useShallow(state => ({
      library: state.library,
      setLibrary: state.setLibrary,
    }))
  );
  const addToast = useToastStore(state => state.addToast);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const timeoutRef = useRef<number | undefined>(undefined);
  const idleCallbackRef = useRef<number | undefined>(undefined);
  const savedTimeoutRef = useRef<number | undefined>(undefined);
  const hasShownErrorRef = useRef(false);
  const failureCountRef = useRef(0);
  // Use ref to access current library without triggering effect re-runs
  const libraryRef = useRef(library);

  // Sync ref with latest library value (must be in effect, not render)
  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (idleCallbackRef.current) {
      cancelIdleCallback(idleCallbackRef.current);
      idleCallbackRef.current = undefined;
    }

    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = undefined;
    }

    if (!activeLayoutId) return;

    // Don't save temporary shared preview layouts
    if (activeLayoutId === '__shared_preview__') return;

    timeoutRef.current = window.setTimeout(() => {
      setSaveStatus('saving');

      // Schedule storage operations during browser idle time to improve INP
      idleCallbackRef.current = scheduleIdleCallback(
        async () => {
          // Atomic save: layout + library entry in one operation
          const result = await saveLayoutWithMetadata(
            activeLayoutId,
            layout,
            libraryRef.current
          );

          if (isErr(result)) {
            handleSaveError(result.error);
            return;
          }

          // Sync library store with the persisted state
          setLibrary(result.value.library);

          // Success - reset error tracking
          hasShownErrorRef.current = false;
          failureCountRef.current = 0;

          setSaveStatus('saved');

          savedTimeoutRef.current = window.setTimeout(() => {
            setSaveStatus('idle');
          }, SAVED_DISPLAY_MS);
        },
        { timeout: IDLE_TIMEOUT_MS }
      );
    }, SAVE_DEBOUNCE_MS);

    function handleSaveError(error: StorageError): void {
      failureCountRef.current++;
      setSaveStatus('idle');

      const message = getUserMessage(error);
      const canRetry = isRetryable(error.code);

      // Show warning after multiple failures (persistent toast)
      if (failureCountRef.current >= 3 && !hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        addToast(message, 'error', 0); // Don't auto-dismiss
      } else if (!hasShownErrorRef.current && failureCountRef.current === 1) {
        // Show transient error on first failure
        // Auto-dismiss if retryable (will retry on next change)
        addToast(message, 'error', canRetry ? undefined : 0);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
      }
    };
  }, [layout, activeLayoutId, setLibrary, addToast]);

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
