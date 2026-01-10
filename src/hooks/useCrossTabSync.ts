import { useEffect, useRef } from 'react';
import { useToastStore } from '../store';

/**
 * Hook to detect when layout data is modified in another browser tab.
 * Shows a warning toast when storage changes are detected from another context.
 */
export function useCrossTabSync() {
  const addToast = useToastStore(state => state.addToast);
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only care about our layout storage keys
      if (
        e.key === 'gridfinity-library-v1' ||
        e.key?.startsWith('gridfinity-layout-')
      ) {
        // Only warn once per session to avoid spam
        if (!hasWarnedRef.current) {
          hasWarnedRef.current = true;
          addToast(
            'Layout modified in another tab. Reload to sync.',
            'info',
            0 // Don't auto-dismiss - user needs to take action
          );
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [addToast]);

  // Reset warning flag when component unmounts/remounts
  useEffect(() => {
    return () => {
      hasWarnedRef.current = false;
    };
  }, []);
}
