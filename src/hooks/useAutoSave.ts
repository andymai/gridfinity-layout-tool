import { useEffect, useRef } from 'react';
import { useLayoutStore, useToastStore } from '../store';
import { saveLayout } from '../utils/storage';

const SAVE_DEBOUNCE_MS = 1000;

export function useAutoSave() {
  const layout = useLayoutStore(state => state.layout);
  const addToast = useToastStore(state => state.addToast);
  const timeoutRef = useRef<number | undefined>(undefined);
  const hasShownErrorRef = useRef(false);

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule save
    timeoutRef.current = window.setTimeout(() => {
      try {
        saveLayout(layout);
        // Reset error flag on successful save
        hasShownErrorRef.current = false;
      } catch (error) {
        // Only show error toast once per failure session to avoid spam
        if (!hasShownErrorRef.current) {
          hasShownErrorRef.current = true;
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
  }, [layout, addToast]);
}
