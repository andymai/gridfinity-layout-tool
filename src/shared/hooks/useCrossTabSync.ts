import { useEffect } from 'react';
import {
  useLayoutStore,
  useLibraryStore,
  useHistoryStore,
  useUIStore,
  useLabsStore,
  LABS_STORAGE_KEY,
} from '@/core/store';
import { loadLayoutAsync, loadLibrary } from '@/core/storage';
import { validateLayoutIntegrity } from '@/shared/utils/validation';
import { createDefaultLabsPreferences } from '@/core/labs';

/**
 * Hook to automatically sync layout data when modified in another browser tab.
 * The storage event only fires for changes from OTHER tabs, so this won't loop.
 */
export function useCrossTabSync() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Labs preferences changed - sync them
      if (e.key === LABS_STORAGE_KEY) {
        try {
          const newPrefs = e.newValue ? JSON.parse(e.newValue) : createDefaultLabsPreferences();
          useLabsStore.getState().syncFromStorage({
            ...createDefaultLabsPreferences(),
            ...newPrefs,
          });
        } catch {
          // Ignore parse errors
        }
        return;
      }

      // Library index changed - reload it
      if (e.key === 'gridfinity-library-v1') {
        const newLibrary = loadLibrary();
        if (newLibrary) {
          useLibraryStore.getState().setLibrary(newLibrary);
        }
        return;
      }

      // A specific layout changed - check if it's the active one
      // Note: With IndexedDB migration, localStorage events only fire for legacy writes.
      // IndexedDB doesn't have cross-tab events, so this is backwards compatibility.
      if (e.key?.startsWith('gridfinity-layout-')) {
        const layoutId = e.key.replace('gridfinity-layout-', '');
        const activeLayoutId = useLayoutStore.getState().activeLayoutId;

        // Only reload if it's the currently active layout
        if (layoutId === activeLayoutId) {
          // Load asynchronously from IndexedDB (with localStorage fallback)
          loadLayoutAsync(layoutId)
            .then((newLayout) => {
              if (newLayout) {
                // Validate before applying
                const validation = validateLayoutIntegrity(newLayout);
                if (validation.valid) {
                  // Update layout store (from another tab, treat as remote)
                  useLayoutStore.getState().importLayout(newLayout, layoutId, 'remote');

                  // Clear undo history since we're syncing external changes
                  useHistoryStore.getState().clear();

                  // Update active layer/category if they no longer exist
                  const uiState = useUIStore.getState();
                  const activeLayer = uiState.activeLayerId;
                  const activeCategory = uiState.activeCategoryId;

                  if (activeLayer && !newLayout.layers.find((l) => l.id === activeLayer)) {
                    uiState.setActiveLayer(newLayout.layers[0]?.id ?? '');
                  }
                  if (
                    activeCategory &&
                    !newLayout.categories.find((c) => c.id === activeCategory)
                  ) {
                    uiState.setActiveCategory(newLayout.categories[0]?.id ?? '');
                  }

                  // Clear selection since bins may have changed
                  uiState.clearSelection();
                }
              }
            })
            .catch((error) => {
              console.error(`[CrossTabSync] Failed to load layout ${layoutId}:`, error);
            });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
